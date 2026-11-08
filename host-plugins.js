/**
 * 插件推荐 Host 半边：通过宿主 pluginManager 服务做「检查 / 安装 / 查更新」。
 *
 * 为什么不用客户端 remote.pluginManager：
 *   那个命名空间需要 inject 点号键 "remote.pluginManager"（插件市场自己就是这么声明的：
 *   inject = ["slots","locale","remote","remote.pluginManager",...]）。
 *   本插件只 inject 'remote' → 取到的 remote 里没有 pluginManager → 报
 *   「宿主没有提供 pluginManager.installBundle」。
 *   而 Host 侧的 pluginManager 是标准服务（app.asar 里多处 Host 插件
 *   inject = ['pluginManager'] 并直接 ctx.pluginManager.installBundle(...)），
 *   所以走 Host 更稳，且不依赖客户端 inject 细节。
 *
 * 端点（前缀 /api/dsh-perfect-ui-plugins）：
 *   GET  /status?name=<pkg>   → { ok, installed, version, available[], latest }
 *   POST /install  {name}     → { ok, status, version, alreadyInstalled, message }
 *
 * 关键语义（app.asar 实测原文）：
 *   「installBundle() refuses a package that is already installed with
 *    `already-installed`, before pnpm runs, when the spec names it」
 *   → 已装包再调 install 会直接报 already-installed，所以 status 先查、install 再动。
 *   「Official bundles follow the DSH version and are not listed」→ listVersions 对官方包不适用。
 */

const PLUGIN_BASE = '/api/dsh-perfect-ui-plugins'

/** 与客户端同源的围栏：只接受本机回环、非跨站请求。 */
function trustedLocal(req) {
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
  try { return new URL(origin).host === hostUrl.host } catch { return false }
}

function send(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

function errText(e) {
  if (!e) return '未知错误'
  if (typeof e === 'string') return e
  const msg = e.message || String(e)
  return e.code ? `${msg} [${e.code}]` : msg
}

/**
 * 读某个包在 profile 里的状态。
 * listBundles 的每一行含 name / installed / version / availability 等
 * （描述原文：Package versions, manifest descriptions, the installable spec of
 *  profile dependencies, rows, optional display metadata, activation selections,
 *  whether the installation offers the bundle, and removal availability.）
 * 字段名在不同版本可能微调，所以这里做容错取值。
 */
async function readPackageState(pm, name) {
  let bundles = []
  try {
    const raw = await pm.listBundles()
    bundles = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.bundles) ? raw.bundles : [])
  } catch {
    bundles = []
  }
  const row = bundles.find((b) => b && (b.name === name || b.packageName === name)) || null
  if (!row) return { installed: false, version: '', row: null, bundles }
  return {
    installed: row.installed === true || row.availability === 'profile' || row.availability === 'installation' || row.version !== undefined,
    version: row.version || '',
    row,
    bundles,
  }
}

/** 查该包有没有比已装版本更新的发布版（官方 bundle 不列出，返回空）。 */
async function readVersions(pm, name) {
  try {
    const raw = await pm.listVersions(name)
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.versions) ? raw.versions : [])
    return list.map((v) => (typeof v === 'string' ? v : v && v.version)).filter(Boolean)
  } catch {
    return []
  }
}

export function registerPluginRoutes(ctx) {
  if (!ctx || typeof ctx.webServer?.register !== 'function') return undefined
  return ctx.webServer.register({
    kind: 'prefix',
    path: PLUGIN_BASE,
    handler: (req, res) => {
      let sub = '/'
      try {
        sub = new URL(req.url ?? '/', 'http://x').pathname.slice(PLUGIN_BASE.length).replace(/\/+$/u, '') || '/'
      } catch { /* keep '/' */ }
      void handle(sub, req, res).catch((e) => {
        send(res, 500, { ok: false, error: errText(e) })
      })
    },
  })

  async function handle(sub, req, res) {
    if (!trustedLocal(req)) return send(res, 403, { ok: false, error: 'forbidden: untrusted request' })

    /* pluginManager 服务：Host 侧标准服务。缺失时如实说明（例如 dsh web 无管理器）。 */
    let pm = null
    try { pm = ctx.get ? ctx.get('pluginManager') : ctx.pluginManager } catch { pm = null }
    if (!pm && ctx.pluginManager) { try { pm = ctx.pluginManager } catch { pm = null } }

    if (sub === '/status') {
      if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method not allowed' })
      let name = ''
      try { name = new URL(req.url ?? '/', 'http://x').searchParams.get('name') || '' } catch { name = '' }
      if (!name) return send(res, 400, { ok: false, error: 'missing name' })
      if (!pm || typeof pm.listBundles !== 'function') {
        return send(res, 200, { ok: false, error: '宿主没有 pluginManager 服务，无法检查安装状态', available: false })
      }
      const state = await readPackageState(pm, name)
      const versions = state.installed ? await readVersions(pm, name) : []
      return send(res, 200, {
        ok: true,
        available: true,
        installed: state.installed,
        version: state.version,
        newer: versions,
        latest: versions[0] || state.version || '',
      })
    }

    if (sub === '/install') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' })
      let body = ''
      for await (const chunk of req) body += chunk
      let name = ''
      try { name = (JSON.parse(body || '{}').name || '').trim() } catch { name = '' }
      if (!name) return send(res, 400, { ok: false, error: 'missing name' })
      if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name)) {
        return send(res, 400, { ok: false, error: `not a package name: ${name}` })
      }
      if (!pm || typeof pm.installBundle !== 'function') {
        return send(res, 200, { ok: false, error: '宿主没有 pluginManager.installBundle，无法安装' })
      }
      /* 先查状态：已装就不再让 pnpm 跑一遍（会报 already-installed 且重载该插件）。 */
      const before = await readPackageState(pm, name)
      if (before.installed) {
        const versions = await readVersions(pm, name)
        return send(res, 200, {
          ok: true,
          status: 'already-installed',
          alreadyInstalled: true,
          version: before.version,
          newer: versions,
          latest: versions[0] || before.version || '',
          message: versions.length
            ? `已安装 v${before.version}，有可用更新 v${versions[0]}`
            : `已安装 v${before.version}（已是最新）`,
        })
      }
      try {
        const result = await pm.installBundle(name, { enabled: true })
        const after = await readPackageState(pm, name)
        return send(res, 200, {
          ok: true,
          status: (result && result.status) || 'done',
          alreadyInstalled: false,
          version: after.version || (result && result.version) || '',
          application: (result && result.application) || null,
          warnings: (result && Array.isArray(result.warnings)) ? result.warnings : [],
          message: '安装完成',
        })
      } catch (e) {
        /* already-installed 竞态（status 查询与安装之间被别人装了）也要如实处理 */
        const msg = errText(e)
        if (/already-installed/i.test(msg)) {
          const after = await readPackageState(pm, name)
          return send(res, 200, {
            ok: true,
            status: 'already-installed',
            alreadyInstalled: true,
            version: after.version,
            message: '该插件已安装',
          })
        }
        return send(res, 200, { ok: false, error: `安装失败：${msg}` })
      }
    }

    /* ---- 依赖插件：确保存在（联动安装） ----
       用途：本插件的「上下文压缩」按钮依赖 dsh-ctx-trim 的 Host 路由。
       本插件是 link: 安装、没有自己的 node_modules，所以在 package.json 里
       声明 dependencies 不会被 pnpm 装到 profile —— 必须在这里显式安装。

       语义（三个动作合一）：
         required=true（默认）→ 未装则安装最新版；已装则只回报版本
         required=false        → 只查询，不安装（供设置页做「状态检查」）

       返回字段与 /install 一致，便于前端复用同一套渲染逻辑。 */
    if (sub === '/ensure') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' })
      let body = ''
      for await (const chunk of req) body += chunk
      let name = '', required = true
      try {
        const parsed = JSON.parse(body || '{}')
        name = String(parsed.name || '').trim()
        required = parsed.required !== false
      } catch { /* name 保持空 */ }
      if (!name) return send(res, 400, { ok: false, error: 'missing name' })
      if (!pm || typeof pm.listBundles !== 'function') {
        return send(res, 200, { ok: false, error: '宿主没有 pluginManager 服务，无法检查依赖' })
      }

      const before = await readPackageState(pm, name)
      if (before.installed) {
        const versions = await readVersions(pm, name)
        return send(res, 200, {
          ok: true,
          installed: true,
          justInstalled: false,
          version: before.version,
          newer: versions,
          latest: versions[0] || before.version || '',
        })
      }
      /* 未安装 */
      if (!required) {
        return send(res, 200, { ok: true, installed: false, justInstalled: false, version: '', message: '未安装' })
      }
      if (typeof pm.installBundle !== 'function') {
        return send(res, 200, { ok: false, installed: false, error: '宿主没有 pluginManager.installBundle，无法联动安装' })
      }
      try {
        const result = await pm.installBundle(name, { enabled: true })
        const after = await readPackageState(pm, name)
        return send(res, 200, {
          ok: true,
          installed: true,
          justInstalled: true,
          version: after.version || (result && result.version) || '',
          application: (result && result.application) || null,
          warnings: (result && Array.isArray(result.warnings)) ? result.warnings : [],
          message: '已自动安装最新版',
        })
      } catch (e) {
        const msg = errText(e)
        if (/already-installed/i.test(msg)) {
          const after = await readPackageState(pm, name)
          return send(res, 200, {
            ok: true, installed: true, justInstalled: false,
            version: after.version, message: '该插件已安装',
          })
        }
        return send(res, 200, { ok: false, installed: false, error: `联动安装失败：${msg}` })
      }
    }

    return send(res, 404, { ok: false, error: `no dsh-perfect-ui-plugins endpoint ${sub}` })
  }
}

export const PLUGINS_BASE_PATH = PLUGIN_BASE
