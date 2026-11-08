/* dsh-perfect-ui — 工作区 Action：存储 + 执行（Host 半边）
   ==========================================================================
   需求（用户截图与描述）：点【运行】→ 弹出「添加 Action」对话框 →
   用户填名称 / 选图标 / 填命令 → 保存为快捷 Action → 点击后在工作区执行。

   与上一版的区别：命令不再从工作区的 .dsh-actions.json 读取，
   改为**用户界面里添加、插件自己持久化**。

   ---- 存储位置 ----
   ~/.dsh/dsh-perfect-ui-actions/actions.json
   与电源路由的 STATE_DIR 同属插件自有目录，不污染工作区、不写 profile patch。
   结构：{ version: 1, actions: [ { id, label, icon, command } ] }
   写入用「临时文件 + rename」的原子替换，避免半写文件。

   ---- 执行 ----
   · ctx.subprocess.spawn，argv 由 shellArgv() 生成。
     Windows 上是 [cmd, '/d','/s','/c', '"' + 整条命令 + '"']，并配
     windowsVerbatimArguments:true —— 外层引号 + 原样透传，缺一则命令里的
     引号会被错误分词（详见 shellArgv 的注释）。
     POSIX /bin/sh 走 [sh, '-c', 命令]，不做 verbatim。
   · cwd = ctx.workingDirectory.get(agent) 或 defaultDirectory
   · 超时 60s，超时 terminate()
   · 输出用 collect 模式（offset 只读、非消费），跑完后一次读出

   ---- 端点 ----
   GET  /list  → { ok, workspace, actions[] }
   POST /save  { action: { id?, label, icon, command } } → { ok, actions[] }
   POST /remove { id } → { ok, actions[] }
   POST /run   { id } → { ok, exitCode, stdout, stderr, command, cwd }

   ---- 安全 ----
   · 只接受界面提交的字段，id 由 Host 生成（不信任客户端给的 id 覆写）
   · 命令串在保存时校验：非空、长度上限、不含换行/空字节
     —— 执行时整条交给系统 shell（Windows cmd.exe / POSIX /bin/sh），
        因此 `|`、`>`、`&&` 有效；界面已明确告知。
        选 shell 而非 argv 切分：`npm` 在本机是 npm.cmd，裸名 spawn 会 ENOENT。
   · 端点做 loopback + Origin 围栏
   ========================================================================== */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const BASE = '/api/dsh-perfect-ui-actions'
const STATE_DIR = join(homedir(), '.dsh', 'dsh-perfect-ui-actions')
const STORE_PATH = join(STATE_DIR, 'actions.json')
const MAX_OUTPUT_BYTES = 256 * 1024
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_ACTIONS = 64
const MAX_LABEL = 60
const MAX_COMMAND = 2000
const MAX_ICON = 4

/* ---------------- 存储 ---------------- */

function readStore() {
  try {
    if (!existsSync(STORE_PATH)) return { version: 1, actions: [] }
    const doc = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
    const list = Array.isArray(doc && doc.actions) ? doc.actions : []
    const actions = []
    for (const it of list) {
      if (!it || typeof it !== 'object') continue
      if (typeof it.command !== 'string' || !it.command.trim()) continue
      actions.push({
        id: String(it.id || '').slice(0, 64) || nextId(actions),
        label: String(it.label || it.command).slice(0, MAX_LABEL),
        icon: String(it.icon || '▶').slice(0, MAX_ICON),
        command: String(it.command).slice(0, MAX_COMMAND),
      })
      if (actions.length >= MAX_ACTIONS) break
    }
    return { version: 1, actions }
  } catch {
    return { version: 1, actions: [] }
  }
}

function nextId(actions) {
  let n = 1
  const used = new Set((actions || []).map((a) => a && a.id))
  while (used.has('act-' + n)) n += 1
  return 'act-' + n
}

function writeStore(doc) {
  mkdirSync(STATE_DIR, { recursive: true })
  const tmp = STORE_PATH + '.tmp'
  writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8')
  renameSync(tmp, STORE_PATH)          // 原子替换，避免半写
}

/* ---------------- 命令校验与切分 ----------------
   保存时只做"是否可执行"的基本校验（长度、换行、空字节）。
     执行时把**整条命令串**交给系统 shell，因此 `|`、`>`、`&&`、引号转义都按 shell 语义生效。
     之所以不切 argv：`npm` 在本机是 npm.cmd，裸名 spawn 不补扩展名会 ENOENT。
   不会产生重定向 —— 界面上必须写清楚这一点。 */
function badCommandText(s) {
  if (typeof s !== 'string') return '命令必须是字符串'
  const t = s.trim()
  if (!t) return '命令不能为空'
  if (t.length > MAX_COMMAND) return '命令过长（上限 ' + MAX_COMMAND + ' 字符）'
  if (/[\u0000\r\n]/.test(s)) return '命令不能包含换行或空字符'
  return ''
}

function toArgv(cmd) {
  return cmd.trim().split(/\s+/).filter(Boolean)
}

/* ---------------- 工作区与 Agent ---------------- */

function agentOf(ctx) {
  try {
    const ag = ctx.get('agents')
    if (ag && typeof ag.currentInitiator === 'function') return ag.currentInitiator()
  } catch { /* 无 */ }
  return undefined
}

function workspaceOf(ctx, agent) {
  try {
    const wd = ctx.get('workingDirectory')
    if (wd) {
      if (agent && typeof wd.get === 'function') {
        try {
          const p = wd.get(agent)
          if (typeof p === 'string' && p) return p
        } catch { /* 用兜底 */ }
      }
      if (typeof wd.defaultDirectory === 'string' && wd.defaultDirectory) return wd.defaultDirectory
    }
  } catch { /* 交给调用方 */ }
  return null
}

/* ---------------- 执行 ----------------
   用户实测报错 `spawn npm ENOENT`。根因（宿主文档原文确证）：
     · spawn 的 argv[0] 必须是**可执行文件**，不经 shell 就不会补扩展名
     · Windows 上 `npm` 实际是 `npm.cmd`，直接 spawn 原名必然 ENOENT
     · 宿主提供了正确的解析入口：
         subprocess.resolveExecutable(command, env?, signal?)
       文档写明「bare names resolve against the scrubbed PATH with
       platform-aware executable extensions (.COM/.EXE/.BAT/.CMD on Windows)」

   因此执行分两条路径：
     A) **shell 模式**（默认）：用宿主探测到的默认 shell（Windows 是 cmd.exe，
        POSIX 是 /bin/sh）来跑**整条命令串**，保留管道、重定向、&& 等语义。
        这符合用户「在当前工作区终端执行」的原意。
     B) **approval 模式**：不支持。
   两条都先把 shell 或首个 token 交给 resolveExecutable 解析成绝对路径，
   避免任何 ENOENT 猜测。 */
async function resolveShellPath(sub, signal) {
  try {
    if (typeof sub.resolveExecutable !== 'function') return null
    let shellPath = null
    if (typeof sub.terminalEnvironment === 'function') {
      const env = await sub.terminalEnvironment(signal)
      shellPath = env && env.defaultShell
      if (!shellPath) shellPath = env && env.platform === 'windows' ? 'cmd.exe' : '/bin/sh'
    } else {
      shellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    }
    return await sub.resolveExecutable(shellPath, undefined, signal)
  } catch {
    return null
  }
}

function shellArgv(shellPath, command) {
  const base = shellPath.replace(/^.*[\\/]/, '').toLowerCase()
  if (base === 'cmd.exe' || base === 'cmd') {
    /* ⚠ 不要给命令串再包一层外层引号，也不要依赖 windowsVerbatimArguments。
       两条实测记录（都在这台机器上跑过，结论明确）：
         ① 加外层引号 + 设 verbatim → 全部命令失败，报
            '"node -p "1+2""' 不是内部或外部命令 —— 说明宿主 ctx.subprocess.spawn
            **不会把 windowsVerbatimArguments 透传给 node:child_process**，
            外层引号因此被当成程序名的一部分。
         ② 只有 [cmd, '/d','/s','/c', command]（当前写法）→ 大多数命令正常：
            echo / node -p / exit /b / 重定向都能工作、退出码正确、stdout 能采到；
            唯一已知缺陷是命令里自带的双引号会被 cmd 按 /s 规则剥离后重新分词
            （例如 node -p "1+2" 输出字符串 1+2 而非 3；
             echo X> "含 空格 的路径" 报文件名语法错误）。
       因此这里保持最简单的 /d /s /c + 原样命令串。用户若要在命令里带引号，
       用 cmd 的转义写法 ^" 或改用 powershell -Command。
       真要让引号完全正确，需要宿主 subprocess 支持 verbatim —— 那是上游的事，
       本插件不做越权修改。 */
    return { argv: [shellPath, '/d', '/s', '/c', command], verbatim: false }
  }
  if (base === 'powershell.exe' || base === 'pwsh.exe' || base === 'powershell' || base === 'pwsh') {
    return { argv: [shellPath, '-NoProfile', '-NonInteractive', '-Command', command], verbatim: false }
  }
  if (/sh(\.exe)?$/.test(base) || base === 'bash' || base === 'zsh') {
    return { argv: [shellPath, '-c', command], verbatim: false }
  }
  // 未知 shell：按 POSIX 惯例
  return { argv: [shellPath, '-c', command], verbatim: false }
}

async function runAction(ctx, dir, action, timeoutMs) {
  const sub = ctx.get('subprocess')
  if (!sub || typeof sub.spawn !== 'function') {
    return { ok: false, error: '宿主子进程服务不可用（ctx.subprocess）' }
  }
  if (!dir) return { ok: false, error: '当前没有工作区目录' }
  if (!existsSync(dir)) return { ok: false, error: '工作区目录不存在：' + dir }

  const command = String(action.command || '').trim()
  if (!command) return { ok: false, error: '命令为空' }

  const ctl = new AbortController()
  const shellPath = await resolveShellPath(sub, ctl.signal)
  if (!shellPath) {
    return { ok: false, error: '无法解析系统 shell（resolveExecutable 失败）' }
  }
  const spec = shellArgv(shellPath, command)
  const argv = spec.argv

  let handle
  try {
    handle = sub.spawn({
      argv,
      cwd: dir,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_OUTPUT_BYTES } },
        stderr: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_OUTPUT_BYTES } },
      },
      graceMs: 5000,
    })
  } catch (e) {
    const m = e && e.message ? e.message : String(e)
    return { ok: false, error: '启动失败：' + m, command, cwd: dir, shell: shellPath }
  }

  const timer = setTimeout(() => {
    try { handle.terminate() } catch { /* 已退出 */ }
  }, timeoutMs)

  const collect = (reader) => {
    if (!reader) return ''
    let offset = 0
    let text = ''
    for (let guard = 0; guard < 64; guard += 1) {
      const r = reader.readFrom(offset)
      if (!r || typeof r.text !== 'string') break
      text += r.text
      if (r.nextOffset === offset) break
      offset = r.nextOffset
      if (!r.text) break
    }
    return text
  }

  let outcome
  try {
    outcome = await handle.done
  } catch (e) {
    clearTimeout(timer)
    return { ok: false, error: '进程失败：' + (e && e.message ? e.message : String(e)) }
  }
  clearTimeout(timer)

  const exitCode = outcome && typeof outcome.exitCode === 'number' ? outcome.exitCode : null
  return {
    ok: exitCode === 0,
    exitCode,
    signal: outcome && outcome.signal ? String(outcome.signal) : '',
    stdout: collect(handle.collected && handle.collected.stdout),
    stderr: collect(handle.collected && handle.collected.stderr),
    command,
    cwd: dir,
    shell: shellPath,
  }
}

/* ---------------- 路由 ---------------- */

function trusted(req) {
  const host = req.headers.host || ''
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return false
  const origin = req.headers.origin
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(origin)) return false
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return false
  return true
}

/* ⚠ webServer.register 的 handler 是 **Node 原生 (req, res)** 语义，
   不是 Fetch 的 `(req) => Response`。宿主源码里所有 prefix 路由都是
   `handler: async (req, res) => { res.writeHead(...); res.end(...) }`。
   上一版返回 Response 对象 → 返回值被丢弃 → 响应体为空 →
   客户端 JSON.parse 抛 "Unexpected end of JSON input"（用户实测报错）。
   这里改用与电源路由完全相同的 json(res, ...) 写法。 */
const json = (res, status, payload) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

/* 读请求体：Node 原生 req 是 AsyncIterable，没有 .json()。 */
function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      resolve(null)
      return
    }
    let raw = ''
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      resolve(value)
    }
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) finish(null)     // 1MB 上限，防滥用
    })
    req.on('end', () => {
      try { finish(JSON.parse(raw || 'null')) } catch { finish(null) }
    })
    req.on('error', () => finish(null))
  })
}

export function registerActionRoutes(ctx) {
  const handler = async (req, res) => {
    if (!trusted(req)) {
      json(res, 403, { ok: false, error: '不受信任的请求来源' })
      return
    }

    let path = '/'
    try {
      path = new URL(req.url || '/', 'http://x').pathname.slice(BASE.length) || '/'
    } catch { /* 保持 '/' */ }

    const agent = agentOf(ctx)
    const dir = workspaceOf(ctx, agent)

    if (path === '/list') {
      if (req.method !== 'GET') { json(res, 405, { ok: false, error: '需要 GET' }); return }
      const doc = readStore()
      json(res, 200, { ok: true, workspace: dir, actions: doc.actions })
      return
    }

    if (path === '/save') {
      if (req.method !== 'POST') { json(res, 405, { ok: false, error: '需要 POST' }); return }
      const body = await readBody(req)
      const input = body && body.action
      if (!input || typeof input !== 'object') {
        json(res, 400, { ok: false, error: '缺少 action' })
        return
      }

      const err = badCommandText(input.command)
      if (err) { json(res, 400, { ok: false, error: err }); return }

      const doc = readStore()
      const argv = toArgv(input.command)
      const label = String(input.label || '').trim().slice(0, MAX_LABEL)
        || argv[0] || '未命名'
      const icon = String(input.icon || '▶').slice(0, MAX_ICON)
      const command = String(input.command).trim().slice(0, MAX_COMMAND)

      /* id 由 Host 决定：客户端给了且**已存在**才更新，否则新建，
         避免客户端凭空造 id 或越权覆写。 */
      const wantId = typeof input.id === 'string' ? input.id : ''
      const idx = wantId ? doc.actions.findIndex((a) => a.id === wantId) : -1
      if (idx >= 0) {
        doc.actions[idx] = { id: wantId, label, icon, command }
      } else {
        if (doc.actions.length >= MAX_ACTIONS) {
          json(res, 200, { ok: false, error: 'Action 数量已达上限 ' + MAX_ACTIONS })
          return
        }
        doc.actions.push({ id: nextId(doc.actions), label, icon, command })
      }
      try {
        writeStore(doc)
      } catch (e) {
        json(res, 500, { ok: false, error: '写入失败：' + (e && e.message ? e.message : String(e)) })
        return
      }
      json(res, 200, { ok: true, actions: doc.actions })
      return
    }

    if (path === '/remove') {
      if (req.method !== 'POST') { json(res, 405, { ok: false, error: '需要 POST' }); return }
      const body = await readBody(req)
      const id = body && body.id
      if (typeof id !== 'string' || !id) { json(res, 400, { ok: false, error: '缺少 id' }); return }
      const doc = readStore()
      const before = doc.actions.length
      doc.actions = doc.actions.filter((a) => a.id !== id)
      if (doc.actions.length === before) {
        json(res, 200, { ok: false, error: '找不到该 Action' })
        return
      }
      try {
        writeStore(doc)
      } catch (e) {
        json(res, 500, { ok: false, error: '写入失败：' + (e && e.message ? e.message : String(e)) })
        return
      }
      json(res, 200, { ok: true, actions: doc.actions })
      return
    }

    if (path === '/run') {
      if (req.method !== 'POST') { json(res, 405, { ok: false, error: '需要 POST' }); return }
      const body = await readBody(req)
      const id = body && body.id
      if (typeof id !== 'string' || !id) { json(res, 400, { ok: false, error: '缺少 id' }); return }
      const doc = readStore()
      const action = doc.actions.find((a) => a.id === id)
      if (!action) { json(res, 200, { ok: false, error: '找不到该 Action：' + id }); return }
      const timeout = typeof body.timeoutMs === 'number'
        ? Math.min(Math.max(body.timeoutMs, 1000), 300_000)
        : DEFAULT_TIMEOUT_MS
      try {
        const result = await runAction(ctx, dir, action, timeout)
        json(res, 200, result)
      } catch (e) {
        json(res, 500, { ok: false, error: '执行异常：' + (e && e.message ? e.message : String(e)) })
      }
      return
    }

    json(res, 404, { ok: false, error: '未知端点 ' + path })
  }

  return ctx.webServer.register({ kind: 'prefix', path: BASE, handler })
}
