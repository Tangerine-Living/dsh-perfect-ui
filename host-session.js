/* dsh-perfect-ui — 会话永久删除（Host 半边）
   参考实现：https://github.com/hshh603/dsh-session-purge (MIT)
   本文件按其设计重写，关键差异与取舍在下方逐条注明。

   ==========================================================================
   一、"DSH 没有删除 API" —— 与参考实现一致查证结论
     · sessionPersistence 文档：No deletion or retention API — pruning stored
       sessions is out-of-band backend maintenance.
     · JSONL 后端文档：Nothing deletes session files.
   所以删除只能在本进程内做"带外的后端维护"，并且必须用后端自己的读取器
   （sessionPersistence.open(id,'read').read()），而不是自己解 zstd 帧。

   二、会话由三处记录，缺一不可（我上一版只删日志，用户实测"列表仍在"）
     ① <DSH_HOME>/sessions/<项目目录>/<会话id>/   日志本体
     ② storage/workspace.json 的 sessionIds       决定侧栏归组
     ③ storage/session_projcache/sessions/<id>    标题等投影缓存
   参考实现处理 ①②（并额外处理附件与产物文件），本文件同样处理 ①②③。

   三、★ 列表刷新的正确机制（我此前一直找错方向）
     不是 sessions.refresh()（那重拉的是另一个 store），而是：
         ctx.emit('api-session/removed', sessionId)
     该事件经 cordis_inspect 确证存在："A Session left the live Host registry"，
     由宿主 relay 到浏览器，侧栏随之移除该行。
     这是参考实现 lib/index.js 里的写法，也是我一直缺的那一环。

   四、删除范围三档（照搬参考实现的语义）
     · record     只删会话记录（日志 + 归组 + 投影缓存），保留它写过的文件
     · artifacts  另外删除**该会话写入过**、且真实路径严格落在其 cwd 内、
                  且不位于 DSH_HOME 下的文件（只删文件，不删目录）
     · everything 另外删除**没有其它会话引用**的附件对象

   五、安全（比参考实现更保守的地方）
     参考实现用 rm() 直接删；本文件仍保留「先改名进回收站」，
     因为用户可能误删——这是与参考实现的**有意分歧**，已在此声明。
     路径围栏、id 校验、附件共享判定、访源校验全部照参考实现实现。

   六、路由形态
     参考实现用 kind:'exact' + 三个端点；本文件同样用 exact，
     避免 prefix 匹配把意外路径也接住。
   ========================================================================== */

import { existsSync, mkdirSync, renameSync, appendFileSync } from 'node:fs'
import { readdir, realpath, stat as fsStat } from 'node:fs/promises'
import { join, isAbsolute, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

const ROUTE = '/api/dsh-perfect-ui-session'
const TRASH_ROOT = join(homedir(), '.dsh', 'dsh-perfect-ui-trash')
const LOG_DIR = join(homedir(), '.dsh', 'dsh-perfect-ui-actions')
const DEL_LOG = join(LOG_DIR, 'session-delete.log')

/* 会话 id 是单个安全路径段：字母数字开头，只含 字母数字 . _ -
   这与参考实现的 SESSION_ID 一致（它的注释说明 DSH 产出的 <uuid> 与
   session-<uuid> 都匹配），比我只认 uuid 更稳，同时仍杜绝 ../ 注入。 */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/

/* 三种删除范围，破坏性递增 */
const MODES = ['record', 'artifacts', 'everything']

/* 写类工具的路径参数键（照参考实现；Minimal 预设的 str_replace_editor 用 path） */
const WRITE_TOOL_PATHS = {
  write: ['file_path', 'path'],
  edit: ['file_path', 'path'],
  str_replace_editor: ['path', 'file_path'],
  create_file: ['file_path', 'path'],
}

const MAX_REPORTED_ROWS = 500

function audit(line) {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(DEL_LOG, `[${new Date().toISOString()}] ${line}\n`)
  } catch { /* 日志失败不影响主流程 */ }
}

function describe(e) {
  return e instanceof Error ? e.message : String(e)
}

async function resolveHome() {
  const fromEnv = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : ''
  if (fromEnv !== '') return fromEnv
  try {
    const library = await import('@deepseek-ai/dsh-home-paths')
    if (typeof library.resolveDshHome === 'function') return library.resolveDshHome()
  } catch { /* 落到默认 */ }
  return join(homedir(), '.dsh')
}

/* child 是否严格位于 parent 内（比对真实路径） */
function inside(parent, child) {
  if (parent === child) return false
  const prefix = parent.endsWith(sep) ? parent : parent + sep
  return child.startsWith(prefix)
}

async function directoryBytes(directory) {
  let total = 0
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return 0 }
  for (const entry of entries) {
    const child = join(directory, entry.name)
    if (entry.isDirectory()) total += await directoryBytes(child)
    else if (entry.isFile()) {
      try { total += (await fsStat(child)).size } catch { /* 文件在遍历中消失 */ }
    }
  }
  return total
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  })
  res.end(body)
}

const MAX_BODY_BYTES = 256 * 1024

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  return text === '' ? {} : JSON.parse(text)
}

/* 拒收非本插件页面的请求。
   /api 路由不带壳的会话授权，所以裸端点会让任意本机页面触发删除。
   标记头无法被跨站表单/简单请求携带（会强制预检，且本服务不应答预检），
   Origin 校验再挡同形状的跨源请求。
   本文件在此之上**保留** loopback 围栏（比参考实现更严）。 */
function requireOwnPage(req) {
  const host = req.headers.host || ''
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) {
    throw new Error('不受信任的请求来源')
  }
  if (req.headers['x-dsh-perfect-ui-purge'] !== '1') {
    throw new Error('缺少插件请求标记')
  }
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return
  let originHost = null
  try { originHost = new URL(origin).host } catch { throw new Error('请求来源不合法') }
  if (originHost !== host) throw new Error('已拒绝跨站请求')
}

function headerOf(snapshot) {
  if (snapshot === null || typeof snapshot !== 'object') return null
  const nested = snapshot.header
  if (nested !== null && typeof nested === 'object' && typeof nested.id === 'string') return nested
  if (typeof snapshot.id === 'string' && typeof snapshot.version === 'number') return snapshot
  return null
}

/* 用**后端自己的读取器**读事件，而不是自己解压 zstd。 */
async function readEvents(persistence, sessionId) {
  let handle
  try {
    handle = await persistence.open(sessionId, 'read')
    const result = await handle.read()
    const events = Array.isArray(result?.events) ? result.events : []
    return { events, warning: undefined }
  } catch (error) {
    return { events: [], warning: `读取会话日志失败：${describe(error)}` }
  } finally {
    try { await handle?.close?.() } catch { /* close 失败不改变计划 */ }
  }
}

function collectAttachmentIds(value, into) {
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collectAttachmentIds(item, into)
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'attachmentId' && typeof child === 'string' && child !== '') into.add(child)
    else collectAttachmentIds(child, into)
  }
}

/* 该会话的写类工具写过的文件（相对路径按会话 cwd 解析） */
function collectWrittenPaths(events, cwd) {
  const rows = new Map()
  for (const event of events) {
    if (event?.type !== 'tool/call') continue
    const data = event.data ?? {}
    const keys = WRITE_TOOL_PATHS[data.name]
    if (keys === undefined) continue
    let args
    try {
      args = JSON.parse(typeof data.arguments === 'string' ? data.arguments : '{}')
    } catch { continue }
    if (args === null || typeof args !== 'object') continue
    const raw = keys.map((k) => args[k]).find((v) => typeof v === 'string' && v.trim() !== '')
    if (raw === undefined) continue
    const absolute = isAbsolute(raw) ? raw : cwd === undefined ? undefined : resolve(cwd, raw)
    if (absolute === undefined) continue
    const existing = rows.get(absolute)
    if (existing === undefined) rows.set(absolute, { path: absolute, ops: 1 })
    else existing.ops += 1
  }
  return [...rows.values()]
}

/* 判定哪些"写过的路径"可以删：
   必须是真文件、真实路径在会话 cwd 内、且不在 DSH_HOME 内。 */
async function classifyArtifacts(rows, cwd, home) {
  const allowed = []
  const refused = []
  if (cwd === undefined) {
    for (const row of rows) refused.push({ path: row.path, reason: '会话未记录工作目录，无法安全定位' })
    return { allowed, refused }
  }
  let realCwd
  try { realCwd = await realpath(cwd) } catch {
    for (const row of rows) refused.push({ path: row.path, reason: '会话工作目录已不存在，无法校验归属' })
    return { allowed, refused }
  }
  let realHome = home
  try { realHome = await realpath(home) } catch { /* 不存在的 home 装不下任何东西 */ }

  for (const row of rows) {
    let info
    try { info = await fsStat(row.path) } catch {
      refused.push({ path: row.path, reason: '文件已不存在' }); continue
    }
    if (!info.isFile()) { refused.push({ path: row.path, reason: '不是普通文件，已跳过' }); continue }
    let real
    try { real = await realpath(row.path) } catch {
      refused.push({ path: row.path, reason: '无法解析真实路径，已跳过' }); continue
    }
    if (!inside(realCwd, real)) {
      refused.push({ path: row.path, reason: '不在该会话的工作目录内，已跳过' }); continue
    }
    if (inside(realHome, real)) {
      refused.push({ path: row.path, reason: '位于 DSH 数据目录内，已跳过' }); continue
    }
    allowed.push({ path: real, displayPath: row.path, bytes: info.size, ops: row.ops })
  }
  return { allowed, refused }
}

/* 会话日志目录：<home>/sessions/<项目目录>/<id>，按目录名精确匹配。
   DSH 的目录名可能是 <uuid> 或 session-<uuid>，两者都试。 */
async function findSessionDirectories(home, sessionId) {
  const root = join(home, 'sessions')
  const found = []
  if (!existsSync(root)) return found
  const core = String(sessionId).replace(/^session-/i, '')
  const wanted = new Set([sessionId, core, 'session-' + core])
  let projects
  try { projects = await readdir(root, { withFileTypes: true }) } catch { return found }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    for (const name of wanted) {
      const candidate = join(root, project.name, name)
      if (!existsSync(candidate)) continue
      try {
        if (!(await fsStat(candidate)).isDirectory()) continue
      } catch { continue }
      if (!found.includes(candidate)) found.push(candidate)
    }
  }
  return found
}

function attachmentPaths(home, attachmentId) {
  const raw = typeof attachmentId === 'string' ? attachmentId : ''
  const hash = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw
  if (!/^[0-9a-fA-F]{16,128}$/.test(hash)) return []
  const digest = hash.toLowerCase()
  const prefix = digest.slice(0, 2)
  const base = join(home, 'attachments', 'v1')
  return [
    { path: join(base, 'objects', prefix, digest), kind: 'image-object' },
    { path: join(base, 'file-objects', prefix, digest), kind: 'file-object' },
    { path: join(base, 'files', prefix, digest), kind: 'file-reference' },
  ]
}

/* 其它已存会话仍在引用的附件 id（读失败一律视为"被引用"，保守处理） */
async function idsReferencedElsewhere(persistence, sessionId, ids) {
  const shared = new Set()
  const pending = new Set(ids)
  if (pending.size === 0) return shared
  if (typeof persistence.list !== 'function') return new Set(ids)
  let snapshots
  try { snapshots = await persistence.list() } catch { return new Set(ids) }
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    if (pending.size === 0) break
    const header = headerOf(snapshot)
    const other = header?.id ?? snapshot?.id
    if (typeof other !== 'string' || other === sessionId) continue
    const { events, warning } = await readEvents(persistence, other)
    if (warning !== undefined) {
      for (const id of pending) shared.add(id)
      pending.clear()
      break
    }
    const found = new Set()
    collectAttachmentIds(events, found)
    for (const id of [...pending]) {
      if (found.has(id)) { shared.add(id); pending.delete(id) }
    }
  }
  return shared
}

function isLive(ctx, sessionId) {
  try {
    const sessions = ctx.get('sessions')
    if (sessions === undefined || typeof sessions.get !== 'function') return false
    return sessions.get(sessionId) !== undefined
  } catch { return false }
}

async function buildPlan(ctx, home, sessionId) {
  const persistence = ctx.get('sessionPersistence')
  const warnings = []

  let snapshot = null
  try { snapshot = await persistence.stat(sessionId) } catch (error) {
    warnings.push(`未找到该会话的存储记录：${describe(error)}`)
  }
  const header = headerOf(snapshot)
  const cwd = typeof header?.cwd === 'string' ? header.cwd : undefined

  const { events, warning } = await readEvents(persistence, sessionId)
  if (warning !== undefined) warnings.push(warning)

  const directories = await findSessionDirectories(home, sessionId)
  if (directories.length === 0) warnings.push('未在会话目录中找到该会话的文件（可能已被删除）。')
  const storeBytes = (await Promise.all(directories.map(directoryBytes))).reduce((a, b) => a + b, 0)

  const written = collectWrittenPaths(events, cwd)
  const { allowed, refused } = await classifyArtifacts(written, cwd, home)

  const attachmentIds = new Set()
  collectAttachmentIds(events, attachmentIds)

  return {
    home, sessionId, cwd,
    createdAt: typeof header?.createdAt === 'number' ? header.createdAt : null,
    live: isLive(ctx, sessionId),
    store: { directories, bytes: storeBytes },
    artifacts: {
      allowed: allowed.slice(0, MAX_REPORTED_ROWS),
      refused: refused.slice(0, MAX_REPORTED_ROWS),
      totalBytes: allowed.reduce((sum, row) => sum + row.bytes, 0),
      truncated: allowed.length > MAX_REPORTED_ROWS || refused.length > MAX_REPORTED_ROWS,
    },
    attachments: { ids: [...attachmentIds].slice(0, MAX_REPORTED_ROWS) },
    warnings,
  }
}

/* 把目标移进回收站（与本项目一贯做法一致；参考实现是直接 rm）。
   目录改名是原子的，且误删可恢复。 */
function trashPath(target, tag) {
  const real = resolve(target)
  mkdirSync(TRASH_ROOT, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = stamp + '__' + tag + '__' + real.replace(/[\\/]+/g, '_').slice(-160)
  renameSync(real, join(TRASH_ROOT, name))
  return join(TRASH_ROOT, name)
}

async function purge(ctx, home, sessionId, mode) {
  const plan = await buildPlan(ctx, home, sessionId)
  const errors = []
  const removed = {
    directories: [], directoryBytes: 0,
    artifacts: [], artifactBytes: 0,
    attachments: [], projCache: 0,
    archived: false, detached: [],
  }

  /* ① 活着的会话先停止并归档：归档是持久化的，且在停止请求之前写下，
     所以文件被移除期间不会有人唤醒它，侧栏也已经隐藏。
     步骤顺序照参考实现。 */
  if (plan.live) {
    try {
      const registry = ctx.get('workspaceRegistry')
      if (registry !== undefined && typeof registry.archiveSession === 'function') {
        await registry.archiveSession(sessionId, { stopActivity: true })
        removed.archived = true
      }
    } catch (error) {
      errors.push({ step: 'archive', path: null, message: describe(error) })
    }
  }

  /* ② 从工作区归属里摘除，避免重载后留下陈旧分组
     （走 registry 的 detachSession，会触发 domain/changed，侧栏即时更新） */
  try {
    const registry = ctx.get('workspaceRegistry')
    if (registry !== undefined && typeof registry.list === 'function') {
      const core = String(sessionId).replace(/^session-/i, '')
      const targets = new Set([sessionId, core, 'session-' + core])
      for (const workspace of registry.list()) {
        const ids = Array.isArray(workspace?.sessionIds) ? workspace.sessionIds : []
        if (!ids.some((id) => targets.has(String(id)))) continue
        await workspace.detachSession(sessionId)
        removed.detached.push(workspace.id ?? workspace.path ?? 'workspace')
      }
    }
  } catch (error) {
    errors.push({ step: 'detach', path: null, message: describe(error) })
  }

  /* ③ 会话日志本体（先移进回收站） */
  for (const directory of plan.store.directories) {
    try {
      const bytes = await directoryBytes(directory)
      removed.directories.push(trashPath(directory, 'session'))
      removed.directoryBytes += bytes
    } catch (error) {
      errors.push({ step: 'record', path: directory, message: describe(error) })
    }
  }

  /* ④ 投影缓存（我的实现额外处理；缺它会在列表里留下"有标题无内容"的幽灵行） */
  try {
    const projcache = join(home, 'storages', 'session_projcache', 'sessions')
    if (existsSync(projcache)) {
      const core = String(sessionId).replace(/^session-/i, '')
      for (const name of [core + '.json', 'session-' + core + '.json']) {
        const p = join(projcache, name)
        if (!existsSync(p)) continue
        trashPath(p, 'projcache')
        removed.projCache += 1
      }
    }
  } catch (error) {
    errors.push({ step: 'projcache', path: null, message: describe(error) })
  }

  /* ⑤ 该会话写入过、且归属安全的文件 */
  if (mode === 'artifacts' || mode === 'everything') {
    for (const row of plan.artifacts.allowed) {
      try {
        trashPath(row.path, 'artifact')
        removed.artifacts.push(row.displayPath)
        removed.artifactBytes += row.bytes
      } catch (error) {
        errors.push({ step: 'artifact', path: row.displayPath, message: describe(error) })
      }
    }
  }

  /* ⑥ 没有其它会话引用的附件对象 */
  let attachmentReport = null
  if (mode === 'everything') {
    const ids = plan.attachments.ids
    const shared = await idsReferencedElsewhere(ctx.get('sessionPersistence'), sessionId, ids)
    const deletable = ids.filter((id) => !shared.has(id))
    const skipped = []
    for (const id of deletable) {
      const candidates = attachmentPaths(home, id)
      let deleted = false
      for (const candidate of candidates) {
        if (!existsSync(candidate.path)) continue
        try {
          trashPath(candidate.path, 'attachment')
          removed.attachments.push(candidate.path)
          deleted = true
        } catch (error) {
          errors.push({ step: 'attachment', path: candidate.path, message: describe(error) })
        }
      }
      if (!deleted) skipped.push(id)
    }
    attachmentReport = {
      referenced: ids.length, shared: shared.size,
      deleted: removed.attachments.length, notFound: skipped.length,
    }
  }

  /* ⑦ ★ 通知浏览器该会话已离开 Host 注册表 —— 侧栏据此移除该行。
     这是参考实现的写法，也是此前"refresh ok 但列表不变"的真正解法：
     sessions.refresh() 重拉的是另一个 store，而本事件经宿主 relay 到页面。 */
  try {
    ctx.emit('api-session/removed', sessionId)
  } catch (error) {
    errors.push({ step: 'notify', path: null, message: describe(error) })
  }

  audit(`purge session=${sessionId} mode=${mode} dirs=${removed.directories.length} files=${removed.artifacts.length} proj=${removed.projCache} detach=${removed.detached.length} errors=${errors.length}`)

  return {
    plan: {
      sessionId, cwd: plan.cwd, live: plan.live,
      storeBytes: plan.store.bytes,
      artifactCount: plan.artifacts.allowed.length,
      artifactBytes: plan.artifacts.totalBytes,
      attachmentCount: plan.attachments.ids.length,
      warnings: plan.warnings,
    },
    removed, attachments: attachmentReport, errors,
  }
}

/* 注册路由。返回 disposer 数组交给 index.js 的 ctx.effect。 */
export function registerSessionDeleteRoutes(ctx) {
  const server = ctx.webServer

  const wrap = (handler) => (req, res) => {
    void (async () => {
      try {
        await handler(req, res)
      } catch (error) {
        if (!res.headersSent) sendJson(res, 400, { ok: false, error: describe(error) })
        else res.end()
      }
    })()
  }

  const sessionIdOf = (body) => {
    const sessionId = body?.sessionId ?? body?.id
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId) ||
      sessionId === '.' || sessionId === '..') {
      throw new Error('会话 id 不合法')
    }
    return sessionId
  }

  const disposers = []

  disposers.push(server.register({
    kind: 'exact', path: ROUTE + '/health',
    handler: wrap((req, res) => { sendJson(res, 200, { ok: true, plugin: 'dsh-perfect-ui' }) }),
  }))

  disposers.push(server.register({
    kind: 'exact', path: ROUTE + '/probe',
    handler: wrap(async (req, res) => {
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
      requireOwnPage(req)
      const body = await readJsonBody(req)
      const sessionId = sessionIdOf(body)
      const home = await resolveHome()
      const plan = await buildPlan(ctx, home, sessionId)
      sendJson(res, 200, {
        ok: true, sessionId,
        cwd: plan.cwd, createdAt: plan.createdAt, live: plan.live,
        dirs: plan.store.directories.length, bytes: plan.store.bytes,
        artifacts: { allowed: plan.artifacts.allowed.length, refused: plan.artifacts.refused.length, bytes: plan.artifacts.totalBytes },
        attachments: plan.attachments.ids.length,
        warnings: plan.warnings,
        /* 可删 = 有日志目录或有可删文件或活会话；界面据此决定菜单项是否可点 */
        removable: plan.store.directories.length > 0 || plan.artifacts.allowed.length > 0 || plan.live,
      })
    }),
  }))

  disposers.push(server.register({
    kind: 'exact', path: ROUTE + '/delete',
    handler: wrap(async (req, res) => {
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
      requireOwnPage(req)
      const body = await readJsonBody(req)
      const sessionId = sessionIdOf(body)
      const mode = body?.mode
      if (typeof mode !== 'string' || !MODES.includes(mode)) throw new Error('删除范围不合法')
      if (body?.confirm !== true) throw new Error('缺少删除确认')

      const home = await resolveHome()
      const result = await purge(ctx, home, sessionId, mode)
      sendJson(res, 200, { ok: true, sessionId, mode, ...result })
    }),
  }))

  return () => { for (const d of disposers) { try { d() } catch { /* 已撤销 */ } } }
}
