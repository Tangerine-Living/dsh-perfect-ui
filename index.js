/**
 * Host 半边（Cordis Loader row `dsh-perfect-ui`）。
 *
 * 电源操作路由（机制复刻 dsh-power-menu，MIT 署名见 helper.cjs 头注释）：
 *   POST /api/dsh-perfect-ui-power/shutdown — 结束整个桌面应用
 *   POST /api/dsh-perfect-ui-power/restart  — 结束并重新拉起同一可执行文件
 *   GET  /api/dsh-perfect-ui-power/health   — 是否桌面构建
 *   GET  /api/dsh-perfect-ui-power/plan     — 目标/拒绝报告，无副作用
 *
 * Host 进程是 Electron 主进程的子进程，不能自己 app.quit()；交接由 detached
 * helper（helper.cjs）完成：只结束 Electron 主进程（taskkill 无 /T），IPC
 * 通道断开后 Host 走自己的 application.shutdown 刷会话日志；restart 则等端口
 * 释放后用干净环境重新拉起。
 *
 * 路由走 ctx.webServer 的 prefix 注册（dsh-power-menu 同款，用户机器上已验证
 * 可达：桌面渲染进程的 fetch 经 IPC 桥转给 Host 的 webServer 路由）。
 * 状态目录独立（~/.dsh/dsh-perfect-ui-power），与 dsh-power-menu 并存时
 * 日志与交接文件不互相覆盖。
 *
 * 曾经在这里实现过「平台用量代理」，v2.11.0 实测证明插件层拿不到平台网页
 * 用量凭据（40002 Missing Token / 40003 invalid token；快照字段实测为
 * origin, token, userId, requestHeaders），已撤除。宿主的「设置 → 账户 →
 * 查询用量」走原生 Platform 内嵌视图，才是可用路径。
 *
 * 主题与余额在 Client 半边（dist/client.js），本文件只管电源路由。
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerActionRoutes } from './host-actions.js'
import { registerSessionDeleteRoutes } from './host-session.js'
import { registerPluginRoutes } from './host-plugins.js'
import { registerPromoRoutes } from './host-promo.js'
import { apply as applySkillMarket } from './host-skill-market.js'

export const name = 'dsh-perfect-ui'
export const inject = ['webServer']

const BASE = '/api/dsh-perfect-ui-power'
const HELPER = fileURLToPath(new URL('./helper.cjs', import.meta.url))
const STATE_DIR = join(homedir(), '.dsh', 'dsh-perfect-ui-power')
const LOG_PATH = join(STATE_DIR, 'power-menu.log')

/** At-most-once latch：shutdown 与 restart 都会终结本进程。 */
let pending = null

function note(line) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch {
    /* 诊断绝不能破坏动作本身 */
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

/** 本 Host 是否为桌面构建的子进程（Electron 主进程为父）。 */
function desktopTarget() {
  if (process.env.ELECTRON_RUN_AS_NODE !== '1') return null
  const mainPid = process.ppid
  if (!Number.isInteger(mainPid) || mainPid <= 1) return null
  const exe = process.execPath
  if (typeof exe !== 'string' || exe === '') return null
  const base = basename(exe).toLowerCase()
  // 插件派生的 node.exe 同样继承 ELECTRON_RUN_AS_NODE=1；
  // 把它误当桌面可执行文件去杀就是静默走火，必须排除。
  if (base === 'node.exe' || base === 'node') return null
  return { mainPid, exe, hostPid: process.pid }
}

function resolvePort(ctx) {
  try {
    const port = ctx.webServer?.port
    if (Number.isInteger(port) && port > 0) return port
  } catch { /* fall through */ }
  try {
    const address = ctx.webServer?.server?.address?.()
    if (address !== null && typeof address === 'object' && Number.isInteger(address.port) && address.port > 0) {
      return address.port
    }
  } catch { /* fall through */ }
  return null
}

/**
 * 破坏性路由的围栏与 DSH 自家一致：回环 socket、回环 Host 头、非跨站、
 * Origin 的 host:port 必须是本服务器。桌面渲染器可能用 dsh-app: 协议，
 * 故刻意不要求协议相等；Origin 缺失也放行（桌面 shell 会省略它，
 * 而能省略 Origin 的本地进程本来就能 taskkill —— 同一本地信任边界）。
 */
function trusted(req) {
  const address = req.socket?.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const { host, origin, 'sec-fetch-site': secFetchSite } = req.headers
  if (typeof host !== 'string') return false
  let hostUrl
  try { hostUrl = new URL(`http://${host}`) } catch { return false }
  const hostname = hostUrl.hostname
  if (hostname !== '127.0.0.1' && hostname !== '::1' && hostname !== '[::1]' && hostname !== 'localhost') return false
  if (secFetchSite === 'cross-site') return false
  if (origin === undefined) return true
  if (typeof origin !== 'string' || origin === 'null') return false
  try {
    const originUrl = new URL(origin)
    return originUrl.host === hostUrl.host
  } catch { return false }
}

/** 写交接文件并启动 detached helper。 */
function schedule(mode, ctx) {
  if (pending !== null) {
    return { ok: false, status: 409, error: `电源切换已在进行中：${pending}` }
  }
  const target = desktopTarget()
  if (target === null) {
    return { ok: false, status: 409, error: '仅支持 DeepSeek Harness 桌面版（当前是 dsh web，请用终端里的进程管理方式）' }
  }
  if (!existsSync(HELPER)) return { ok: false, status: 500, error: `helper missing: ${HELPER}` }

  pending = mode
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-').slice(0, 23)
    const handoffPath = join(STATE_DIR, `handoff-${mode}-${stamp}.json`)
    const logPath = join(STATE_DIR, `helper-${mode}-${stamp}.log`)
    const handoff = {
      mode,
      mainPid: target.mainPid,
      hostPid: target.hostPid,
      exe: target.exe,
      port: resolvePort(ctx),
      delayMs: 1200,
      logPath,
      handoffPath,
      startedAt: new Date().toISOString(),
    }
    writeFileSync(handoffPath, JSON.stringify(handoff, null, 2), 'utf8')
    note(`${mode}: scheduled main=${String(target.mainPid)} host=${String(target.hostPid)} exe=${target.exe} port=${String(handoff.port)} log=${logPath}`)

    const helper = spawn(process.execPath, [HELPER, handoffPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: dirname(HELPER),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    helper.on('error', (error) => {
      note(`${mode}: helper spawn error: ${String(error?.message ?? error)}`)
      pending = null
    })
    helper.unref()
    note(`${mode}: helper pid=${String(helper.pid)}`)
    return { ok: true, status: 202, mode }
  } catch (error) {
    pending = null
    const message = error instanceof Error ? error.message : String(error)
    note(`${mode}: failed to schedule: ${message}`)
    return { ok: false, status: 500, error: message }
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    handler: (req, res) => {
      let sub = '/'
      try {
        sub = new URL(req.url ?? '/', 'http://x').pathname.slice(BASE.length).replace(/\/+$/u, '') || '/'
      } catch { /* keep '/' */ }

      if (sub === '/health') {
        if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
        json(res, 200, { ok: true, desktop: desktopTarget() !== null, pending })
        return
      }
      if (sub === '/plan') {
        if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
        const target = desktopTarget()
        const reasons = []
        if (target === null) reasons.push('不是桌面 host，或可执行文件形似 node')
        if (!existsSync(HELPER)) reasons.push(`helper missing: ${HELPER}`)
        if (target !== null && !existsSync(target.exe)) reasons.push(`executable missing: ${target.exe}`)
        json(res, 200, { ok: reasons.length === 0, desktop: target !== null, target, helper: HELPER, logPath: LOG_PATH, pending, reasons })
        return
      }
      if (sub !== '/shutdown' && sub !== '/restart') {
        return json(res, 404, { ok: false, error: `no dsh-perfect-ui-power endpoint ${sub}` })
      }
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
      if (!trusted(req)) {
        note(`forbidden: origin=${JSON.stringify(req.headers.origin ?? null)} host=${JSON.stringify(req.headers.host ?? null)} sec=${JSON.stringify(req.headers['sec-fetch-site'] ?? null)}`)
        return json(res, 403, { ok: false, error: 'forbidden: untrusted power request' })
      }
      const result = schedule(sub === '/restart' ? 'restart' : 'shutdown', ctx)
      json(res, result.status ?? (result.ok ? 202 : 500), result)
    },
  }), 'dsh-perfect-ui: power routes')

  /* 工作区一键运行命令（host-actions.js）。
     不是独立 Loader row（profile patch 只有 dsh-perfect-ui 一行），
     由本 apply 统一注册；注销由它返回的 disposer 交给 ctx.effect。
     命令整条交给系统 shell 执行（host-actions.js 的 shellArgv），
     因此管道、重定向与 && 有效。 */
  ctx.effect(() => registerActionRoutes(ctx), 'dsh-perfect-ui: workspace action routes')

  /* 会话真正删除（host-session.js）：宿主没有删除接口，只能删磁盘存储目录。
     目标先原子改名进 ~/.dsh/dsh-perfect-ui-trash，可找回，不是直接 rm。 */
  ctx.effect(() => registerSessionDeleteRoutes(ctx), 'dsh-perfect-ui: session delete routes')

  /* 插件推荐（host-plugins.js）：用宿主 pluginManager 服务做「查状态 / 装 / 查更新」。
     走 Host 而不是客户端 remote.pluginManager —— 后者需要 inject 点号键
     "remote.pluginManager"（插件市场自己就是这么声明的），本插件只 inject 'remote'
     取不到它；Host 侧 pluginManager 是标准服务，任何 Host 插件都能 inject。 */
  ctx.effect(() => registerPluginRoutes(ctx), 'dsh-perfect-ui: plugin recommend routes')

  /* 广告/推广内容（host-promo.js）：远程 HTML 拉取 + GitHub 更新检查。
     必须走 Host —— 客户端 fetch 受 Cordis trap 包装且受同源策略限制，
     跨域拉 GitHub raw 内容会失败。Host 是 Node 进程，可自由出网；
     但因此严格保留了三个安全边界：域名白名单、512KB 上限、只回文本。 */
  ctx.effect(() => registerPromoRoutes(ctx), 'dsh-perfect-ui: promo routes')

  /* 技能市场 Host 半边（复刻 @montersy123/dsh-skill-market v2.0.7，MIT）。
     它自带 inject:['webServer'] 与 apply(ctx)；本文件已声明 webServer，
     所以只借它的 apply，不重复声明依赖。它自己会 ctx.inject(['skills'])
     取作用域化的 skills 服务做运行时注册，无需我在这里代劳。
     ⚠ 它注册的前缀 /skill-market/api 与原版相同 —— 原版必须停用/卸载，
       否则两条同前缀路由冲突，且会争用同一份 storages 数据。 */
  ctx.effect(() => {
    applySkillMarket(ctx)
    return undefined
  }, 'dsh-perfect-ui: skill market routes')
}

// Cordis 从未解包的插件对象读 inject；若安装器经 default 解包，
// default 必须是完整对象而不是裸 apply，否则 webServer 访问抛
// `cannot get property "webServer" without inject`（dsh-power-menu 同款教训）。
export default { name, inject, apply }
