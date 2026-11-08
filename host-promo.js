/**
 * 广告/推广内容 Host 半边：远程 HTML 拉取 + GitHub 更新检查。
 *
 * 为什么必须走 Host：
 *   客户端半边受 Cordis trap 限制（fetch 被包装），且浏览器同源策略会拦跨域
 *   请求；Host 是 Node 进程，可以自由出网。所以所有远程内容都经这里代理。
 *
 * 端点（前缀 /api/dsh-perfect-ui-promo）：
 *   GET /raw?url=<encoded>                              → { ok, html, contentType, bytes, fetchedAt }
 *   GET /github?owner=&repo=&path=&branch=&fallback=    → { ok, html, sha, message, date, rawUrl, updated }
 *   GET /check?owner=&repo=&path=&branch=               → { ok, sha, message, date }（只查是否更新，不拉正文）
 *
 * 安全边界（三条都必须有，否则就是 SSRF / XSS 入口）：
 *   1. 域名白名单 —— 只允许 raw.githubusercontent.com / gist.githubusercontent.com /
 *      github.com 的 raw 路径，以及用户显式登记的自定义源。拒绝内网地址、
 *      拒绝 file:// / localhost / 私有 IP（否则可被用来探测本机服务）。
 *   2. 大小上限 —— 单次响应最大 512KB，超了直接拒绝，避免拖垮渲染进程。
 *   3. 只回文本 —— 不落盘、不执行；客户端拿到的 HTML 放进 sandbox iframe，
 *      不给 allow-scripts，因此远程脚本无法在宿主上下文执行。
 */

import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const PROMO_BASE = '/api/dsh-perfect-ui-promo'

/* ---- 远程文件缓存（落盘）----
   目的：广告位每次打开都重新拉 158KB 的 ad.html，加载很慢。
   做法：按 owner/repo/path/branch 缓存「正文 + 最新 sha」到插件目录下的
        .promo-cache/，每次请求先查 sha（api.github.com，响应极小），
        sha 没变就直接读盘返回，**省掉正文下载**。

   为什么落盘而不是内存（用户要求）：
     · 内存缓存 158KB×6 ≈ 1MB 会一直常驻进程；磁盘占用更可接受
     · 跨 DSH 重启自动复用，启动预热也不必重新下载
     · 卸载插件时随包删除，不会留下垃圾

   目录位置：与 host-promo.js 同目录的 .promo-cache/
   文件名：key 的 sha256（前 32 位），避免路径穿越与超长文件名 */

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.promo-cache')
const CACHE_MAX_FILES = 6
const CACHE_DIR_READY = { done: false }

function ensureCacheDir() {
  if (CACHE_DIR_READY.done) return true
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    CACHE_DIR_READY.done = true
    return true
  } catch {
    return false
  }
}

function cacheKey(owner, repo, filePath, branch) {
  return owner + '/' + repo + '/' + branch + '/' + filePath
}

function cacheFile(key) {
  const h = createHash('sha256').update(key).digest('hex').slice(0, 32)
  return join(CACHE_DIR, h + '.json')
}

function cacheGet(key) {
  if (!ensureCacheDir()) return null
  const file = cacheFile(key)
  try {
    const raw = readFileSync(file, 'utf8')
    const entry = JSON.parse(raw)
    /* 校验：必须是我们写的那条（防手工改坏 / key 冲突） */
    if (!entry || entry.key !== key || typeof entry.html !== 'string') return null
    return entry
  } catch {
    return null
  }
}

function cacheSet(key, entry) {
  if (!ensureCacheDir()) return
  const file = cacheFile(key)
  try {
    writeFileSync(file, JSON.stringify({ ...entry, key }), 'utf8')
    pruneCache()
  } catch {
    /* 磁盘满 / 权限不足：静默降级为无缓存，功能不受影响 */
  }
}

/* 超过上限时按 mtime 删最旧的，控制目录体积 */
function pruneCache() {
  try {
    const files = readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const full = join(CACHE_DIR, f)
        let mt = 0
        try { mt = statSync(full).mtimeMs } catch { mt = 0 }
        return { full, mt }
      })
      .sort((a, b) => a.mt - b.mt)          /* 最旧在前 */
    while (files.length > CACHE_MAX_FILES) {
      const victim = files.shift()
      try { unlinkSync(victim.full) } catch { /* 已被删 */ }
    }
  } catch { /* 目录读不到：放弃清理 */ }
}

/** 允许的远程主机（严格白名单）。自定义源需显式登记到这里。 */
const ALLOWED_HOSTS = new Set([
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'objects.githubusercontent.com',
])

const MAX_BYTES = 512 * 1024
/* 超时放到 20s：实测本机到 raw.githubusercontent.com 单次 1.3s 左右，
   但偶发会到 10s+（实测出现过一次 abort）。12s 太紧，会误报失败。 */
const FETCH_TIMEOUT_MS = 20000

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
  return e.message || String(e)
}

/**
 * 校验远程 URL。返回 { ok, url } 或 { ok:false, reason }。
 * 逐条拒绝可疑形态：非 http(s)、非白名单主机、指向私有/回环地址。
 */
function validateRemote(raw) {
  let u
  try { u = new URL(String(raw)) } catch { return { ok: false, reason: '不是合法 URL' } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { ok: false, reason: '只允许 http/https' }
  }
  /* 域名白名单 */
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    return { ok: false, reason: `不在允许列表（${[...ALLOWED_HOSTS].join(' / ')}）` }
  }
  /* 白名单内也不会是私有地址，但保留兜底检查（防 DNS 重绑定后的解析结果） */
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.|::1$|localhost$)/i.test(u.hostname)) {
    return { ok: false, reason: '不允许内网地址' }
  }
  return { ok: true, url: u }
}

/** 拉取文本，带超时与大小上限。 */
async function fetchText(url, accept) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: accept || 'text/plain, text/html', 'user-agent': 'dsh-perfect-ui-promo' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    /* Content-Length 先挡一次，避免白下载 */
    const len = Number(res.headers.get('content-length') || 0)
    if (len && len > MAX_BYTES) throw new Error(`响应过大（${Math.round(len / 1024)}KB > ${MAX_BYTES / 1024}KB）`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error(`响应过大（${Math.round(buf.length / 1024)}KB）`)
    return { text: buf.toString('utf8'), contentType: res.headers.get('content-type') || '', bytes: buf.length }
  } finally {
    clearTimeout(timer)
  }
}

/** GitHub raw URL 构造。branch 缺省 main（再回退 master）。 */
function githubRawUrl(owner, repo, filePath, branch) {
  const b = branch || 'main'
  const clean = String(filePath || '').replace(/^\/+/, '')
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(b)}/${clean.split('/').map(encodeURIComponent).join('/')}`
}

/** 查最新 commit（用于「是否有更新」）。GitHub API 匿名可用但有速率限制。 */
async function githubLatestCommit(owner, repo, filePath, branch) {
  const b = branch || 'main'
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`
    + `?path=${encodeURIComponent(String(filePath || '').replace(/^\/+/, ''))}`
    + `&sha=${encodeURIComponent(b)}&per_page=1`
  /* 重试两次：实测本机到 api.github.com 偶发超时（一次 abort），
     而 pnpm/GitHub 的匿名速率限制也会给 403/429。重试能明显降低误报率；
     仍失败就返回 null —— 前端会把 sha/date 当可选信息，不影响正文渲染。 */
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(api, {
        signal: controller.signal,
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'dsh-perfect-ui-promo',
          'x-github-api-version': '2022-11-28',
        },
      })
      if (res.status === 403 || res.status === 429) return null   /* 限流：不重试，省配额 */
      if (!res.ok) continue
      const arr = await res.json()
      const c = Array.isArray(arr) && arr[0] ? arr[0] : null
      if (!c) return null
      return {
        sha: c.sha || '',
        message: (c.commit && c.commit.message) || '',
        date: (c.commit && c.commit.committer && c.commit.committer.date) || '',
      }
    } catch {
      /* 超时/网络错误 → 下一轮重试 */
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

/** 解析查询参数（req.url 只带 path+query）。 */
function queryOf(req) {
  try { return new URL(req.url ?? '/', 'http://x').searchParams } catch { return new URLSearchParams() }
}

export function registerPromoRoutes(ctx) {
  if (!ctx || typeof ctx.webServer?.register !== 'function') return undefined

  /* ---- 启动预热：把已知推广位的内容先拉进缓存 ----
     目的：插件安装/重装后第一次打开广告 TAB 就要快。
     做法：不阻塞路由注册，失败也不影响运行。
     哪些预热？由客户端 PROMOS 决定，但 Host 侧不知道它的内容 ——
     所以用环境变量/固定清单两种都不合适。折中：
     预热的清单写在这里（与 settings.js 的 PROMOS 对应），
     改了广告源要同步改这里；不一致时只是没预热，功能不受影响。 */
  const WARM = [
    { owner: 'Tangerine-Living', repo: 'AD', path: 'dsh-perfect-ui/ad.html', branch: 'main' },
  ]

  Promise.resolve().then(async () => {
    for (const w of WARM) {
      const key = cacheKey(w.owner, w.repo, w.path, w.branch)
      /* 磁盘上已有就不再拉 —— 这正是落盘缓存的额外好处：
         DSH 重启后预热几乎零成本 */
      if (cacheGet(key)) continue
      try {
        const latest = await githubLatestCommit(w.owner, w.repo, w.path, w.branch)
        const sha = latest ? latest.sha : ''
        if (!sha) continue
        const rawUrl = githubRawUrl(w.owner, w.repo, w.path, w.branch)
        const v = validateRemote(rawUrl)
        if (!v.ok) continue
        const r = await fetchText(v.url.href, 'text/html, text/plain')
        cacheSet(key, {
          html: r.text,
          contentType: r.contentType,
          bytes: r.bytes,
          sha: sha,
          fetchedAt: new Date().toISOString(),
        })
        ctx.logger?.info?.('promo: 预热缓存 ' + key + ' (' + r.bytes + ' bytes)')
      } catch (e) {
        /* 预热失败不报错：第一次真正请求时会正常拉取 */
        ctx.logger?.debug?.('promo: 预热失败 ' + key + ' — ' + errText(e))
      }
    }
  })

  return ctx.webServer.register({
    kind: 'prefix',
    path: PROMO_BASE,
    handler: (req, res) => {
      let sub = '/'
      try {
        sub = new URL(req.url ?? '/', 'http://x').pathname.slice(PROMO_BASE.length).replace(/\/+$/u, '') || '/'
      } catch { /* keep '/' */ }
      void handle(sub, req, res).catch((e) => send(res, 500, { ok: false, error: errText(e) }))
    },
  })

  async function handle(sub, req, res) {
    if (!trustedLocal(req)) return send(res, 403, { ok: false, error: 'forbidden: untrusted request' })
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method not allowed' })
    const q = queryOf(req)

    /* ---- 任意白名单 URL 直拉 ---- */
    if (sub === '/raw') {
      const target = q.get('url') || ''
      if (!target) return send(res, 400, { ok: false, error: 'missing url' })
      const v = validateRemote(target)
      if (!v.ok) return send(res, 403, { ok: false, error: 'URL 被拒绝：' + v.reason })
      try {
        const r = await fetchText(v.url.href, 'text/html, text/plain')
        return send(res, 200, {
          ok: true, html: r.text, contentType: r.contentType, bytes: r.bytes,
          url: v.url.href, fetchedAt: new Date().toISOString(),
        })
      } catch (e) {
        return send(res, 200, { ok: false, error: '拉取失败：' + errText(e) })
      }
    }

    /* ---- GitHub 文件 ---- */
    if (sub === '/github') {
      const owner = String(q.get('owner') || '').trim()
      const repo = String(q.get('repo') || '').trim()
      const filePath = String(q.get('path') || '').trim()
      const branch = String(q.get('branch') || 'main').trim() || 'main'
      if (!owner || !repo || !filePath) {
        return send(res, 400, { ok: false, error: 'missing owner/repo/path' })
      }
      /* 只允许仓库名与路径的保守字符集，防注入到 URL 拼接 */
      if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
        return send(res, 400, { ok: false, error: 'invalid owner/repo' })
      }
      if (!/^[A-Za-z0-9._\/-]+$/.test(filePath)) {
        return send(res, 400, { ok: false, error: 'invalid path' })
      }
      const rawUrl = githubRawUrl(owner, repo, filePath, branch)
      const v = validateRemote(rawUrl)
      if (!v.ok) return send(res, 403, { ok: false, error: 'URL 被拒绝：' + v.reason })

      const key = cacheKey(owner, repo, filePath, branch)
      try {
        /* ---- 第一步：只查 sha（轻量，响应几百字节）---- */
        const latest = await githubLatestCommit(owner, repo, filePath, branch)
        const sha = latest ? latest.sha : ''
        const cached = sha ? cacheGet(key) : null

        /* ---- 命中：sha 与缓存一致 → 直接返回缓存正文，不下载 ---- */
        if (cached && sha && cached.sha === sha) {
          return send(res, 200, {
            ok: true,
            html: cached.html,
            contentType: cached.contentType,
            bytes: cached.bytes,
            rawUrl: v.url.href,
            sha: sha,
            message: latest ? latest.message : '',
            date: latest ? latest.date : '',
            cached: true,                 /* 前端可据此显示「来自缓存」 */
            fetchedAt: cached.fetchedAt,
          })
        }

        /* ---- 未命中或 sha 变了：才拉正文 ---- */
        let r
        let usedUrl = v.url.href
        try {
          r = await fetchText(v.url.href, 'text/html, text/plain')
        } catch (e) {
          /* main 分支 404 时自动回退 master（老仓库常见） */
          if (branch === 'main') {
            const fallbackUrl = githubRawUrl(owner, repo, filePath, 'master')
            const v2 = validateRemote(fallbackUrl)
            if (v2.ok) { r = await fetchText(v2.url.href, 'text/html, text/plain'); usedUrl = v2.url.href }
            else throw e
          } else throw e
        }

        const entry = {
          html: r.text,
          contentType: r.contentType,
          bytes: r.bytes,
          sha: sha,
          fetchedAt: new Date().toISOString(),
        }
        if (sha) cacheSet(key, entry)

        return send(res, 200, {
          ok: true,
          html: r.text,
          contentType: r.contentType,
          bytes: r.bytes,
          rawUrl: usedUrl,
          sha: sha,
          message: latest ? latest.message : '',
          date: latest ? latest.date : '',
          cached: false,
          fetchedAt: entry.fetchedAt,
        })
      } catch (e) {
        return send(res, 200, { ok: false, error: '拉取失败：' + errText(e) })
      }
    }

    /* ---- 只查更新（不拉正文，轻量轮询用） ---- */
    if (sub === '/check') {
      const owner = String(q.get('owner') || '').trim()
      const repo = String(q.get('repo') || '').trim()
      const filePath = String(q.get('path') || '').trim()
      const branch = String(q.get('branch') || 'main').trim() || 'main'
      if (!owner || !repo || !filePath) return send(res, 400, { ok: false, error: 'missing owner/repo/path' })
      if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
        return send(res, 400, { ok: false, error: 'invalid owner/repo' })
      }
      const latest = await githubLatestCommit(owner, repo, filePath, branch)
      if (!latest) return send(res, 200, { ok: false, error: '无法读取提交信息（可能是仓库不存在或 API 限流）' })
      return send(res, 200, { ok: true, sha: latest.sha, message: latest.message, date: latest.date })
    }

    /* ---- 端点说明（便于手工核对白名单） ---- */
    if (sub === '/info') {
      return send(res, 200, {
        ok: true,
        endpoints: ['/raw?url=', '/github?owner=&repo=&path=&branch=', '/check?owner=&repo=&path=&branch='],
        allowedHosts: [...ALLOWED_HOSTS],
        maxBytes: MAX_BYTES,
        timeoutMs: FETCH_TIMEOUT_MS,
      })
    }

    return send(res, 404, { ok: false, error: `no dsh-perfect-ui-promo endpoint ${sub}` })
  }
}

export const PROMO_BASE_PATH = PROMO_BASE
export const PROMO_ALLOWED_HOSTS = ALLOWED_HOSTS
export const PROMO_MAX_BYTES = MAX_BYTES
