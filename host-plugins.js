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
 *   GET  /status?name=<pkg>   → { ok, installed, version, canUpdate, latest, newer,
 *                                 blocked[], candidate, offered, reason }
 *   POST /install  {name}     → { ok, status, version, alreadyInstalled, message }
 *   POST /update   {name, version} → { ok, from, to, step, message }
 *   POST /ensure   {name, required} → 依赖兜底安装
 *
 * 「可更新到哪个版本」严格照宿主官方口径（见下方 updateCandidate 注释）：
 *   listVersions 必须 listed，且版本要声明 dsh.bundle、与当前 DSH 兼容、非废弃、非预发布。
 *   官方更新入口是 updateBundle(name, version)，不是 installBundle ——
 *   installBundle 对已装包会在 pnpm 跑之前就报 already-installed（这也是旧版
 *   「更新」按钮永远只回 already-installed、版本一直不变的原因）。
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

/* ---------------- 版本判定：与 DSH 官方逐字同口径 ----------------
 * 依据（本机 app.asar 内 @deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js 原文）：
 *
 *   function updateCandidate(list) {
 *     if (list.status !== `listed`) return void 0
 *     return list.versions.find((version) =>
 *       installable(version) && version.deprecated === void 0 && !version.prerelease)
 *   }
 *   function installable(version) { return version.bundle && version.incompatible === void 0 }
 *
 * 也就是说「可更新到 X」必须同时成立：
 *   · listVersions 的状态是 listed（refused = 官方随 DSH 走 / Git 安装 / 不可更新）
 *   · X 声明了 dsh.bundle（否则装上也只是一堆没接线的东西）
 *   · X 与「当前运行的 DSH」兼容（宿主对不兼容版本只标注 incompatible，不剔除）
 *   · X 未被标记废弃、不是预发布
 * 旧实现直接把 versions[0] 当「可更新到」，于是把不兼容的新版本报成可更新，
 * 与 DSH 自己的判断（仍认为已装版本是最新）分叉 —— 这就是「检测源不一致」的根因。
 * Host 契约（同包 lib/index.js listVersions）返回的是对象不是数组：
 *   { status:'listed', installed, registry, attempts, versions:[{version, publishedAt,
 *     tags, prerelease, bundle, deprecated?, incompatible?}], omitted }
 *   | { status:'refused', problem, reason, attempts }
 */

/** 官方 installable() 的同名判据。 */
function installable(v) {
  return !!(v && v.bundle && v.incompatible === undefined)
}

/** 官方的「最新可安装版本」：列表是新的在前，取第一个能装的；没有则 null。 */
function updateCandidate(list) {
  if (!list || list.status !== 'listed') return null
  const versions = Array.isArray(list.versions) ? list.versions : []
  return versions.find((v) => installable(v) && v.deprecated === undefined && !v.prerelease) || null
}

/**
 * 比已装版本新、但按官方口径不能装的那些，用于如实解释「为什么没有更新」。
 * 列表新的在前，遇到第一个能装的即可停止（更老的阻塞项不影响当前判断）。
 */
function blockedVersions(list) {
  if (!list || list.status !== 'listed') return []
  const versions = Array.isArray(list.versions) ? list.versions : []
  const out = []
  for (const v of versions) {
    if (!v || typeof v.version !== 'string') continue
    if (installable(v) && v.deprecated === undefined && !v.prerelease) break
    let reason = '不可安装'
    if (v.incompatible !== undefined) reason = '需要更新 DSH'
    else if (v.deprecated !== undefined) reason = '已标记废弃'
    else if (v.prerelease) reason = '预发布版'
    else if (!v.bundle) reason = '未声明 dsh.bundle'
    out.push({ version: v.version, reason })
    if (out.length >= 5) break
  }
  return out
}

/** 读版本清单（官方返回对象），任何异常都退化成「查不到」。 */
async function readVersionList(pm, name) {
  let raw
  try {
    raw = await pm.listVersions(name)
  } catch (e) {
    return { status: 'failed', problem: 'error', reason: errText(e), installed: '', versions: [] }
  }
  if (!raw || typeof raw !== 'object') return { status: 'listed', installed: '', versions: [] }
  const list = Array.isArray(raw) ? { versions: raw } : raw
  const versions = Array.isArray(list.versions) ? list.versions : []
  return {
    status: typeof list.status === 'string' ? list.status : 'listed',
    installed: typeof list.installed === 'string' ? list.installed : '',
    registry: list.registry,
    problem: list.problem,
    reason: list.reason,
    versions: versions.filter((v) => v && typeof v.version === 'string'),
  }
}

/** 把行状态 + 版本清单折算成前端要的判定（/status 与 /ensure 共用）。 */
function updateSummary(row, list) {
  const candidate = updateCandidate(list)
  const blocked = blockedVersions(list)
  const offered = row && typeof row.update === 'string' ? row.update : ''
  return {
    newer: (list.versions || []).map((v) => v.version),
    candidate: candidate ? {
      version: candidate.version,
      publishedAt: candidate.publishedAt,
      bundle: candidate.bundle === true,
    } : null,
    /* 与官方一致：既要「有可安装的新版本」，还要宿主认为这个包可以走 registry 更新
       （官方包随 DSH 版本走、Git 安装、management-required 等都不给更新）。 */
    canUpdate: !!candidate && offered === 'registry',
    offered,
    latest: candidate ? candidate.version : '',
    blocked,
    listStatus: list.status,
    reason: list.status === 'listed' ? '' : (list.reason || ''),
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
      /* 版本检查只在已装时做：没装就没有「已安装 vX」可言，安装按钮直接装最新。 */
      const list = state.installed
        ? await readVersionList(pm, name)
        : { status: 'listed', installed: '', versions: [] }
      const upd = updateSummary(state.row, list)
      return send(res, 200, {
        ok: true,
        available: true,
        installed: state.installed,
        version: state.version,
        canUpdate: upd.canUpdate,
        offered: upd.offered,
        latest: upd.latest,
        newer: upd.newer,
        blocked: upd.blocked,
        listStatus: upd.listStatus,
        reason: upd.reason,
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
        const upd = updateSummary(before.row, await readVersionList(pm, name))
        return send(res, 200, {
          ok: true,
          status: 'already-installed',
          alreadyInstalled: true,
          version: before.version,
          canUpdate: upd.canUpdate,
          latest: upd.latest || before.version || '',
          newer: upd.newer,
          blocked: upd.blocked,
          message: upd.canUpdate
            ? `已安装 v${before.version}，可更新到 v${upd.latest}`
            : `已安装 v${before.version}（已是最新版本）`,
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

    /* ---- 更新：必须走宿主官方入口 updateBundle(name, version) ----
       installBundle 对已装包会在 pnpm 跑之前就 refused(already-installed)，
       所以旧版「更新」按钮点了也只会回 already-installed、版本一直不变。

       宿主原文：updateBundle「Replace an installed bundle with a newer version.
       A registry copy updates to name@version, checked on the registry first:
       it must exist, declare a bundle, and accept the running DSH version,
       or nothing changes.」
       返回 { from, to, step, result }；result.application 为 'applied' 或
       'restart-required' 才算生效，失败时 result.error.diagnostic 是原文原因。 */
    if (sub === '/update') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' })
      let body = ''
      for await (const chunk of req) body += chunk
      let name = ''
      try { name = String(JSON.parse(body || '{}').name || '').trim() } catch { name = '' }
      if (!name) return send(res, 400, { ok: false, error: 'missing name' })
      if (!pm || typeof pm.updateBundle !== 'function') {
        return send(res, 200, { ok: false, error: '宿主没有 pluginManager.updateBundle，无法更新' })
      }
      const before = await readPackageState(pm, name)
      if (!before.installed) return send(res, 200, { ok: false, error: `未安装 ${name}，请先安装` })
      /* 目标版本由 Host 自己按官方口径算，不采信前端传值（避免装到不兼容的版本）。 */
      const upd = updateSummary(before.row, await readVersionList(pm, name))
      if (!upd.canUpdate) {
        const why = upd.blocked.length
          ? `没有可安装的更新：${upd.blocked.map((b) => `v${b.version} ${b.reason}`).join('，')}`
          : (upd.offered === 'git'
            ? '该插件来自 Git 安装，更新需重新安装'
            : '已是最新版本（或该插件随 DSH 版本更新）')
        return send(res, 200, { ok: false, error: why, blocked: upd.blocked })
      }
      const target = upd.latest
      try {
        const answer = await pm.updateBundle(name, target, {})
        const result = (answer && answer.result) || null
        const application = result && result.application
        if (application !== 'applied' && application !== 'restart-required') {
          const err = (result && result.error) || null
          const why = err ? (err.diagnostic || err.code || errText(err)) : '更新未生效'
          return send(res, 200, {
            ok: false,
            from: (answer && answer.from) || before.version,
            to: target,
            step: (answer && answer.step) || 'install',
            error: `更新到 v${target} 失败：${why}`,
          })
        }
        const after = await readPackageState(pm, name)
        return send(res, 200, {
          ok: true,
          from: (answer && answer.from) || before.version,
          to: after.version || target,
          step: (answer && answer.step) || 'install',
          application,
          needsRestart: application === 'restart-required',
          message: `已更新 v${(answer && answer.from) || before.version} → v${after.version || target}`,
        })
      } catch (e) {
        return send(res, 200, { ok: false, error: `更新失败：${errText(e)}` })
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
        const upd = updateSummary(before.row, await readVersionList(pm, name))
        return send(res, 200, {
          ok: true,
          installed: true,
          justInstalled: false,
          version: before.version,
          canUpdate: upd.canUpdate,
          newer: upd.newer,
          latest: upd.latest || before.version || '',
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
