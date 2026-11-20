/* dsh-perfect-ui — 生成产物，请勿手工编辑。
   源文件：theme-tokens.js + features.js + power.js + model.js + actions.js + session.js
           + vendor-skill-market-client.js（复刻 @montersy123/dsh-skill-market v2.0.7，MIT）
   重新生成：node build.js */

/* 技能市场 Client 半边在**顶层**内联，不缩进：
   它的模块体里有大量多行模板字面量，任何整体缩进都会改变模板内容。 */
/**
 * dsh-skill-market — Client (browser) half.
 *
 * A lazy `window.__ModuleLoader__` factory: running this file registers the
 * factory only; the body executes when the module is first materialised.
 *
 * The UI is the `DeepSeek-技能市场原型` design (`harness-skill-marketplace.html`)
 * ported into a Harness global panel: the prototype's token table, type scale,
 * spacing rhythm, component states and motion are reproduced verbatim, while its
 * data comes from the SkillHub API through this plugin's same-origin Host proxy
 * (`/skill-market/api/*`) instead of the prototype's placeholder array.
 *
 * Deliberate deviations from the prototype, all of them because the Harness
 * shell already owns the thing the prototype drew:
 *   - no brand sidebar, no window chrome (the shell's own columns are adjacent);
 *   - no fabricated star ratings, reviews or changelogs: SkillHub publishes
 *     score, downloads, stars, tags and versions, so the inspector shows those;
 *   - the prototype's placeholder install flow becomes a local library the user
 *     owns, persisted in this plugin's own data directory (`data/panel.json`, via
 *     the Host half) rather than in the shell's Web Storage.
 *
 * @see https://skillhub.cn/skills?sortBy=score
 */
/* 复刻说明（本插件作者追加）：
   原文件把模块注册成包名 @montersy123/dsh-skill-market 的懒加载 factory。
   一个页面只能按包名注册一个客户端模块，而本包的注册名是 @local/dsh-perfect-ui，
   所以这里把 factory 提为具名函数，由本包的 factory 内部调用并把 require 原样传入。
   模块体本身逐字保留，未作改写。
*/
function PU_skillMarketFactory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * The host's own markdown and code renderer, when this build has it.
     *
     * `@deepseek-ai/dsh-client-ui-primitives` sits in the web boot's static module registry, so a plugin
     * can require it directly: `MarkdownText` renders markdown the way the conversation does, and
     * `CodeBlock` renders highlighted code through shiki with the host theme's `--shiki-*` palette. Using
     * them means a file preview matches the rest of Harness instead of being the one place that shows
     * plain text. The require is guarded — a build without the package falls back to this panel's own
     * small renderer — and an error boundary keeps a host component from taking the panel down with it.
     */
    const primitives = (() => {
      try { return require('@deepseek-ai/dsh-client-ui-primitives') ?? null } catch { return null }
    })()
    const HostMarkdown = primitives?.MarkdownText ?? null
    const HostDelegateProvider = primitives?.MarkdownDelegateProvider ?? null
    /**
     * The host's highlighter hook: `useCodeHighlighter(lang)` returns `code => lines | undefined`, where a line
     * is a list of `{text, style}` tokens and `undefined` means the grammar is still loading.
     *
     * The panel uses it directly rather than through the host's `CodeBlock`, because that component gates
     * highlighting on an IntersectionObserver of its own: inside a dialog its block often never registers as
     * visible, the grammar is never requested, and the first file a reader opens stays plain until some other
     * render nudges it — which is exactly the "colours appear only after I follow a link" behaviour. The hook
     * subscribes to the same loader, so it re-renders by itself the moment the grammar arrives.
     */
    const HostHighlighter = primitives?.useCodeHighlighter ?? null

    /**
     * Renders `fallback` instead of `children` when a host component throws.
     *
     * The failure state clears when `resetKey` changes. A host renderer that throws once — while its grammar
     * or its styles are still arriving — would otherwise leave this boundary failed for the life of the
     * component, and every later file would render through the fallback even though the host recovered.
     */
    class HostFallback extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidUpdate(previous) {
        if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
      }

      render() {
        return this.state.failed ? this.props.fallback : this.props.children
      }
    }

    /**
     * The shiki language a bundle path implies, or undefined when the extension says nothing useful.
     * An unknown extension simply passes nothing on, and the block then renders as plain text rather than
     * guessing at a grammar.
     */
    const CODE_LANGUAGES = {
      js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
      ts: 'typescript', tsx: 'tsx', json: 'json', py: 'python', rb: 'ruby',
      go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
      c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php',
      sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell',
      yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', css: 'css',
      html: 'html', xml: 'xml', svg: 'xml', sql: 'sql', lua: 'lua',
      pl: 'perl', r: 'r', diff: 'diff', patch: 'diff',
    }
    /** @param {string} path - Path inside the bundle. @returns {string|undefined} shiki language. */
    function codeLanguageFor(path) {
      const name = String(path ?? '').split('/').pop() ?? ''
      const dot = name.lastIndexOf('.')
      if (dot < 0) return undefined
      return CODE_LANGUAGES[name.slice(dot + 1).toLowerCase()]
    }

    /** Code as plain text: what a build without the host's highlighter gets. */
    function PlainCode({ code }) {
      return h('pre', { className: 'sm-preview-code' }, h('code', null, code))
    }

    /**
     * Code coloured by the host's highlighter hook.
     *
     * `useCodeHighlighter(lang)` returns `undefined` until its grammar finishes loading and re-renders by
     * itself when it does, so the block colours itself as soon as the grammar arrives — no observer, no
     * scroll, no second render needed.
     *
     * @param {{code: string, lang?: string}} props - Source text and its shiki language.
     * @returns {object} Element.
     */
    function HighlightedCode({ code, lang }) {
      const highlight = HostHighlighter(lang)
      const lines = highlight(code)
      if (lines === undefined) return h(PlainCode, { code })
      return h('pre', { className: 'sm-preview-code' }, h('code', null,
        lines.map((line, index) => h(React.Fragment, { key: index },
          index === 0 ? null : '\n',
          line.map((token, tokenIndex) => h('span', { key: tokenIndex, style: token.style }, token.text))))))
    }

    /** The body of a code file: highlighted when the host's highlighter is there, plain otherwise. */
    const CodeBody = HostHighlighter === null ? PlainCode : HighlightedCode

    /**
     * Resolve a markdown link against the file it appears in.
     *
     * Skill documents link to their own neighbours — `references/expert-topics.md`, `../SKILL.md` — and the
     * preview can follow those, but only inside the bundle: an absolute path, a URL with a scheme, or a
     * `..` that climbs out of the root is not a file of this skill and resolves to nothing.
     *
     * @param {string} baseFile - Path of the file that carries the link.
     * @param {string} href - Link target, as written.
     * @returns {string|undefined} Bundle-relative path, or undefined when the link does not address one.
     */
    function resolveBundlePath(baseFile, href) {
      const raw = String(href ?? '').trim().split('#')[0].split('?')[0]
      if (raw === '' || raw.startsWith('/') || raw.startsWith('\\') || /^[a-z][a-z\d+.-]*:/i.test(raw)) return undefined
      const segments = String(baseFile ?? '').split('/').slice(0, -1)
      for (const part of raw.split('/')) {
        if (part === '' || part === '.') continue
        if (part === '..') {
          if (segments.length === 0) return undefined
          segments.pop()
          continue
        }
        segments.push(part)
      }
      return segments.length === 0 ? undefined : segments.join('/')
    }

    /**
     * Markdown prose, rendered by the host when it is there.
     *
     * The panel's own renderer is a deliberate subset — headings, lists, code, tables, links — written when
     * there was nothing else to use. So every markdown surface goes through the host's `MarkdownText` first,
     * and the subset stays as the fallback for a build without the primitives package.
     *
     * A link to another file of the bundle is only clickable when `onOpenFile` says where it goes: the host
     * renderer asks its delegate provider for `openFile`, and without one it deliberately draws the link as
     * plain text. That is why the provider is mounted here rather than left to the shell.
     *
     * @param {{source: string, onOpenFile?: (href: string) => void}} props - Markdown and the file handler.
     * @returns {object} Element.
     */
    function Prose({ source, onOpenFile, resetKey }) {
      if (HostMarkdown === null) return h(Markdown, { source, onOpenFile })
      const body = h(HostFallback, {
        resetKey,
        fallback: h(Markdown, { source, onOpenFile }),
      }, h(HostMarkdown, { text: source }))
      if (HostDelegateProvider === null || onOpenFile === undefined) return body
      return h(HostDelegateProvider, { openFile: (path) => onOpenFile(path) }, body)
    }

    /** Locale namespace and the panel id shared by the sidebar entry and `main`. */
    const NS = '@montersy123/dsh-skill-market'
    const PANEL_ID = 'skill-market'
    /**
     * Which client build is live.
     *
     * The panel is delivered as one JS bundle, so a page that never reloaded keeps running an old build — and
     * from the inside that is indistinguishable from a stylesheet that lost a cascade fight. The file dialog
     * reports this marker in its footer only when its own typography demonstrably did not take effect, so the
     * next report says which of the two happened instead of leaving it to guesswork.
     */
    const BUILD = 'b21'

    /* ── generated locale block — edit lib/locale.js and run scripts/inline-client-locale.mjs ── */
    const CLIENT_NS = "@montersy123/dsh-skill-market"
    const ZH = {
      "action.cancel": "取消",
      "action.confirmInstall": "安装「{name}」",
      "action.detailFailed": "详情加载失败：{reason}",
      "action.disableNamed": "已停用「{name}」",
      "action.disableRestart": "已停用「{name}」，重启 DeepSeek Harness 后生效",
      "action.downgrade": "回退「{name}」到 v{version}？",
      "action.downgradeBody": "当前安装的是 v{current}。技能目录会被替换为该旧版本的完整文件。",
      "action.downgradeConfirm": "回退",
      "action.enableNamed": "已启用「{name}」",
      "action.enableRestart": "已启用「{name}」，重启 DeepSeek Harness 后生效",
      "action.importFailedNamed": "导入「{name}」失败：{reason}",
      "action.install": "安装",
      "action.installFailed": "安装「{name}」失败：{reason}",
      "action.installedDetail": "已安装「{name}」v{version}：{files} 个文件 → {directory}，重启 DeepSeek Harness 后生效",
      "action.installedNamed": "已安装「{name}」",
      "action.installingNamed": "正在安装「{name}」…",
      "action.installingVersion": "正在安装「{name}」v{version}…",
      "action.noInstallResult": "Host 未返回安装结果",
      "action.removeFromDisabled": "已从停用目录移除「{name}」，重启 DeepSeek Harness 后生效",
      "action.removedFromDisabled": "已从停用目录移除「{name}」",
      "action.savedNamed": "已收藏「{name}」",
      "action.toggleFailed": "切换「{name}」失败：{reason}",
      "action.tooLarge": "技能目录过大（{size} MB > {limit} MB）",
      "action.tooManyFiles": "文件数超出上限（{limit}）",
      "action.uninstall": "卸载",
      "action.uninstallBody": "技能目录会从磁盘删除，已停用的技能也会一并移除，卸载后需要重新下载才能恢复。",
      "action.uninstallDetail": "{directory}（{files} 个文件）",
      "action.uninstallDetailNoFiles": "{directory}",
      "action.uninstallFailed": "卸载「{name}」失败：{reason}",
      "action.uninstallNamed": "卸载 {name}",
      "action.uninstalledNamed": "已卸载「{name}」",
      "action.uninstalledRestart": "已卸载「{name}」，重启 DeepSeek Harness 后生效",
      "action.uninstalling": "卸载「{name}」？",
      "action.unsavedNamed": "已取消收藏「{name}」",
      "action.update": "更新",
      "action.updatedNamed": "已更新「{name}」",
      "action.updatedParked": "已更新「{name}」v{version}：{files} 个文件已写入停用目录，技能仍处于停用状态",
      "card.category": "分类",
      "card.categoryLabel": "分类：{name}",
      "card.downloads": "下载量",
      "card.firstSeen": "首次收录",
      "card.from": "来自 {source}，标识 {canonical}",
      "card.identifier": "标识",
      "card.install": "安装",
      "card.installNamed": "安装「{name}」",
      "card.installed": "已安装",
      "card.installing": "安装中…",
      "card.loadMore": "加载更多",
      "card.noDescription": "该技能未提供简介。",
      "card.official": "官方技能",
      "card.rating": "评分折算",
      "card.ratingTitle": "综合评分折算值",
      "card.save": "收藏 {name}",
      "card.saveShort": "收藏",
      "card.saved": "收藏",
      "card.saves": "收藏数",
      "card.score": "综合评分",
      "card.showing": "已显示 {shown} / {total}",
      "card.showingAll": "已显示全部 {total} 个技能",
      "card.source": "来源",
      "card.stars": "收藏数",
      "card.unsave": "取消收藏 {name}",
      "card.unsaveShort": "取消收藏",
      "card.updatedAt": "最近更新",
      "card.version": "版本",
      "card.view": "查看 {name}",
      "category.ai-agent": "AI Agent",
      "category.business-ops": "商业运营",
      "category.content-creation": "内容创作",
      "category.data-analysis": "数据分析",
      "category.design-media": "设计多媒体",
      "category.dev-programming": "开发编程",
      "category.education": "教育学习",
      "category.it-ops-security": "IT 运维与安全",
      "category.knowledge-management": "知识管理",
      "category.life-service": "生活服务",
      "category.office-efficiency": "办公效率",
      "category.professional": "行业专业",
      "discover.all": "全部技能",
      "discover.chipTitle": "{name}：共 {count} 个（不受当前筛选影响）",
      "discover.eyebrow": "DISCOVER",
      "discover.pageOf": "（本页 {shown} 个）",
      "discover.subtitle": "来自 SkillHub 的技能库，默认按下载量排序。安装后即可在任意会话中直接调用。",
      "discover.title": "发现技能",
      "discover.total": "共 {total} 个",
      "drawer.aria": "技能详情",
      "drawer.close": "关闭详情",
      "drawer.installSkill": "安装技能",
      "drawer.savedState": "已收藏",
      "drawer.sourceCommunity": "社区来源",
      "drawer.sourceOfficial": "官方来源",
      "drawer.uninstallInstalled": "已安装 · 卸载",
      "drawer.updatedAt": "更新于 {time}",
      "drawer.versionUnknown": "版本未标注",
      "empty.goDiscover": "去发现技能",
      "empty.noInstalled": "还没有安装技能",
      "empty.noInstalledBody": "到技能市场挑选一个开始吧。",
      "empty.noMatch": "没有匹配的技能",
      "empty.noMatchBody": "换个关键词，或清空分类筛选后再试。",
      "empty.noSaved": "收藏夹是空的",
      "empty.noSavedBody": "在技能卡片上点击书签图标即可收藏。",
      "err.notJson": "技能市场接口返回了非 JSON 内容（HTTP {status}）",
      "err.offline": "连不上技能市场，请检查网络后重试",
      "err.requestFailed": "技能市场接口请求失败（HTTP {status}）",
      "err.uploadFailed": "上传失败（HTTP {status}）",
      "err.upstreamFailed": "技能市场上游请求失败：{reason}",
      "error.catalog": "技能数据加载失败",
      "error.prunedFavorites": "已清理 {count} 个无法解析的旧收藏",
      "error.retry": "重试",
      "files.back": "返回文件列表",
      "files.backOne": "返回上一个文件",
      "files.close": "关闭",
      "files.failed": "文件清单加载失败：{reason}",
      "files.heading": "文件",
      "files.loading": "正在读取文件清单…",
      "files.loadingOne": "正在读取 {path}",
      "files.localHasNone": "本地导入的技能没有 SkillHub 文件清单。",
      "files.manifestVersion": "清单对应 v{version}",
      "files.noSource": "该技能没有 SkillHub 来源",
      "files.nodeSummary": "{files} 个文件 · {size}",
      "files.nodeTitle": "{path} · 点击查看内容",
      "files.none": "SkillHub 未返回该技能的文件清单。",
      "files.readFailed": "无法读取该文件：{reason}",
      "files.sizeAndLines": "{size} · 共 {lines} 行",
      "files.treeHint": " · 点击文件查看内容",
      "files.treeSummary": "{files} 个文件 · {size} · {version} · 点击文件查看内容",
      "files.treeSummaryBase": "{files} 个文件 · {size}",
      "files.treeSummaryNoVersion": "{files} 个文件 · {size} · 点击查看内容",
      "files.truncated": "文件较大，此处已截断显示。",
      "files.unknownSize": "未知大小",
      "import.badgeLocal": "本地导入",
      "import.badgeManual": "手动放置",
      "import.browse": "浏览文件…",
      "import.doneMany": "已导入 {count} 个技能包",
      "import.doneMixed": "已导入 {ok} 个，{failed} 个失败：{reason}",
      "import.doneOne": "已导入「{name}」",
      "import.dropAria": "选择或拖入 .zip 技能包",
      "import.dropNote": "支持的格式只有 .zip 压缩包，文件大小不能超过 50 MB。",
      "import.dropTitle": "把技能包拖到这里，或点击选择",
      "import.empty": "还没有本地技能",
      "import.emptyBody": "把 .zip 技能包拖到上方区域，或点击「浏览文件…」导入。直接复制到技能目录的技能也会出现在这里。",
      "import.eyebrow": "LOCAL",
      "import.failed": "导入失败：{reason}",
      "import.fileFailed": "{name}：{reason}",
      "import.noResult": "Host 未返回导入结果",
      "import.noResultDetail": "Host 未返回导入结果（响应：{body}）",
      "import.pickFile": "导入技能",
      "import.progress": "正在导入 {done}/{total}：{name}…",
      "import.statEnabled": "已启用",
      "import.statFormat": "技能包格式",
      "import.statImported": "已导入",
      "import.subtitle": "导入当前设备上的技能包，仅在本地生效，不会同步到市场或团队工作区。导入后即可在任意会话中调用。",
      "installed.details": "详情",
      "installed.dirPrefix": "skill 目录：",
      "installed.disabled": "已停用",
      "installed.enableNamed": "启用 {name}",
      "installed.enabled": "已启用",
      "installed.eyebrow": "LIBRARY",
      "installed.fileCount": "（{count} 个文件）",
      "installed.fileCountBare": "{count} 个文件",
      "installed.installedAt": "安装于 {time}",
      "installed.noVersion": "版本未标注",
      "installed.pendingBadge": "待生效",
      "installed.pendingBadgeTitle": "本次已修改，重启后对新会话生效",
      "installed.remove": "移除",
      "installed.removeNamed": "移除 {name}",
      "installed.subtitle": "{count} 个技能已加入本地技能库，可随时停用而不卸载。",
      "installed.toggleLabel": "启用 / 停用",
      "installed.version": "版本 {version}",
      "metrics.downloads": "下载量",
      "metrics.heading": "SkillHub 指标",
      "metrics.homepage": "主页",
      "metrics.note": "全部数值直接来自 SkillHub 公开接口。",
      "metrics.rating": "评分折算",
      "metrics.score": "综合评分",
      "metrics.stars": "收藏数",
      "metrics.total": "SkillHub 共 {total}",
      "misc.byAuthor": "作者未填写更新说明",
      "misc.community": "社区",
      "misc.localMachine": "本机",
      "misc.localVersion": "本地 v{version}",
      "misc.machineRecord": "本机记录",
      "misc.notStated": "未标注",
      "misc.official": "官方",
      "misc.unknown": "未知",
      "misc.vendorKeen": "科恩实验室",
      "misc.vendorSanbu": "云鼎实验室",
      "overview.fromCommunity": "来自 SkillHub 社区，标识 {canonical}",
      "overview.fromOfficial": "来自 SkillHub 认证，标识 {canonical}",
      "overview.installedHint": "已安装的技能；打开详情可读取 SkillHub 上的说明。",
      "overview.keyInfo": "关键信息",
      "overview.needsKey": "需要自备 API Key",
      "overview.noKey": "无需额外 API Key",
      "overview.summary": "简介",
      "overview.summaryFailed": "简介加载失败：{reason}",
      "overview.unknownCategory": "未分类",
      "overview.unknownSkill": "未知技能",
      "overview.useCases": "适用场景",
      "overview.version": "当前版本 v{version}",
      "overview.versionMaintained": "版本信息由作者维护",
      "panel.aria": "技能市场视图",
      "panel.title": "技能市场",
      "perm.heading": "需要的权限",
      "perm.localLibrary": "本地技能库",
      "perm.localLibraryDesc": "「安装」只在本机记录该技能并启用；技能文件本身仍由你通过本地导入提供。",
      "perm.metadata": "读取技能元数据",
      "perm.metadataDesc": "本插件仅从 SkillHub 读取公开的名称、简介、版本与统计信息，不写入你的任何数据。",
      "perm.needsKey": "作者标注需要自备 API Key。",
      "perm.network": "网络访问",
      "perm.networkDesc": "技能自身可能访问外部服务；{key}",
      "perm.noKeyNote": "作者未标注需要 API Key。",
      "perm.note": "以下说明区分技能自身的声明与本插件的行为，你可以在设置中随时收回。",
      "restart.bannerTitle": "本次改了 {count} 个技能",
      "restart.dismiss": "知道了",
      "restart.dismissTitle": "只是清掉这个提示，不影响技能状态",
      "restart.effect": "重启 DeepSeek Harness 后生效",
      "risk.high": "高风险",
      "risk.low": "低风险",
      "risk.mid": "中风险",
      "safety.allBenign": "所有检测方均报告安全，无风险",
      "safety.badge": "安全",
      "safety.badgeTitle": "安全扫描通过：所有检测方均报告安全，无风险",
      "safety.failed": "检测结果读取失败：{reason}",
      "safety.hasRisk": "有检测方报告可疑，存在潜在风险",
      "safety.heading": "安全扫描",
      "safety.hiddenNote": "「安全」标记只在全部检测方都报告安全时出现，因此当前不显示该标记。",
      "safety.loading": "正在读取检测结果…",
      "safety.none": "SkillHub 未提供该技能的安全检测结果。",
      "safety.note": "结果由 SkillHub 的第三方检测方给出，与「权限」页说明的本插件行为无关。",
      "safety.pending": "检测仍在排队中",
      "safety.report": "查看报告",
      "safety.shownNote": "卡片与详情页的「安全」标记只在全部检测方都报告安全时出现。",
      "safety.unknown": "检测结果未明",
      "saved.eyebrow": "COLLECTION",
      "saved.subtitle": "{count} 个技能已收藏，仅保存在本机。",
      "saved.upToDate": "已是 SkillHub 上的最新版本",
      "saved.updatable": "可更新",
      "saved.update": "更新",
      "saved.updated": "已更新",
      "saved.versionArrow": "v{local} → v{latest}",
      "search.placeholder": "搜索技能、描述或关键词",
      "search.refresh": "刷新技能数据",
      "search.refreshShort": "刷新",
      "sort.aria": "排序方式",
      "sort.downloads": "按下载量",
      "sort.score": "按综合评分",
      "sort.stars": "按收藏数",
      "sort.updated": "按更新时间",
      "status.connected": "已连接 SkillHub",
      "status.error": "SkillHub 连接异常",
      "status.loading": "加载中…",
      "status.syncing": "正在同步 SkillHub",
      "tab.files": "文件",
      "tab.metrics": "指标",
      "tab.overview": "概览",
      "tab.permissions": "权限",
      "tab.safety": "安全扫描",
      "tab.versions": "版本历史",
      "time.days": "{count} 天前",
      "time.hours": "{count} 小时前",
      "time.justNow": "刚刚",
      "time.minutes": "{count} 分钟前",
      "time.months": "{count} 个月前",
      "time.years": "{count} 年前",
      "toast.undo": "撤销",
      "versions.category": "分类",
      "versions.collapse": "收起历史版本",
      "versions.comparison": "本地 v{local} · SkillHub v{latest}",
      "versions.currentVersion": "当前版本",
      "versions.expand": "展开其余 {count} 个版本",
      "versions.failed": "版本历史加载失败：{reason}",
      "versions.firstSeen": "首次收录",
      "versions.heading": "版本历史",
      "versions.identifier": "标识",
      "versions.installThis": "安装",
      "versions.installed": "已安装",
      "versions.latest": "最新",
      "versions.loading": "正在读取版本历史…",
      "versions.localHasNone": "本地导入的技能没有 SkillHub 版本历史。",
      "versions.newAvailable": "有新版本可用",
      "versions.noChangelog": "作者未填写更新说明",
      "versions.none": "SkillHub 未返回版本记录。",
      "versions.source": "来源",
      "versions.upToDate": "已是 SkillHub 上的最新版本",
      "versions.updateTo": "更新到 v{version}",
      "versions.updatedAt": "最近更新",
      "versions.updatedAtValue": "{date}（{relative}）",
      "versions.versionAndSource": "版本与来源",
      "view.discover": "发现",
      "view.import": "本地导入",
      "view.installed": "已安装",
      "view.saved": "收藏",
    }
    const EN = {
      "action.cancel": "Cancel",
      "action.confirmInstall": "Install “{name}”",
      "action.detailFailed": "Could not load details: {reason}",
      "action.disableNamed": "Disabled “{name}”",
      "action.disableRestart": "Disabled “{name}”. Restart DeepSeek Harness to apply.",
      "action.downgrade": "Roll “{name}” back to v{version}?",
      "action.downgradeBody": "v{current} is currently installed. The skill directory is replaced with that older release in full.",
      "action.downgradeConfirm": "Roll back",
      "action.enableNamed": "Enabled “{name}”",
      "action.enableRestart": "Enabled “{name}”. Restart DeepSeek Harness to apply.",
      "action.importFailedNamed": "Could not import “{name}”: {reason}",
      "action.install": "Install",
      "action.installFailed": "Could not install “{name}”: {reason}",
      "action.installedDetail": "Installed “{name}” v{version}: {files} files → {directory}. Restart DeepSeek Harness to apply.",
      "action.installedNamed": "Installed “{name}”",
      "action.installingNamed": "Installing “{name}”…",
      "action.installingVersion": "Installing “{name}” v{version}…",
      "action.noInstallResult": "The Host did not return an install result",
      "action.removeFromDisabled": "Removed “{name}” from the disabled store. Restart DeepSeek Harness to apply.",
      "action.removedFromDisabled": "Removed “{name}” from the disabled store",
      "action.savedNamed": "Saved “{name}”",
      "action.toggleFailed": "Could not switch “{name}”: {reason}",
      "action.tooLarge": "Skill directory too large ({size} MB > {limit} MB)",
      "action.tooManyFiles": "Too many files (limit {limit})",
      "action.uninstall": "Uninstall",
      "action.uninstallBody": "The skill directory is deleted from disk, including a disabled copy. Reinstalling requires downloading it again.",
      "action.uninstallDetail": "{directory} ({files} files)",
      "action.uninstallDetailNoFiles": "{directory}",
      "action.uninstallFailed": "Could not uninstall “{name}”: {reason}",
      "action.uninstallNamed": "Uninstall {name}",
      "action.uninstalledNamed": "Uninstalled “{name}”",
      "action.uninstalledRestart": "Uninstalled “{name}”. Restart DeepSeek Harness to apply.",
      "action.uninstalling": "Uninstall “{name}”?",
      "action.unsavedNamed": "Removed “{name}” from saved",
      "action.update": "Update",
      "action.updatedNamed": "Updated “{name}”",
      "action.updatedParked": "Updated “{name}” v{version}: {files} files written to the disabled store; the skill stays disabled",
      "card.category": "Category",
      "card.categoryLabel": "Category: {name}",
      "card.downloads": "Downloads",
      "card.firstSeen": "First seen",
      "card.from": "From {source}, identifier {canonical}",
      "card.identifier": "Identifier",
      "card.install": "Install",
      "card.installNamed": "Install “{name}”",
      "card.installed": "Installed",
      "card.installing": "Installing…",
      "card.loadMore": "Load more",
      "card.noDescription": "This skill has no description.",
      "card.official": "Official skill",
      "card.rating": "Rating",
      "card.ratingTitle": "Score converted to a 5-point rating",
      "card.save": "Save {name}",
      "card.saveShort": "Save",
      "card.saved": "Saved",
      "card.saves": "Saves",
      "card.score": "Score",
      "card.showing": "Showing {shown} / {total}",
      "card.showingAll": "All {total} skills shown",
      "card.source": "Source",
      "card.stars": "Saves",
      "card.unsave": "Remove {name} from saved",
      "card.unsaveShort": "Saved",
      "card.updatedAt": "Last updated",
      "card.version": "Version",
      "card.view": "View {name}",
      "category.ai-agent": "AI agent",
      "category.business-ops": "Business operations",
      "category.content-creation": "Content creation",
      "category.data-analysis": "Data analysis",
      "category.design-media": "Design and media",
      "category.dev-programming": "Development",
      "category.education": "Education",
      "category.it-ops-security": "IT operations and security",
      "category.knowledge-management": "Knowledge management",
      "category.life-service": "Everyday services",
      "category.office-efficiency": "Office efficiency",
      "category.professional": "Industry",
      "discover.all": "All skills",
      "discover.chipTitle": "{name}: {count} total (not affected by the current filter)",
      "discover.eyebrow": "DISCOVER",
      "discover.pageOf": " ({shown} on this page)",
      "discover.subtitle": "Skills from SkillHub, most downloaded first. Install one to call it from any conversation.",
      "discover.title": "Discover skills",
      "discover.total": "{total} skills",
      "drawer.aria": "Skill details",
      "drawer.close": "Close details",
      "drawer.installSkill": "Install skill",
      "drawer.savedState": "Saved",
      "drawer.sourceCommunity": "Community source",
      "drawer.sourceOfficial": "Official source",
      "drawer.uninstallInstalled": "Installed · uninstall",
      "drawer.updatedAt": "Updated {time}",
      "drawer.versionUnknown": "Version not stated",
      "empty.goDiscover": "Browse skills",
      "empty.noInstalled": "No skills installed yet",
      "empty.noInstalledBody": "Pick one from the market to get started.",
      "empty.noMatch": "No matching skills",
      "empty.noMatchBody": "Try another keyword, or clear the category filter.",
      "empty.noSaved": "Nothing saved yet",
      "empty.noSavedBody": "Click the bookmark icon on a skill card to save it.",
      "err.notJson": "The skill-market API returned something that is not JSON (HTTP {status})",
      "err.offline": "Could not reach the skill market — check your network and retry",
      "err.requestFailed": "Skill-market API request failed (HTTP {status})",
      "err.uploadFailed": "Upload failed (HTTP {status})",
      "err.upstreamFailed": "SkillHub request failed: {reason}",
      "error.catalog": "Could not load skill data",
      "error.prunedFavorites": "Cleared {count} saved entries that could no longer be resolved",
      "error.retry": "Retry",
      "files.back": "Back to the file list",
      "files.backOne": "Back to the previous file",
      "files.close": "Close",
      "files.failed": "Could not load the file list: {reason}",
      "files.heading": "Files",
      "files.loading": "Reading the file list…",
      "files.loadingOne": "Reading {path}",
      "files.localHasNone": "A locally imported skill has no SkillHub file list.",
      "files.manifestVersion": "list matches v{version}",
      "files.noSource": "This skill has no SkillHub source",
      "files.nodeSummary": "{files} file(s) · {size}",
      "files.nodeTitle": "{path} · click to read",
      "files.none": "SkillHub returned no file list for this skill.",
      "files.readFailed": "Could not read this file: {reason}",
      "files.sizeAndLines": "{size} · {lines} line(s)",
      "files.treeHint": " · click a file to read it",
      "files.treeSummary": "{files} file(s) · {size} · {version} · click a file to read it",
      "files.treeSummaryBase": "{files} file(s) · {size}",
      "files.treeSummaryNoVersion": "{files} file(s) · {size} · click a file to read it",
      "files.truncated": "This file is large; the preview is truncated.",
      "files.unknownSize": "Unknown size",
      "import.badgeLocal": "Imported",
      "import.badgeManual": "Placed by hand",
      "import.browse": "Browse files…",
      "import.doneMany": "Imported {count} skill packages",
      "import.doneMixed": "Imported {ok}, {failed} failed: {reason}",
      "import.doneOne": "Imported “{name}”",
      "import.dropAria": "Choose or drop a .zip skill package",
      "import.dropNote": "Only .zip archives are supported, up to 50 MB each.",
      "import.dropTitle": "Drop a skill package here, or click to choose",
      "import.empty": "No local skills yet",
      "import.emptyBody": "Drop a .zip package above, or click “Browse files…”. Skills copied straight into the skill directory appear here too.",
      "import.eyebrow": "LOCAL",
      "import.failed": "Import failed: {reason}",
      "import.fileFailed": "{name}: {reason}",
      "import.noResult": "The Host did not return an import result",
      "import.noResultDetail": "The Host did not return an import result (response: {body})",
      "import.pickFile": "Import skill",
      "import.progress": "Importing {done}/{total}: {name}…",
      "import.statEnabled": "Enabled",
      "import.statFormat": "Package format",
      "import.statImported": "Imported",
      "import.subtitle": "Import a skill package from this device. It stays local and is not synced to the market or a team workspace, and can be called from any conversation once imported.",
      "installed.details": "Details",
      "installed.dirPrefix": "skill directory: ",
      "installed.disabled": "Disabled",
      "installed.enableNamed": "Enable {name}",
      "installed.enabled": "Enabled",
      "installed.eyebrow": "LIBRARY",
      "installed.fileCount": " ({count} files)",
      "installed.fileCountBare": "{count} files",
      "installed.installedAt": "installed {time}",
      "installed.noVersion": "Version not stated",
      "installed.pendingBadge": "Pending",
      "installed.pendingBadgeTitle": "Changed this session; takes effect in new conversations after a restart",
      "installed.remove": "Remove",
      "installed.removeNamed": "Remove {name}",
      "installed.subtitle": "{count} skill(s) in your local library. Disable one at any time without uninstalling it.",
      "installed.toggleLabel": "Enable / disable",
      "installed.version": "Version {version}",
      "metrics.downloads": "Downloads",
      "metrics.heading": "SkillHub metrics",
      "metrics.homepage": "Homepage",
      "metrics.note": "All values come directly from SkillHub’s public API.",
      "metrics.rating": "Rating",
      "metrics.score": "Score",
      "metrics.stars": "Saves",
      "metrics.total": "{total} skills on SkillHub",
      "misc.byAuthor": "No release notes from the author",
      "misc.community": "Community",
      "misc.localMachine": "This machine",
      "misc.localVersion": "local v{version}",
      "misc.machineRecord": "Local record",
      "misc.notStated": "not stated",
      "misc.official": "Official",
      "misc.unknown": "Unknown",
      "misc.vendorKeen": "Keen Lab",
      "misc.vendorSanbu": "Yunding Lab",
      "overview.fromCommunity": "From the SkillHub community, identifier {canonical}",
      "overview.fromOfficial": "From SkillHub verified, identifier {canonical}",
      "overview.installedHint": "An installed skill. Open the details to read its description on SkillHub.",
      "overview.keyInfo": "Key facts",
      "overview.needsKey": "You must supply your own API key",
      "overview.noKey": "No extra API key needed",
      "overview.summary": "Summary",
      "overview.summaryFailed": "Could not load the summary: {reason}",
      "overview.unknownCategory": "Uncategorised",
      "overview.unknownSkill": "Unknown skill",
      "overview.useCases": "When to use it",
      "overview.version": "Current version v{version}",
      "overview.versionMaintained": "Version information is maintained by the author",
      "panel.aria": "Skill market view",
      "panel.title": "Skill Market",
      "perm.heading": "Permissions needed",
      "perm.localLibrary": "Local skill library",
      "perm.localLibraryDesc": "“Install” only records and enables the skill on this machine; you still supply the skill files through local import.",
      "perm.metadata": "Reads skill metadata",
      "perm.metadataDesc": "This plugin only reads public names, descriptions, versions and statistics from SkillHub. It writes none of your data.",
      "perm.needsKey": "the author states you must supply an API key.",
      "perm.network": "Network access",
      "perm.networkDesc": "The skill itself may call external services; {key}",
      "perm.noKeyNote": "the author states no API key is needed.",
      "perm.note": "These notes separate what the skill itself declares from what this plugin does. You can revoke them in Settings at any time.",
      "restart.bannerTitle": "{count} skill(s) changed",
      "restart.dismiss": "Got it",
      "restart.dismissTitle": "Dismisses this notice only; skill state is unaffected",
      "restart.effect": "Restart DeepSeek Harness to apply",
      "risk.high": "High risk",
      "risk.low": "Low risk",
      "risk.mid": "Medium risk",
      "safety.allBenign": "Every scanner reports safe, no risk",
      "safety.badge": "Safe",
      "safety.badgeTitle": "Scan passed: every scanner reports safe, no risk",
      "safety.failed": "Could not read scan results: {reason}",
      "safety.hasRisk": "A scanner reports suspicious, potential risk",
      "safety.heading": "Security scan",
      "safety.hiddenNote": "The “Safe” mark appears only when every scanner reports safe, so it is not shown here.",
      "safety.loading": "Reading scan results…",
      "safety.none": "SkillHub provides no security scan for this skill.",
      "safety.note": "Results come from SkillHub’s third-party scanners and are unrelated to this plugin’s own behaviour described under Permissions.",
      "safety.pending": "The scan is still queued",
      "safety.report": "View report",
      "safety.shownNote": "The “Safe” mark on cards and here appears only when every scanner reports safe.",
      "safety.unknown": "Scan result unclear",
      "saved.eyebrow": "COLLECTION",
      "saved.subtitle": "{count} skill(s) saved, on this machine only.",
      "saved.upToDate": "Already the latest version on SkillHub",
      "saved.updatable": "Update available",
      "saved.update": "Update",
      "saved.updated": "Updated",
      "saved.versionArrow": "v{local} → v{latest}",
      "search.placeholder": "Search skills, descriptions or keywords",
      "search.refresh": "Refresh skill data",
      "search.refreshShort": "Refresh",
      "sort.aria": "Sort order",
      "sort.downloads": "Most downloaded",
      "sort.score": "Highest rated",
      "sort.stars": "Most saved",
      "sort.updated": "Recently updated",
      "status.connected": "Connected to SkillHub",
      "status.error": "SkillHub connection problem",
      "status.loading": "Loading…",
      "status.syncing": "Syncing with SkillHub",
      "tab.files": "Files",
      "tab.metrics": "Metrics",
      "tab.overview": "Overview",
      "tab.permissions": "Permissions",
      "tab.safety": "Security",
      "tab.versions": "Version",
      "time.days": "{count} d ago",
      "time.hours": "{count} h ago",
      "time.justNow": "just now",
      "time.minutes": "{count} min ago",
      "time.months": "{count} mo ago",
      "time.years": "{count} y ago",
      "toast.undo": "Undo",
      "versions.category": "Category",
      "versions.collapse": "Hide older versions",
      "versions.comparison": "local v{local} · SkillHub v{latest}",
      "versions.currentVersion": "Current version",
      "versions.expand": "Show the other {count} version(s)",
      "versions.failed": "Could not load version history: {reason}",
      "versions.firstSeen": "First seen",
      "versions.heading": "Version history",
      "versions.identifier": "Identifier",
      "versions.installThis": "Install",
      "versions.installed": "Installed",
      "versions.latest": "Latest",
      "versions.loading": "Reading version history…",
      "versions.localHasNone": "A locally imported skill has no SkillHub version history.",
      "versions.newAvailable": "A newer version is available",
      "versions.noChangelog": "No release notes from the author",
      "versions.none": "SkillHub returned no version records.",
      "versions.source": "Source",
      "versions.upToDate": "Already the latest version on SkillHub",
      "versions.updateTo": "Update to v{version}",
      "versions.updatedAt": "Last updated",
      "versions.updatedAtValue": "{date} ({relative})",
      "versions.versionAndSource": "Version and source",
      "view.discover": "Discover",
      "view.import": "Local import",
      "view.installed": "Installed",
      "view.saved": "Saved",
    }

    /** Installed by apply(); falls back to Chinese so a missing service still renders text. */
    let clientLocale = null

    /**
     * Substitute `{name}` placeholders, leaving unknown ones visible so a slip shows in the UI.
     * @param {string} template - Text with placeholders.
     * @param {object} [params] - Values.
     * @returns {string} Formatted text.
     */
    function formatText(template, params) {
      if (params === undefined) return template
      return String(template).replace(/\{(\w+)\}/g, (whole, key) => (
        Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole
      ))
    }

    /**
     * Translate one key through the active language.
     *
     * Uses the DSH locale service when `apply()` has wired one, and the shipped dictionaries
     * otherwise — a harness, or a build without the client locale package. The service answers with
     * the key itself for an unregistered namespace, which is detected and replaced by the dictionary
     * so a partial registration cannot fill the panel with `card.install`.
     *
     * @param {string} key - Dictionary key.
     * @param {object} [params] - Placeholder values.
     * @returns {string} Translated text.
     */
    function t(key, params) {
      const dictionary = clientActive === 'en' ? EN : ZH
      if (clientLocale !== null) {
        const text = clientLocale(key, params)
        if (text !== key) return text
      }
      return formatText(dictionary[key] ?? ZH[key] ?? key, params)
    }

    /** Which shipped dictionary to prefer when no service is wired. */
    let clientActive = 'zh'

    /**
     * The locale tag to hand to `toLocaleDateString` / `toLocaleString`.
     *
     * Numbers and dates are formatted at the call site, before the value reaches a dictionary, so no
     * entry has to know about grouping or date order. Without it the panel grouped digits as Chinese
     * inside an English UI.
     *
     * @returns {string} A BCP 47 tag.
     */
    function uiLocale() {
      return clientActive === 'en' ? 'en-US' : 'zh-CN'
    }

    /**
     * Translate a category key, falling back to the name upstream sent.
     * @param {string} key - Category key from the API.
     * @param {string} fallback - Upstream display name.
     * @returns {string} Localised name.
     */
    function translatedCategory(key, fallback) {
      const dictionaryKey = `category.${key}`
      const translated = t(dictionaryKey)
      return translated === dictionaryKey ? fallback : translated
    }
    /* ── end generated locale block ────────────────────────────────────── */

    /** Same-origin proxy path owned by this plugin's Host half. */
    const API = 'skill-market/api'
    /**
     * The Host route that owns this panel's persisted state.
     * @see the store section below for what it holds and where the file lives.
     */
    const STATE_PATH = 'state'
    /**
     * The Web Storage keys this panel used before that state became a file.
     *
     * They are read **once**, by the adoption in `hydratePanelState`, and then deleted: the
     * data belongs in this plugin's own data directory, not in the desktop shell's Local
     * Storage, which is DSH's store rather than this plugin's. Keeping the original unscoped
     * spelling matters for exactly that one read — a renamed key would silently drop the
     * favorites and ledger already saved under the old name instead of carrying them over.
     */
    const LEGACY_STATE_KEY = 'dsh-skill-market/v1'
    /** The restart-advice payload's old Web Storage key; adopted and deleted the same way. */
    const LEGACY_PENDING_KEY = 'dsh-skill-market/pending/v1'
    /**
     * How often an open panel asks the Host whether another window changed the document.
     *
     * `localStorage` used to raise a `storage` event, which is how two windows kept in step. A
     * file raises nothing, so the only options are a poll or a lock service, and a panel with no
     * live channel between its instances is not worth a lock service. Ten seconds is slow enough
     * to be invisible in the Host's log and fast enough that a second window is never stale by
     * more than one glance.
     */
    const PANEL_SYNC_INTERVAL_MS = 10_000

    /**
     * Resolve one proxy path against the document's own base.
     *
     * A root-absolute path is wrong wherever the UI is mounted under a prefix: a
     * reverse proxy at `https://host/app/my-dsh/` would send `/skill-market/api`
     * to the host root instead of the mount. `document.baseURI` is the directory
     * the UI was actually served from — the shipped shell injects
     * `<base href="./">` for exactly this reason, and the desktop shell, which
     * serves the page from `dsh-app://app/` and forwards every non-asset path to
     * the Host, resolves the same relative path identically.
     *
     * @param {string} path - Proxy path such as `skills` or `categories`.
     * @returns {string} Path resolved against the document base.
     */
    function apiPath(path) {
      const relative = `${API}/${String(path).replace(/^\/+/, '')}`
      if (typeof document === 'undefined') return `/${relative}`
      return new URL(relative, document.baseURI).pathname
    }

    /** Fallback category list; replaced by `/api/v1/categories` when it answers. */
    /**
     * Categories the panel never offers.
     *
     * `pay-skill` is upstream's commercial tier rather than a topic, and it is not
     * wanted in this panel's filters. The vocabulary arrives from the API and its
     * `active` flag does not exclude it, so it is filtered out here — including from
     * the fallback list, so it never appears even before the API answers.
     */
    const HIDDEN_CATEGORIES = new Set(['pay-skill'])
    const FALLBACK_CATEGORIES = [
      { key: 'office-efficiency', name: 'category.office-efficiency' },
      { key: 'content-creation', name: 'category.content-creation' },
      { key: 'dev-programming', name: 'category.dev-programming' },
      { key: 'data-analysis', name: 'category.data-analysis' },
      { key: 'design-media', name: 'category.design-media' },
      { key: 'ai-agent', name: 'AI Agent' },
      { key: 'knowledge-management', name: 'category.knowledge-management' },
      { key: 'business-ops', name: 'category.business-ops' },
      { key: 'education', name: 'category.education' },
      { key: 'professional', name: 'category.professional' },
      { key: 'it-ops-security', name: 'category.it-ops-security' },
      { key: 'life-service', name: 'category.life-service' },
    ]
    /** Sort options: the API's `sortBy` values with the prototype's labels. */
    const SORTS = [
      { value: 'downloads', label: 'sort.downloads' },
      { value: 'score', label: 'sort.score' },
      { value: 'stars', label: 'sort.stars' },
      { value: 'updated_at', label: 'sort.updated' },
    ]
    /**
     * The order 发现 opens in.
     *
     * Most-downloaded first, and listed first in the control so the select shows what the list is
     * doing. `score` is the site's own default (`skillhub.cn/skills?sortBy=score`), but a marketplace
     * is better introduced by what people actually installed.
     */
    const DEFAULT_SORT = 'downloads'
    /** Icon glyph per upstream category. */
    const CATEGORY_ICON = {
      'dev-programming': 'i-terminal',
      'data-analysis': 'i-table',
      'content-creation': 'i-type',
      'office-efficiency': 'i-clipboard',
      'design-media': 'i-image',
      'ai-agent': 'i-sparkle',
      'knowledge-management': 'i-book',
      'business-ops': 'i-network',
      education: 'i-book',
      professional: 'i-shield',
      'it-ops-security': 'i-lock',
      'life-service': 'i-mail',
      'pay-skill': 'i-database',
    }
    /** Accent hue per category, used for the card glyph plate. */
    const CATEGORY_HUE = {
      'dev-programming': 258,
      'data-analysis': 200,
      'content-creation': 318,
      'office-efficiency': 232,
      'design-media': 12,
      'ai-agent': 282,
      'knowledge-management': 158,
      'business-ops': 42,
      education: 192,
      professional: 88,
      'it-ops-security': 224,
      'life-service': 336,
      'pay-skill': 268,
    }
    /** Risk copy for the permissions a SkillHub skill advertises. */
    const RISK_LABELS = { low: 'risk.low', mid: 'risk.mid', high: 'risk.high' }

    /* ── stylesheet ──────────────────────────────────────────────────────
     * Token names mirror the prototype's `:root` table so the two files can be
     * diffed one-to-one. Values are the exported oklch numbers for the light
     * palette, with a dark palette derived alongside them. Host theme tokens are
     * referenced for the shell-adjacent surfaces (clearance, panel background)
     * so the panel never fights the frame it lives in.
     */
    const CSS = `
[data-skill-market] {
  /* canvas + surface */
  --sm-bg: var(--dsw-alias-bg-base, oklch(99% 0.002 240));
  --sm-surface: var(--dsw-alias-bg-layer-1, oklch(100% 0 0));
  --sm-fg: var(--dsw-alias-label-primary, oklch(18% 0.012 250));
  --sm-muted: var(--dsw-alias-label-secondary, oklch(54% 0.012 250));
  --sm-border: var(--dsw-alias-border-l1, oklch(92% 0.005 250));
  --sm-border-strong: var(--dsw-alias-border-l2, color-mix(in oklch, var(--sm-fg) 22%, var(--sm-border)));
  --sm-accent: var(--dsw-alias-brand-primary, oklch(58% 0.18 255));

  --sm-ok: var(--dsw-alias-state-success-primary, oklch(52% 0.13 155));
  --sm-warn: var(--dsw-alias-state-warn-primary, oklch(52% 0.13 62));
  --sm-danger: var(--dsw-alias-state-error-primary, oklch(52% 0.17 27));
  --sm-star: oklch(62% 0.13 72);

  --sm-accent-soft: color-mix(in oklch, var(--sm-accent) 12%, transparent);
  --sm-accent-line: color-mix(in oklch, var(--sm-accent) 34%, var(--sm-border));
  --sm-fg-soft: color-mix(in oklch, var(--sm-fg) 6%, transparent);
  --sm-fg-softer: color-mix(in oklch, var(--sm-fg) 3.5%, transparent);
  --sm-ok-soft: color-mix(in oklch, var(--sm-ok) 14%, transparent);
  --sm-warn-soft: color-mix(in oklch, var(--sm-warn) 14%, transparent);
  --sm-warn-line: color-mix(in oklch, var(--sm-warn) 32%, var(--sm-border));
  --sm-danger-soft: color-mix(in oklch, var(--sm-danger) 14%, transparent);
  --sm-scrim: color-mix(in oklch, var(--sm-fg) 22%, transparent);
  --sm-shadow-sm: 0 1px 2px color-mix(in oklch, var(--sm-fg) 8%, transparent);
  --sm-shadow-md: 0 12px 32px color-mix(in oklch, var(--sm-fg) 14%, transparent);

  --sm-radius: 9px;
  --sm-radius-lg: 13px;
  --sm-topbar: 58px;
  --sm-statusbar: 28px;

  --sm-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --sm-font-mono: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace;
}
body[data-ds-dark-theme] [data-skill-market] {
  --sm-star: oklch(76% 0.13 78);
  --sm-accent-soft: color-mix(in oklch, var(--sm-accent) 20%, transparent);
  --sm-accent-line: color-mix(in oklch, var(--sm-accent) 42%, var(--sm-border));
  --sm-fg-soft: color-mix(in oklch, var(--sm-fg) 10%, transparent);
  --sm-fg-softer: color-mix(in oklch, var(--sm-fg) 5%, transparent);
  --sm-scrim: color-mix(in oklch, black 46%, transparent);
  --sm-shadow-sm: 0 1px 2px color-mix(in oklch, black 40%, transparent);
  --sm-shadow-md: 0 12px 32px color-mix(in oklch, black 52%, transparent);
}

[data-skill-market] *, [data-skill-market] *::before, [data-skill-market] *::after { box-sizing: border-box; }
[data-skill-market] {
  display: flex; flex-direction: column; min-width: 0; min-height: 0;
  /* height: 100% needs a parent with a definite height; when the mount is itself content-sized that
     resolves to auto and the panel grows past the viewport, so the page scrolls instead of only the card
     list. max-height: 100% and the overflow: hidden below keep the panel bounded either way, which is
     what confines scrolling to .sm-content. */
  height: 100%; max-height: 100%; position: relative; overflow: hidden;
  background: var(--sm-bg); color: var(--sm-fg);
  font-family: var(--sm-font); font-size: 14px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
/* The macOS frame overlays the window-chrome strip on every main panel; pad the
   first row into the frame's declared clearance, exactly like the shell's own
   entry pages do. */
[data-platform='darwin'] [data-skill-market] .sm-topbar {
  height: calc(var(--sm-topbar) + var(--dsh-frame-top-clearance, 0px));
  padding-top: var(--dsh-frame-top-clearance, 0px);
}
[data-skill-market] h1, [data-skill-market] h2, [data-skill-market] h3, [data-skill-market] h4 {
  margin: 0; font-weight: 600; letter-spacing: -0.018em;
}
[data-skill-market] p { margin: 0; }
[data-skill-market] button { font: inherit; color: inherit; cursor: pointer; background: none; border: 0; }
[data-skill-market] input, [data-skill-market] select { font: inherit; color: inherit; }
[data-skill-market] ::selection { background: var(--sm-accent-soft); }
[data-skill-market] :focus-visible { outline: 2px solid var(--sm-accent); outline-offset: 2px; border-radius: 6px; }
[data-skill-market] .sm-num { font-family: var(--sm-font-mono); font-variant-numeric: tabular-nums; }
[data-skill-market] .sm-meta { font-family: var(--sm-font-mono); font-size: 12px; color: var(--sm-muted); }
[data-skill-market] .sm-eyebrow {
  font-family: var(--sm-font-mono); font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--sm-muted);
}
[data-skill-market] svg { display: block; }
[data-skill-market] .sm-ic { width: 17px; height: 17px; flex: 0 0 auto; }

/* ── topbar ────────────────────────────────────────────────────────── */
[data-skill-market] .sm-topbar {
  height: var(--sm-topbar); flex: 0 0 auto;
  display: flex; align-items: center; gap: 14px; padding: 0 20px;
  border-bottom: 1px solid var(--sm-border);
  background: color-mix(in oklch, var(--sm-bg) 88%, transparent);
  backdrop-filter: blur(12px);
}
[data-skill-market] .sm-search { position: relative; flex: 1; max-width: 520px; display: flex; align-items: center; }
/* In the market head it is a block of its own rather than a flex child of the topbar, so it
   needs an explicit width and the spacing that separates it from the chips below. */
[data-skill-market] .sm-search-row { flex: none; max-width: none; width: 100%; margin: 0 0 14px; }
[data-skill-market] .sm-search-row input { height: 42px; }
[data-skill-market] .sm-search > svg { position: absolute; left: 12px; width: 16px; height: 16px; color: var(--sm-muted); pointer-events: none; }
[data-skill-market] .sm-search input {
  width: 100%; height: 38px; padding: 0 14px 0 36px;
  border: 1px solid var(--sm-border); border-radius: var(--sm-radius);
  background: var(--sm-surface); color: var(--sm-fg); font-size: 13.5px;
  transition: border-color .13s ease, box-shadow .13s ease;
}
[data-skill-market] .sm-search input::placeholder { color: var(--sm-muted); }
[data-skill-market] .sm-search input:focus { outline: none; border-color: var(--sm-accent-line); box-shadow: 0 0 0 3px var(--sm-accent-soft); }
[data-skill-market] .sm-topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }

[data-skill-market] .sm-icon-btn {
  width: 34px; height: 34px; border-radius: var(--sm-radius);
  display: grid; place-items: center; color: var(--sm-muted); position: relative;
  transition: background .13s ease, color .13s ease;
}
[data-skill-market] .sm-icon-btn svg { width: 18px; height: 18px; }
[data-skill-market] .sm-icon-btn:hover { background: var(--sm-fg-soft); color: var(--sm-fg); }
[data-skill-market] .sm-icon-btn .sm-dot {
  position: absolute; top: 7px; right: 8px; width: 6px; height: 6px; border-radius: 50%;
  background: var(--sm-accent); border: 1.5px solid var(--sm-bg);
}

/* ── buttons ───────────────────────────────────────────────────────── */
[data-skill-market] .sm-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 14px; border-radius: var(--sm-radius);
  border: 1px solid transparent; font-size: 13px; font-weight: 500;
  letter-spacing: -0.005em; white-space: nowrap;
  transition: background .14s ease, border-color .14s ease, color .14s ease;
}
[data-skill-market] .sm-btn svg { width: 16px; height: 16px; }
[data-skill-market] .sm-btn:active { transform: translateY(1px); }
[data-skill-market] .sm-btn-primary { background: var(--sm-accent); color: var(--sm-surface); border-color: var(--sm-accent); }
[data-skill-market] .sm-btn-primary:hover { background: color-mix(in oklch, var(--sm-accent) 87%, black); }
[data-skill-market] .sm-btn-secondary { background: var(--sm-surface); color: var(--sm-fg); border-color: var(--sm-border); }
[data-skill-market] .sm-btn-secondary:hover { border-color: var(--sm-border-strong); }
[data-skill-market] .sm-btn-ghost { background: transparent; color: var(--sm-muted); padding-inline: 9px; }
[data-skill-market] .sm-btn-ghost:hover { background: var(--sm-fg-soft); color: var(--sm-fg); }
[data-skill-market] .sm-btn-sm { height: 30px; padding: 0 11px; font-size: 12.5px; }
[data-skill-market] .sm-btn[disabled] { opacity: .5; cursor: not-allowed; }

/* ── view tabs ─────────────────────────────────────────────────────── */
[data-skill-market] .sm-viewbar {
  flex: 0 0 auto; display: flex; align-items: center;
  padding: 0 20px; border-bottom: 1px solid var(--sm-border); background: var(--sm-bg);
  overflow-x: auto; scrollbar-width: none;
}
[data-skill-market] .sm-viewbar::-webkit-scrollbar { display: none; }
[data-skill-market] .sm-viewtabs { display: flex; gap: 4px; }
[data-skill-market] .sm-viewtab {
  display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
  padding: 12px 4px; margin: 0 18px -1px 0;
  font-size: 13.5px; font-weight: 500; color: var(--sm-muted);
  border-bottom: 2px solid transparent;
  transition: color .13s ease, border-color .13s ease;
}
[data-skill-market] .sm-viewtab:hover { color: var(--sm-fg); }
[data-skill-market] .sm-viewtab.active { color: var(--sm-fg); border-bottom-color: var(--sm-fg); }
[data-skill-market] .sm-vt-count {
  font-family: var(--sm-font-mono); font-size: 11px; line-height: 1;
  padding: 3px 7px; border-radius: 999px; background: var(--sm-fg-soft); color: var(--sm-muted);
}
[data-skill-market] .sm-viewtab.active .sm-vt-count { color: var(--sm-fg); }

/* ── fixed head + scrolling list ───────────────────────────────────── */
/* Only the card list scrolls: the topbar, view tabs, page head and category
   chips stay put, so the sort control and the filters are reachable at any
   scroll depth. The shared measure runs wide (1760px) so a large window really
   does get more columns — see the responsive block at the end of this sheet. */
[data-skill-market] .sm-bounded { max-width: 1760px; margin: 0 auto; }
[data-skill-market] .sm-fixed {
  flex: 0 0 auto; padding: 18px 24px 0; border-bottom: 1px solid var(--sm-border);
  background: var(--sm-bg);
}
[data-skill-market] .sm-content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
[data-skill-market] .sm-inner { padding: 20px 24px 60px; }
[data-skill-market] .sm-statusbar {
  height: var(--sm-statusbar); flex: 0 0 auto; display: flex; align-items: center; gap: 16px;
  padding: 0 20px; border-top: 1px solid var(--sm-border);
  font-family: var(--sm-font-mono); font-size: 11px; color: var(--sm-muted); background: var(--sm-bg);
  overflow: hidden; white-space: nowrap;
}
[data-skill-market] .sm-statusbar .sm-live { display: inline-flex; align-items: center; gap: 6px; color: var(--sm-ok); }
[data-skill-market] .sm-statusbar .sm-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--sm-ok); }
[data-skill-market] .sm-statusbar .sm-live.is-error { color: var(--sm-warn); }
[data-skill-market] .sm-statusbar .sm-live.is-error::before { background: var(--sm-warn); }
[data-skill-market] .sm-statusbar .sm-live.is-idle { color: var(--sm-muted); }
[data-skill-market] .sm-statusbar .sm-live.is-idle::before { background: var(--sm-muted); }
[data-skill-market] .sm-statusbar .sm-spacer { margin-left: auto; }

/* ── page head ─────────────────────────────────────────────────────── */
[data-skill-market] .sm-page-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 24px; flex-wrap: wrap; margin-bottom: 14px;
}
[data-skill-market] .sm-page-title { font-size: 26px; letter-spacing: -0.025em; }
[data-skill-market] .sm-page-sub { color: var(--sm-muted); font-size: 13.5px; margin-top: 5px; max-width: 62ch; }
[data-skill-market] .sm-page-actions { display: flex; align-items: center; gap: 10px; }

[data-skill-market] .sm-select-wrap { position: relative; display: inline-flex; align-items: center; }
[data-skill-market] .sm-select-wrap::after {
  content: '▾'; position: absolute; right: 11px; pointer-events: none; font-size: 10px; color: var(--sm-muted);
}
[data-skill-market] .sm-select-wrap select {
  appearance: none; -webkit-appearance: none; height: 34px; padding: 0 30px 0 12px;
  border: 1px solid var(--sm-border); border-radius: var(--sm-radius);
  background: var(--sm-surface); font-size: 13px;
}
[data-skill-market] .sm-select-wrap select:hover { border-color: var(--sm-border-strong); }

/* ── chips ─────────────────────────────────────────────────────────── */
[data-skill-market] .sm-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; }
[data-skill-market] .sm-chip {
  height: 30px; padding: 0 13px; border-radius: 999px;
  border: 1px solid var(--sm-border); background: var(--sm-surface);
  color: var(--sm-muted); font-size: 12.5px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 7px;
  transition: border-color .13s ease, color .13s ease, background .13s ease;
}
[data-skill-market] .sm-chip:hover { border-color: var(--sm-border-strong); color: var(--sm-fg); }
[data-skill-market] .sm-chip.active { background: var(--sm-fg); border-color: var(--sm-fg); color: var(--sm-surface); }
[data-skill-market] .sm-chip .sm-chip-n { font-family: var(--sm-font-mono); font-size: 11px; opacity: .72; }

/* ── sections ──────────────────────────────────────────────────────── */
[data-skill-market] .sm-section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
[data-skill-market] .sm-section-head h2 { font-size: 15px; letter-spacing: -0.01em; }
[data-skill-market] .sm-section-head .sm-meta { font-weight: 400; }

/* ── skill cards ───────────────────────────────────────────────────── */
/* auto-fit + a fixed 280px floor fills every row instead of leaving a gap at the
   end. A fixed floor beats a vw preference here — a percentage floor grows with
   the viewport and ends up *reducing* the column count on a wide screen, and a
   floor above 280px starts taking columns away from a 1920px window.
   Measured column counts (tools/grid-columns.mjs):
     360-430px -> 1, 600 -> 1, 820 -> 2, 1024 -> 3, 1366 -> 4, 1440 -> 4, 1920 -> 6
   min(100%, ...) keeps one column from overflowing in a very narrow panel. */
[data-skill-market] .sm-grid-cards {
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
}
[data-skill-market] .sm-card {
  position: relative; display: flex; flex-direction: column; text-align: left;
  background: var(--sm-surface); border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-lg); padding: 16px;
  transition: border-color .14s ease, box-shadow .14s ease, transform .14s ease;
}
[data-skill-market] .sm-card:hover { border-color: var(--sm-border-strong); box-shadow: var(--sm-shadow-sm); transform: translateY(-1px); }
[data-skill-market] .sm-card.is-open { border-color: var(--sm-accent-line); box-shadow: 0 0 0 3px var(--sm-accent-soft); }
[data-skill-market] .sm-skill-card { cursor: pointer; min-height: 180px; }
[data-skill-market] .sm-skill-icon {
  width: 40px; height: 40px; flex: 0 0 auto; border-radius: 11px; overflow: hidden;
  border: 1px solid var(--sm-border); background: var(--sm-bg);
  display: grid; place-items: center; color: var(--sm-fg);
}
[data-skill-market] .sm-skill-icon svg { width: 20px; height: 20px; }
[data-skill-market] .sm-skill-icon img { width: 100%; height: 100%; object-fit: cover; }
[data-skill-market] .sm-skill-icon.lg { width: 52px; height: 52px; border-radius: 14px; }
[data-skill-market] .sm-skill-icon.lg svg { width: 26px; height: 26px; }
[data-skill-market] .sm-skill-icon.is-tinted { border-color: transparent; }
/* The card header row: icon, then the name/publisher block. This rule was missing entirely, so the
   header had no layout of its own and its children stacked as blocks — while the title rule below
   declared flex: 1, which is inert inside a non-flex parent. The card never got the row it was
   written for. */
[data-skill-market] .sm-card-top { display: flex; align-items: flex-start; gap: 10px; }
[data-skill-market] .sm-card-title { min-width: 0; flex: 1; }
[data-skill-market] .sm-name-row { display: flex; align-items: center; gap: 5px; }
[data-skill-market] .sm-skill-name {
  font-size: 14.5px; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-skill-market] .sm-verified { color: var(--sm-accent); flex: 0 0 auto; }
[data-skill-market] .sm-verified svg { width: 14px; height: 14px; }
/* Safety scan verdict. Green because that is what it means, and only ever drawn when every vendor
   reported benign — see SafetyBadge. */
[data-skill-market] .sm-safety {
  display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto;
  font-size: 11.5px; font-weight: 600; color: var(--sm-ok);
}
[data-skill-market] .sm-safety svg { width: 14px; height: 14px; }
[data-skill-market] .sm-safety-compact svg { width: 13px; height: 13px; }
/* One row per scanning vendor: mark, name, that vendor's own verdict, and its report link pushed to
   the right edge. The row is the unit because the vendors are independent — one can pass while another
   does not, and that disagreement is the thing worth seeing. */
[data-skill-market] .sm-safety-vendors { display: flex; flex-direction: column; gap: 2px; }
[data-skill-market] .sm-safety-vendor {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  font-size: 13px; line-height: 1.5; border-radius: 9px;
  transition: background .13s ease;
}
[data-skill-market] .sm-safety-vendor:hover { background: var(--sm-bg); }
[data-skill-market] .sm-safety-mark { display: inline-flex; flex: 0 0 auto; color: var(--sm-ok); }
[data-skill-market] .sm-safety-mark svg { width: 15px; height: 15px; }
/* Any verdict other than benign: the mark keeps the neutral colour rather than turning red or amber.
   The panel states what the vendor said; it does not grade a scan it cannot interpret. */
[data-skill-market] .sm-safety-vendor.plain .sm-safety-mark { color: var(--sm-muted); }
[data-skill-market] .sm-safety-label { flex: 1; min-width: 0; }
[data-skill-market] .sm-safety-label strong { font-weight: 600; margin-right: 6px; }
[data-skill-market] .sm-safety-report {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: var(--sm-muted);
}
[data-skill-market] .sm-safety-report:hover { color: var(--sm-fg); }
[data-skill-market] .sm-publisher {
  font-size: 12px; color: var(--sm-muted); display: block; max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-skill-market] .sm-save-btn {
  width: 28px; height: 28px; border-radius: 7px; flex: 0 0 auto;
  display: grid; place-items: center; color: var(--sm-muted);
  transition: background .13s ease, color .13s ease;
}
/* On a catalog card the bookmark sits in the card's top-right corner rather than in the header row:
   it is a per-card action, and inline it competed with the skill's name for width. The card article
   is already positioned, so this needs no wrapper. */
[data-skill-market] .sm-card > .sm-save-btn { position: absolute; top: 12px; right: 12px; z-index: 2; margin: 0; }
/* Keeps a long name from running under the pinned button. */
[data-skill-market] .sm-skill-card .sm-card-title { padding-right: 34px; }
[data-skill-market] .sm-save-btn svg { width: 16px; height: 16px; }
[data-skill-market] .sm-save-btn:hover { background: var(--sm-fg-soft); color: var(--sm-fg); }
[data-skill-market] .sm-save-btn.saved { color: var(--sm-fg); }
[data-skill-market] .sm-save-btn.saved svg { fill: currentColor; }
[data-skill-market] .sm-card-desc {
  color: var(--sm-muted); font-size: 13px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
[data-skill-market] .sm-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 11px; }
[data-skill-market] .sm-tag {
  font-size: 11px; color: var(--sm-muted);
  border: 1px solid var(--sm-border); border-radius: 999px; padding: 2px 8px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
[data-skill-market] .sm-card-foot { display: flex; align-items: center; gap: 12px; margin-top: auto; padding-top: 14px; }
[data-skill-market] .sm-stats { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sm-muted); }
[data-skill-market] .sm-stats .sm-sep { opacity: .5; }
/* Figures are icon + number and must never wrap: the row sits at the bottom of a card whose height should not
   depend on the language. */
[data-skill-market] .sm-stats > * { flex: 0 0 auto; white-space: nowrap; }
[data-skill-market] .sm-stats .sm-stat { display: inline-flex; align-items: center; gap: 3px; }
[data-skill-market] .sm-stats .sm-stat svg { width: 13px; height: 13px; opacity: .75; }
[data-skill-market] .sm-stats .sm-rating { display: inline-flex; align-items: center; gap: 3px; color: var(--sm-fg); }
[data-skill-market] .sm-stats .sm-rating svg { width: 13px; height: 13px; color: var(--sm-star); }
[data-skill-market] .sm-install-btn {
  margin-left: auto; height: 31px; padding: 0 15px; border-radius: var(--sm-radius);
  border: 1px solid var(--sm-border); background: var(--sm-surface); color: var(--sm-fg);
  font-size: 12.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;
  transition: background .14s ease, border-color .14s ease, color .14s ease;
}
[data-skill-market] .sm-install-btn svg { width: 15px; height: 15px; }
[data-skill-market] .sm-install-btn:hover { border-color: var(--sm-accent); color: var(--sm-accent); background: var(--sm-accent-soft); }
[data-skill-market] .sm-install-btn.installed { color: var(--sm-muted); border-color: var(--sm-border); background: var(--sm-fg-softer); }
[data-skill-market] .sm-install-btn.installed:hover { color: var(--sm-fg); border-color: var(--sm-border-strong); background: var(--sm-fg-soft); }
/* An installed-but-behind card reads as actionable, not as done. */
[data-skill-market] .sm-install-btn.is-update {
  background: var(--sm-accent); color: var(--sm-surface); border-color: var(--sm-accent);
}
[data-skill-market] .sm-install-btn.is-update:hover {
  background: color-mix(in oklch, var(--sm-accent) 88%, var(--sm-fg));
  border-color: color-mix(in oklch, var(--sm-accent) 88%, var(--sm-fg));
  color: var(--sm-surface);
}
[data-skill-market] .sm-install-btn.is-busy { color: var(--sm-muted); cursor: progress; }
[data-skill-market] .sm-install-btn[disabled] { opacity: .6; cursor: progress; }
/* A failed install keeps its reason on the card: the Host's own text (network,
   size ceiling, missing SKILL.md, checksum mismatch) is more useful than a
   generic failure label. */
[data-skill-market] .sm-install-error {
  margin-top: 8px; font-size: 12px; line-height: 1.45; color: var(--sm-danger);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  overflow-wrap: anywhere;
}
[data-skill-market] .sm-link-out { display: inline-flex; align-items: center; gap: 4px; }
[data-skill-market] .sm-link-out svg { width: 13px; height: 13px; }

/* ── restart advice banner ─────────────────────────────────────────── */
/* Advice, not a gate: the panel never blocks a change and never nags beyond
   this banner, which the user can dismiss with 知道了. It exists because the
   page cannot restart the process — on the desktop the Host is a child of the
   Electron shell — so the honest move is to name the step, not to fake it. */
[data-skill-market] .sm-restart-banner {
  display: flex; align-items: flex-start; gap: 14px;
  border: 1px solid var(--sm-accent-line);
  background: color-mix(in oklch, var(--sm-accent) 7%, var(--sm-surface));
  border-radius: var(--sm-radius-lg); padding: 14px 16px; margin-bottom: 20px;
}
[data-skill-market] .sm-rb-ic {
  width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px;
  display: grid; place-items: center; color: var(--sm-accent); background: var(--sm-accent-soft);
}
[data-skill-market] .sm-rb-ic svg { width: 18px; height: 18px; }
[data-skill-market] .sm-rb-text { flex: 1; min-width: 0; }
[data-skill-market] .sm-rb-text strong { font-size: 13.5px; font-weight: 600; }
[data-skill-market] .sm-rb-text p { font-size: 12.5px; color: var(--sm-muted); margin-top: 4px; line-height: 1.55; }
[data-skill-market] .sm-rb-actions { display: flex; flex-direction: column; gap: 6px; flex: 0 0 auto; }

[data-skill-market] .sm-loadmore {
  grid-column: 1 / -1; display: flex; align-items: center; justify-content: center;
  gap: 14px; padding: 22px 0 4px; flex-wrap: wrap;
}

/* ── list rows ─────────────────────────────────────────────────────── */
[data-skill-market] .sm-list { border-top: 1px solid var(--sm-border); }
[data-skill-market] .sm-list-row {
  display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 14px; align-items: center;
  padding: 14px 4px; border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-row-main { min-width: 0; }
[data-skill-market] .sm-list-row .sm-name-row { gap: 7px; }
[data-skill-market] .sm-list-row h3 {
  font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-skill-market] .sm-row-sub {
  font-size: 12px; color: var(--sm-muted); margin-top: 3px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
[data-skill-market] .sm-row-sub .sm-sep { opacity: .5; }
/* Figures in a row's sub-line are icon + number, matching the card stats row: an icon needs no translation and
   cannot wrap onto a second line the way "2.4M downloads" did in English. */
[data-skill-market] .sm-row-sub .sm-stat { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
[data-skill-market] .sm-row-sub .sm-stat svg { width: 12px; height: 12px; opacity: .75; }
[data-skill-market] .sm-row-actions { display: flex; align-items: center; gap: 10px; }
[data-skill-market] .sm-badge {
  font-family: var(--sm-font-mono); font-size: 10.5px; letter-spacing: 0.03em;
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
}
[data-skill-market] .sm-badge.update { color: var(--sm-warn); background: var(--sm-warn-soft); }
[data-skill-market] .sm-badge.ok { color: var(--sm-ok); background: var(--sm-ok-soft); }
[data-skill-market] .sm-badge.plain { color: var(--sm-muted); background: var(--sm-fg-soft); }
[data-skill-market] .sm-src-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--sm-font-mono); font-size: 10.5px; letter-spacing: 0.03em;
  color: var(--sm-muted); background: var(--sm-fg-soft); border-radius: 999px; padding: 2px 8px;
}
[data-skill-market] .sm-src-badge svg { width: 11px; height: 11px; }

[data-skill-market] .sm-switch { position: relative; width: 38px; height: 22px; flex: 0 0 auto; display: inline-block; }
[data-skill-market] .sm-switch input {
  position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer;
}
[data-skill-market] .sm-switch .sm-track {
  position: absolute; inset: 0; border-radius: 999px; background: var(--sm-border); transition: background .16s ease;
}
[data-skill-market] .sm-switch .sm-thumb {
  position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--sm-surface); box-shadow: var(--sm-shadow-sm); transition: transform .16s ease;
}
[data-skill-market] .sm-switch input:checked + .sm-track { background: var(--sm-ok); }
[data-skill-market] .sm-switch input:checked ~ .sm-thumb { transform: translateX(16px); }
[data-skill-market] .sm-switch input:focus-visible + .sm-track { outline: 2px solid var(--sm-accent); outline-offset: 2px; }

/* ── empty + skeleton ──────────────────────────────────────────────── */
[data-skill-market] .sm-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 64px 20px; gap: 6px;
}
[data-skill-market] .sm-empty .sm-empty-mark {
  width: 46px; height: 46px; border-radius: 13px; border: 1px solid var(--sm-border);
  display: grid; place-items: center; color: var(--sm-muted); margin-bottom: 8px;
}
[data-skill-market] .sm-empty .sm-empty-mark svg { width: 22px; height: 22px; }
[data-skill-market] .sm-empty h3 { font-size: 15px; }
[data-skill-market] .sm-empty p { color: var(--sm-muted); font-size: 13px; max-width: 42ch; }
[data-skill-market] .sm-empty .sm-empty-actions { margin-top: 12px; display: flex; gap: 10px; }
[data-skill-market] .sm-empty.is-error .sm-empty-mark { color: var(--sm-warn); border-color: var(--sm-warn-line); }

[data-skill-market] .sm-skeleton {
  border: 1px solid var(--sm-border); border-radius: var(--sm-radius-lg);
  background: var(--sm-surface); padding: 16px; min-height: 180px;
  display: flex; flex-direction: column; gap: 12px;
}
[data-skill-market] .sm-sk-line {
  height: 11px; border-radius: 999px; background: var(--sm-fg-soft);
  animation: sm-pulse 1.5s ease-in-out infinite;
}
[data-skill-market] .sm-sk-head { display: flex; gap: 11px; }
[data-skill-market] .sm-sk-plate { width: 40px; height: 40px; border-radius: 11px; background: var(--sm-fg-soft); animation: sm-pulse 1.5s ease-in-out infinite; }
[data-skill-market] .sm-sk-head .sm-sk-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
@keyframes sm-pulse { 0%, 100% { opacity: .45; } 50% { opacity: .9; } }

/* ── stat cards ────────────────────────────────────────────────────── */
[data-skill-market] .sm-stat-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 30px; }
[data-skill-market] .sm-stat-card { background: var(--sm-surface); border: 1px solid var(--sm-border); border-radius: var(--sm-radius-lg); padding: 16px; }
[data-skill-market] .sm-stat-card .sm-k { font-size: 12px; color: var(--sm-muted); }
[data-skill-market] .sm-stat-card .sm-v {
  font-family: var(--sm-font-mono); font-size: 26px; font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em; margin-top: 6px;
}

/* ── local import dropzone ─────────────────────────────────────────── */
[data-skill-market] .sm-dropzone {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 5px; padding: 38px 24px; margin-bottom: 30px;
  border: 1.5px dashed color-mix(in oklch, var(--sm-fg) 24%, var(--sm-border));
  border-radius: var(--sm-radius-lg); background: var(--sm-surface);
  cursor: pointer; transition: border-color .15s ease, background .15s ease;
}
[data-skill-market] .sm-dropzone:hover { border-color: var(--sm-accent-line); }
[data-skill-market] .sm-dropzone.dragover { border-color: var(--sm-accent); background: var(--sm-accent-soft); }
[data-skill-market] .sm-dropzone .sm-dz-ic {
  width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center;
  color: var(--sm-accent); background: var(--sm-accent-soft); margin-bottom: 7px;
}
[data-skill-market] .sm-dropzone .sm-dz-ic svg { width: 22px; height: 22px; }
[data-skill-market] .sm-dropzone h3 { font-size: 15.5px; }
[data-skill-market] .sm-dropzone p { color: var(--sm-muted); font-size: 12.5px; max-width: 48ch; }
[data-skill-market] .sm-dropzone .sm-dz-actions { margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; }
/* The one action in the dropzone, so it carries its own weight rather than looking like a link. */
[data-skill-market] .sm-dropzone .sm-dz-browse {
  height: 40px; padding: 0 22px; font-size: 13.5px; border-radius: 10px;
}
[data-skill-market] .sm-dropzone .sm-dz-browse svg { width: 16px; height: 16px; }

/* ── confirmation dialog ───────────────────────────────────────────── */
[data-skill-market] .sm-confirm-layer { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; }
[data-skill-market] .sm-confirm-scrim {
  position: absolute; inset: 0; background: var(--sm-scrim);
  backdrop-filter: blur(2px); animation: sm-fade .14s ease;
}
[data-skill-market] .sm-confirm {
  position: relative; width: min(400px, calc(100% - 40px));
  background: var(--sm-surface); border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-lg); box-shadow: var(--sm-shadow-md);
  padding: 20px; animation: sm-pop .16s cubic-bezier(.2, .9, .3, 1.1);
}
[data-skill-market] .sm-confirm-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
[data-skill-market] .sm-confirm-body { margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--sm-fg); }
/* The concrete target, so the answer is informed rather than about "the skill" in the abstract. */
[data-skill-market] .sm-confirm-detail {
  margin-top: 10px; padding: 8px 10px; border-radius: 8px;
  background: var(--sm-bg); border: 1px solid var(--sm-border);
  font-size: 11.5px; color: var(--sm-muted); overflow-wrap: anywhere;
}
[data-skill-market] .sm-confirm-actions { margin-top: 18px; display: flex; justify-content: flex-end; gap: 9px; }
[data-skill-market] .sm-btn-danger {
  background: var(--sm-danger); border-color: var(--sm-danger); color: var(--sm-surface);
}
[data-skill-market] .sm-btn-danger:hover { background: color-mix(in oklch, var(--sm-danger) 86%, var(--sm-fg)); }
[data-skill-market] .sm-btn-danger:focus-visible { outline: 2px solid var(--sm-danger-soft); outline-offset: 2px; }

/* [dsh-perfect-ui patch] "Check all plugin updates" dialog: same shell as the
   confirmation dialog, just tall enough to list a few rows and scroll. */
[data-skill-market] .sm-pu-card { width: min(520px, calc(100% - 40px)); max-height: calc(100% - 40px); display: flex; flex-direction: column; }
[data-skill-market] .sm-pu-list {
  margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--sm-border);
  overflow-y: auto; min-height: 0; display: flex; flex-direction: column; gap: 8px;
}
[data-skill-market] .sm-pu-row { display: flex; align-items: center; gap: 10px; }
[data-skill-market] .sm-pu-row.is-clean { opacity: .72; }
[data-skill-market] .sm-pu-rowmain { flex: 1; min-width: 0; }
[data-skill-market] .sm-pu-name {
  display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
[data-skill-market] .sm-pu-kind {
  flex: none; padding: 1px 5px; border-radius: 4px; font-size: 9.5px; font-weight: 600;
  background: var(--sm-fg-soft); color: var(--sm-muted);
}
[data-skill-market] .sm-pu-note { margin-top: 2px; font-size: 11.5px; line-height: 1.5; color: var(--sm-muted); overflow-wrap: anywhere; }
[data-skill-market] .sm-confirm-body.sm-pu-err { color: var(--sm-danger); }
/* Auto-detection result strip: quiet by default, only shows when something is
   actually pending, and carries its own dismiss. */
[data-skill-market] .sm-pu-stage {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; font-size: 12px; color: var(--sm-fg);
  background: var(--sm-accent-soft, var(--sm-fg-soft));
  border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-pu-stage-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-skill-market] .sm-pu-stage .sm-icon-btn { width: 24px; height: 24px; }
[data-skill-market] .sm-pu-badge {
  margin-left: 2px; padding: 0 5px; border-radius: 999px; font-size: 10px; font-weight: 700;
  line-height: 15px; background: var(--sm-accent); color: var(--sm-surface);
}
[data-skill-market] .sm-btn-ghost.sm-pu-hit { color: var(--sm-accent); }
/* 只有一个插件可检测，角标用圆点而不是数字 */
[data-skill-market] .sm-pu-badge.sm-pu-dot { padding: 0; width: 7px; height: 7px; min-width: 7px; line-height: 0; }
@keyframes sm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sm-pop { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }

/* ── inspector drawer ──────────────────────────────────────────────── */
[data-skill-market] .sm-scrim {
  position: absolute; inset: 0; z-index: 35; background: var(--sm-scrim);
  opacity: 0; pointer-events: none; transition: opacity .22s ease;
}
[data-skill-market] .sm-scrim.show { opacity: 1; pointer-events: auto; }
[data-skill-market] .sm-inspector {
  position: absolute; top: 0; right: 0; bottom: 0; width: 560px; max-width: 94%;
  z-index: 40; background: var(--sm-surface); border-left: 1px solid var(--sm-border);
  box-shadow: var(--sm-shadow-md);
  transform: translateX(101%); transition: transform .24s cubic-bezier(.4, 0, .2, 1);
  display: flex; flex-direction: column;
}
[data-skill-market] .sm-inspector.open { transform: none; }
[data-skill-market] .sm-insp-head { padding: 20px 20px 0; }
[data-skill-market] .sm-insp-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
[data-skill-market] .sm-insp-head h2 { font-size: 21px; letter-spacing: -0.02em; margin-top: 14px; }
[data-skill-market] .sm-insp-pub {
  display: flex; align-items: center; gap: 6px; color: var(--sm-muted);
  font-size: 13px; margin-top: 5px; flex-wrap: wrap;
}
[data-skill-market] .sm-insp-pub .sm-verified svg { width: 14px; height: 14px; }
[data-skill-market] .sm-dot-sep { opacity: .5; }
[data-skill-market] .sm-insp-actions { display: flex; gap: 9px; margin-top: 16px; }
[data-skill-market] .sm-insp-actions .sm-btn { flex: 1; justify-content: center; }
[data-skill-market] .sm-insp-meta {
  display: flex; gap: 14px; flex-wrap: wrap; margin-top: 13px;
  font-family: var(--sm-font-mono); font-size: 11.5px; color: var(--sm-muted);
}
/* a stray backtick:  here */
[data-skill-market] .sm-tabs {
  display: flex; gap: 2px; padding: 14px 20px 0; border-bottom: 1px solid var(--sm-border);
  /* The labels are nowrap, so a narrow drawer scrolls the strip. The scrollbar is hidden for the same
     reason the view bar hides its own: a scrollbar ranged along the drawer's tab row reads as a layout
     defect, and the strip still scrolls by wheel, trackpad and keyboard. */
  position: sticky; top: 0; background: var(--sm-surface);
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
}
[data-skill-market] .sm-tabs::-webkit-scrollbar { display: none; }
[data-skill-market] .sm-tab {
  padding: 9px 11px 11px; font-size: 13px; color: var(--sm-muted); font-weight: 500;
  border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;
  transition: color .13s ease, border-color .13s ease;
}
/* A tab that carries an icon, for the one whose subject the icon already means. Six tabs is enough
   that the shield earns its place as a landmark; the others stay plain text. */
[data-skill-market] .sm-tab-icon {
  display: inline-flex; align-items: center; gap: 5px;
}
[data-skill-market] .sm-tab-icon svg { width: 13px; height: 13px; }
/* The scan passed. Deliberately the **icon only**: the tab is named 安全扫描, so tinting its label
   green would read as "safe scan" — a verdict on a scan that may not have passed. A green shield
   beside neutral text says "this passed" without turning the tab's own name into a claim. */
[data-skill-market] .sm-tab.sm-tab-safe svg { color: var(--sm-ok); }
[data-skill-market] .sm-tab:hover { color: var(--sm-fg); }
[data-skill-market] .sm-tab.active { color: var(--sm-fg); border-bottom-color: var(--sm-fg); }
[data-skill-market] .sm-insp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; }
[data-skill-market] .sm-insp-body h4 {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--sm-muted);
  font-family: var(--sm-font-mono); font-weight: 500; margin: 22px 0 10px;
}
[data-skill-market] .sm-insp-body h4:first-child { margin-top: 0; }
[data-skill-market] .sm-insp-body p { font-size: 13.5px; color: var(--sm-fg); line-height: 1.62; }
[data-skill-market] .sm-insp-body p + p { margin-top: 10px; }
[data-skill-market] .sm-body-note { color: var(--sm-muted); font-size: 12.5px; margin-bottom: 6px; }
[data-skill-market] .sm-feat-list { display: flex; flex-direction: column; gap: 9px; padding: 0; margin: 0; }
[data-skill-market] .sm-feat-list li { display: flex; gap: 9px; font-size: 13.5px; list-style: none; }
[data-skill-market] .sm-feat-list li svg { width: 16px; height: 16px; color: var(--sm-ok); flex: 0 0 auto; margin-top: 3px; }

/* ── rendered Markdown (a skill's own SKILL.md) ─────────────────────── */
[data-skill-market] .sm-md { font-size: 13.5px; line-height: 1.66; color: var(--sm-fg); }
[data-skill-market] .sm-md > * + * { margin-top: 10px; }
[data-skill-market] .sm-md h3,
[data-skill-market] .sm-md h4,
[data-skill-market] .sm-md h5,
[data-skill-market] .sm-md h6 { font-size: 13.5px; font-weight: 650; margin-top: 18px; }
[data-skill-market] .sm-md ul { padding-left: 20px; }
[data-skill-market] .sm-md li { list-style: disc; }
[data-skill-market] .sm-md li + li { margin-top: 4px; }
[data-skill-market] .sm-md code {
  font-family: var(--sm-font-mono); font-size: 12px; padding: 1px 5px;
  border-radius: 5px; background: var(--sm-bg); border: 1px solid var(--sm-border);
}
[data-skill-market] .sm-md pre {
  background: var(--sm-bg); border: 1px solid var(--sm-border); border-radius: 9px;
  padding: 11px 13px; overflow-x: auto;
}
[data-skill-market] .sm-md pre code { background: none; border: 0; padding: 0; font-size: 12px; line-height: 1.55; }
[data-skill-market] .sm-md blockquote {
  border-left: 3px solid var(--sm-accent-line); padding: 2px 0 2px 12px; color: var(--sm-muted);
}
/* GFM tables in the panel's own renderer — the host renderer brings its own styling. A skill document's
   tables are wide, so the wrapper scrolls rather than squeezing the columns. */
[data-skill-market] .sm-table-wrap { overflow-x: auto; margin-top: 10px; }
[data-skill-market] .sm-table { border-collapse: collapse; font-size: 12.5px; min-width: 100%; }
[data-skill-market] .sm-table th,
[data-skill-market] .sm-table td {
  border: 1px solid var(--sm-border); padding: 6px 10px; vertical-align: top;
}
[data-skill-market] .sm-table th { background: var(--sm-bg); font-weight: 650; text-align: left; }
[data-skill-market] .sm-md-link { color: var(--sm-accent); text-decoration: underline; }
/* A link to a neighbouring file of the same bundle, drawn by the panel's own renderer. When the preview can
   follow it, it is a button and is coloured like one; when it cannot (the overview has no bundle at hand) it
   stays plain text, because there is nowhere for it to go. */
[data-skill-market] .sm-md-ref { text-align: left; }
[data-skill-market] button.sm-md-ref { color: var(--sm-accent); }
[data-skill-market] button.sm-md-ref:hover { text-decoration: underline; }

/* ── file tree (flat upstream paths, drawn as a hierarchy) ──────────── */
[data-skill-market] .sm-tree {
  border: 1px solid var(--sm-border); border-radius: 10px; overflow: hidden;
  background: var(--sm-bg); margin-top: 6px;
}
[data-skill-market] .sm-tree-row {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 5px 10px; font-size: 12.5px; color: var(--sm-fg);
  background: none; border: 0; text-align: left; font: inherit;
}
[data-skill-market] .sm-tree-dir { cursor: pointer; font-weight: 600; }
[data-skill-market] .sm-tree-dir:hover { background: var(--sm-accent-soft); }
[data-skill-market] .sm-tree-row svg { flex: 0 0 auto; color: var(--sm-muted); }
[data-skill-market] .sm-tree-dir svg:last-of-type { color: var(--sm-accent); }
[data-skill-market] .sm-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-skill-market] .sm-tree-file .sm-tree-name { font-family: var(--sm-font-mono); font-size: 12px; }
[data-skill-market] .sm-tree-meta { color: var(--sm-muted); font-size: 11px; flex: 0 0 auto; }
[data-skill-market] .sm-tree-ic { width: 13px; flex: 0 0 auto; }
[data-skill-market] .sm-tree-file:hover { background: var(--sm-accent-soft); }

/* ── file preview ───────────────────────────────────────────────────── */
[data-skill-market] .sm-preview-layer {
  position: absolute; inset: 0; z-index: 58; display: grid; place-items: center; padding: 22px;
}
[data-skill-market] .sm-preview-scrim {
  position: absolute; inset: 0; background: var(--sm-scrim);
  backdrop-filter: blur(2px); animation: sm-fade .14s ease;
}
/* The dialog gets the whole panel to itself; the drawer it was opened from stays behind it. */
[data-skill-market] .sm-preview-dialog {
  position: relative; display: flex; flex-direction: column; overflow: hidden;
  width: min(1040px, 100%); height: min(760px, 100%);
  background: var(--sm-surface); border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-lg); box-shadow: var(--sm-shadow-md);
  animation: sm-pop .16s cubic-bezier(.2, .9, .3, 1.1);
}
[data-skill-market] .sm-preview-head {
  display: flex; align-items: center; gap: 10px; flex: 0 0 auto;
  padding: 13px 16px; border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-preview-head > svg { flex: 0 0 auto; }
/* The name and the path are one line of text, so they share a baseline instead of each being centred in
   its own line box: centring leaves the smaller path sitting a few pixels above the name's baseline. */
[data-skill-market] .sm-preview-title {
  display: flex; align-items: baseline; gap: 10px;
  flex: 1 1 auto; min-width: 0;
}
[data-skill-market] .sm-preview-name { font-size: 13.5px; font-weight: 600; flex: 0 0 auto; }
[data-skill-market] .sm-preview-path {
  flex: 0 1 auto; min-width: 0; font-size: 11.5px; color: var(--sm-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
[data-skill-market] .sm-preview-body { flex: 1; min-height: 0; overflow: auto; padding: 18px 20px; }
[data-skill-market] .sm-preview-foot {
  flex: 0 0 auto; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 10px 16px; border-top: 1px solid var(--sm-border);
  color: var(--sm-muted); font-size: 12px;
}
/* A narrow panel has no room to spare around a dialog, so it becomes a sheet. */
@media (max-width: 920px) {
  [data-skill-market] .sm-preview-layer { padding: 0; }
  [data-skill-market] .sm-preview-dialog { width: 100%; height: 100%; border-radius: 0; border: 0; }
}
[data-skill-market] .sm-preview-label {
  font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--sm-muted); margin: 0 0 6px;
}
[data-skill-market] .sm-preview-code {
  background: var(--sm-bg); border: 1px solid var(--sm-border); border-radius: 10px;
  padding: 12px 14px; overflow: auto;
}
[data-skill-market] .sm-preview-code code {
  font-family: var(--sm-font-mono); font-size: 12px; line-height: 1.55;
  white-space: pre; color: var(--sm-fg);
}
/* The host's code block brings its own frame and palette; this fits it inside the dialog and gives the block
   a surface that separates it from the page. */
[data-skill-market] .sm-preview-block {
  border-radius: 10px; overflow: hidden;
  border: 1px solid var(--sm-border); background: var(--sm-bg);
}
/* Code colour, scoped to the panel.
   The host's palette is tuned for prose, where a code sample is a side note between two sentences. In a file
   preview the code *is* the content, and those tokens washed out against the block: the greys and the pale
   blues read as plain text at 12px. Same hues, taken several steps deeper in light and brighter in dark, and
   the block gets the panel's own surface so its edge is visible. */
[data-skill-market] {
  --shiki-background: var(--sm-bg);
  --shiki-foreground: var(--sm-fg);
  --shiki-token-constant: #0b5ed7;
  --shiki-token-string: #116329;
  --shiki-token-string-expression: #116329;
  --shiki-token-comment: #5c6773;
  --shiki-token-keyword: #bf3989;
  --shiki-token-parameter: #bc4c00;
  --shiki-token-function: #6639ba;
  --shiki-token-punctuation: #3b444d;
  --shiki-token-link: #0969da;
}
body[data-ds-dark-theme] [data-skill-market] {
  --shiki-token-constant: #79c0ff;
  --shiki-token-string: #7ee787;
  --shiki-token-string-expression: #56d364;
  --shiki-token-comment: #8b949e;
  --shiki-token-keyword: #ff9bce;
  --shiki-token-parameter: #ffa657;
  --shiki-token-function: #d2a8ff;
  --shiki-token-punctuation: #c9d1d9;
  --shiki-token-link: #79c0ff;
}
/* Host markdown inside the drawer (the summary). Only the panel's typography is set here: tables,
   headings and the rest come from the host's markdown styles, which are global and already themed. */
[data-skill-market] .sm-prose { font-size: 13.5px; line-height: 1.62; color: var(--sm-fg); }
[data-skill-market] .sm-prose > * + * { margin-top: 10px; }
/* "svg { display: block }" above is right for this panel's icons — they are the only thing in their box.
   Host markdown puts a glyph *inside* a run of text (an external link's globe, for one), so as a block it
   took a line of its own and left the link stranded underneath. Matched by the stable part of the shell's
   CSS-modules class name ('_markdown_…'), which is what the component actually emits. */
[data-skill-market] [class*="markdown"] svg,
[data-skill-market] .sm-prose svg,
[data-skill-market] .sm-md svg,
[data-skill-market] .sm-preview-body svg {
  display: inline-block; vertical-align: -0.15em;
}

/* ── version history ────────────────────────────────────────────────── */
[data-skill-market] .sm-versions { display: flex; flex-direction: column; gap: 0; }
[data-skill-market] .sm-version-row {
  display: flex; gap: 11px; align-items: flex-start;
  padding: 11px 0; border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-version-row:last-child { border-bottom: 0; }
[data-skill-market] .sm-version-tag {
  flex: 0 0 auto; min-width: 58px; font-size: 12px; font-weight: 650;
  color: var(--sm-accent); background: var(--sm-accent-soft);
  border-radius: 6px; padding: 3px 7px; text-align: center;
}
[data-skill-market] .sm-version-main { flex: 1; min-width: 0; }
[data-skill-market] .sm-version-actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
[data-skill-market] .sm-version-log { font-size: 13px; line-height: 1.5; }
[data-skill-market] .sm-version-date { font-size: 11px; color: var(--sm-muted); margin-top: 3px; }
[data-skill-market] .sm-versions-toggle { margin-top: 11px; }

[data-skill-market] .sm-perm { display: flex; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--sm-border); }
[data-skill-market] .sm-perm:last-child { border-bottom: 0; }
[data-skill-market] .sm-perm .sm-perm-ic {
  width: 34px; height: 34px; flex: 0 0 auto; border-radius: 9px;
  border: 1px solid var(--sm-border); display: grid; place-items: center; color: var(--sm-fg);
}
[data-skill-market] .sm-perm .sm-perm-ic svg { width: 17px; height: 17px; }
[data-skill-market] .sm-perm .sm-perm-main { flex: 1; min-width: 0; }
[data-skill-market] .sm-perm .sm-perm-title { display: flex; align-items: center; gap: 8px; }
[data-skill-market] .sm-perm .sm-perm-title strong { font-size: 13.5px; font-weight: 600; }
[data-skill-market] .sm-perm .sm-perm-desc { font-size: 12.5px; color: var(--sm-muted); margin-top: 3px; }
[data-skill-market] .sm-risk {
  font-family: var(--sm-font-mono); font-size: 10px; letter-spacing: .04em;
  padding: 2px 7px; border-radius: 999px;
}
[data-skill-market] .sm-risk.low { color: var(--sm-muted); background: var(--sm-fg-soft); }
[data-skill-market] .sm-risk.mid { color: var(--sm-warn); background: var(--sm-warn-soft); }
[data-skill-market] .sm-risk.high { color: var(--sm-danger); background: var(--sm-danger-soft); }

/* The counter strip in the drawer's header, between the skill's meta line and the tab strip. It was
   the drawer's footer, then briefly the first item inside 概览 — where it scrolled away with the tab.
   Here it is fixed: the counters are true whichever tab is open. */
[data-skill-market] .sm-stat-strip {
  display: flex; gap: 18px; flex-wrap: wrap; padding: 14px 20px;
  font-family: var(--sm-font-mono); font-size: 11.5px; color: var(--sm-muted);
  border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-stat-strip .sm-f { display: flex; flex-direction: column; gap: 2px; }
[data-skill-market] .sm-stat-strip .sm-f strong { font-size: 13px; color: var(--sm-fg); font-weight: 600; }

/* ── toast ─────────────────────────────────────────────────────────── */
[data-skill-market] .sm-toast-wrap {
  position: absolute; bottom: 38px; left: 50%; transform: translateX(-50%);
  z-index: 60; display: flex; flex-direction: column; gap: 8px; align-items: center;
  pointer-events: none;
}
[data-skill-market] .sm-toast {
  display: flex; align-items: center; gap: 12px;
  background: var(--sm-fg); color: var(--sm-surface);
  border-radius: var(--sm-radius); padding: 10px 12px 10px 15px;
  box-shadow: var(--sm-shadow-md); font-size: 13px; max-width: min(560px, 88%);
  animation: sm-toast-in .2s ease; pointer-events: auto;
}
[data-skill-market] .sm-toast .sm-toast-undo { color: color-mix(in oklch, var(--sm-surface) 78%, transparent); font-weight: 600; }
[data-skill-market] .sm-toast .sm-toast-undo:hover { color: var(--sm-surface); text-decoration: underline; }
@keyframes sm-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ── responsive ────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  [data-skill-market] .sm-stat-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 920px) {
  [data-skill-market] .sm-stat-cards { grid-template-columns: minmax(0, 1fr); }
  /* The card grid keeps its fluid track; a 240px floor already lands on one
     column at this width, so no override is needed here. */
  [data-skill-market] .sm-inner { padding: 16px 16px 60px; }
  [data-skill-market] .sm-fixed { padding: 14px 16px 0; }
  [data-skill-market] .sm-topbar { padding: 0 14px; gap: 10px; }
  [data-skill-market] .sm-topbar-actions .sm-btn-label { display: none; }
  [data-skill-market] .sm-page-sub { display: none; }
  [data-skill-market] .sm-list-row { grid-template-columns: 34px minmax(0, 1fr); }
  [data-skill-market] .sm-list-row .sm-row-actions { grid-column: 1 / -1; justify-content: flex-end; }
  [data-skill-market] .sm-page-title { font-size: 22px; }
  [data-skill-market] .sm-inspector { width: 100%; max-width: 100%; border-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [data-skill-market] *, [data-skill-market] *::before, [data-skill-market] *::after {
    transition-duration: .001ms !important; animation-duration: .001ms !important;
  }
}
`

    /* ── icons ─────────────────────────────────────────────────────────── */
    const PATHS = {
      'i-grid': 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
      // A bolt, for "skill" as capacity rather than as a document: the sidebar entry needs one mark that
      // reads at 18px, and the shapes already in use here (shield = security, sparkle = summary) are
      // taken. Kept as one closed outline so it strokes like the rest of the table.
      'i-skill': 'M13.6 3 6.4 13.6h4.6l-1 7.4 7.2-10.6h-4.6z',
      'i-search': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.6-3.6',
      'i-upload': 'M12 15.5V4m0 0-3.6 3.6M12 4l3.6 3.6M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15',
      'i-bookmark': 'M6.5 4h11v15.5l-5.5-3.6-5.5 3.6z',
      'i-bookmark-check': 'M6.5 4h11v15.5l-5.5-3.6-5.5 3.6zM9.5 9.5l1.8 1.8 3.3-3.7',
      'i-bell': 'M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.5 1.8 5.5 1.8 5.5H4.7s1.8-1 1.8-5.5zM10 18.5a2 2 0 0 0 4 0',
      'i-download': 'M12 4v10.5m0 0-3.6-3.6M12 14.5l3.6-3.6M5 19h14',
      'i-x': 'M6.5 6.5l11 11M17.5 6.5l-11 11',
      'i-check': 'M5 12.5l4.5 4.5L19 7',
      'i-chevron-right': 'M9.5 6l6 6-6 6',
      'i-chevron-left': 'M14.5 6l-6 6 6 6',
      'i-chevron-down': 'M6 9.5l6 6 6-6',
      'i-refresh': 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5V9H15',
      'i-trash': 'M5 7h14M9.5 7V5h5v2M7 7l.9 12a1 1 0 0 0 1 1h6.2a1 1 0 0 0 1-1L17 7',
      'i-arrow-up-circle': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 16V8.5M12 8.5 8.7 11.8M12 8.5l3.3 3.3',
      'i-globe': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.4 2.6 2.4 14 0 17M12 3.5c-2.4 2.6-2.4 14 0 17',
      'i-folder': 'M3.5 6.5a2 2 0 0 1 2-2h3.4l2 2.3h7.6a2 2 0 0 1 2 2v8.7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
      'i-file': 'M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM13.5 3v5.5H19M8.5 13h7M8.5 16.5h4.5',
      'i-terminal': 'M3.5 4.5h17v15h-17zM7.5 9.5l3 2.5-3 2.5M13 14.5h3.5',
      'i-table': 'M3.5 4.5h17v15h-17zM3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15',
      'i-type': 'M5 7V5.5h14V7M12 5.5v13M9.5 18.5h5',
      'i-clipboard': 'M6 4.5h12v16H6zM9 4.5V3.5h6v1M9.5 10.5h5M9.5 14h3.5',
      'i-image': 'M3.5 4.5h17v15h-17zM8.5 9.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M4.5 17l4.5-4.5 3.5 3.5 3-3 4.5 4.5',
      'i-sparkle': 'M12 4l1.7 4.6L18.3 10l-4.6 1.7L12 16.3l-1.7-4.6L5.7 10l4.6-1.4zM18.5 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z',
      'i-book': 'M4.5 5.5a2 2 0 0 1 2-2h12v15h-12a2 2 0 0 0-2 2zM4.5 18.5a2 2 0 0 1 2-2h12',
      'i-network': 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18.5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 7v4.5m0 0-5.5 6m5.5-6 5.5 6',
      // A document under a magnifier: reading information about something. This is the glyph for
      // 读取技能元数据; the globe beside it means the skill's own network access.
      'i-metadata': 'M13.6 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M13.6 3l5.4 5.4M13.6 3v5.4H19M16.4 13.2a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8M18.9 19.7l2.6 2.6',
      // A shield with a tick, for the scan verdict. Distinct from `i-shield` (the author-verification
      // mark), which is why this one carries the tick inside it.
      'i-shield-check': 'M12 3 5.5 5.8v5.4c0 4.3 2.8 7.2 6.5 8.6 3.7-1.4 6.5-4.3 6.5-8.6V5.8zM9.1 12.1l2 2 3.8-4.4',
      'i-shield': 'M12 3 5.5 5.8v5.4c0 4.3 2.8 7.2 6.5 8.6 3.7-1.4 6.5-4.3 6.5-8.6V5.8zM9.2 12l2.1 2.1 3.6-4.2',
      'i-lock': 'M5 10h14v9.5H5zM8 10V7.5a4 4 0 0 1 8 0V10',
      'i-mail': 'M3.5 5h17v14h-17zM4 7.5l8 5.2 8-5.2',
      'i-database': 'M12 3.2c4.14 0 7.5 1.25 7.5 2.8S16.14 8.8 12 8.8 4.5 7.55 4.5 6 7.86 3.2 12 3.2zM4.5 6v12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8V6M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8',
      'i-menu': 'M4 7h16M4 12h16M4 17h16',
      'i-link': 'M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.2 1.2M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.2-1.2',
      'i-help': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.7.35-1.1.85-1.1 1.5v.3M12 16.6a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4z',
    }

    /**
     * Render one stroke icon from the local glyph table.
     * @param {object} props - `name`, `size`, `className`.
     * @returns {object} SVG element.
     */
    function Icon({ name, size, className }) {
      const d = PATHS[name] ?? PATHS['i-file']
      return h('svg', {
        className,
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, h('path', { d }))
    }

    /** The filled verified seal, drawn as a solid mark rather than a stroke. */
    function Verified({ className }) {
      return h('svg', {
        className,
        viewBox: '0 0 24 24',
        width: 14,
        height: 14,
        'aria-hidden': true,
      },
        h('path', {
          fill: 'currentColor',
          d: 'M12 2.6l2.3 1.7 2.8-.2 1 2.6 2.4 1.5-.9 2.7.6 2.8-2.5 1.2-1.5 2.4-2.8-.3L12 21.4l-2.4-1.9-2.8.3-1.5-2.4-2.5-1.2.6-2.8-.9-2.7 2.4-1.5 1-2.6 2.8.2z',
        }),
        h('path', {
          fill: 'none', stroke: 'var(--sm-surface)', strokeWidth: 1.9,
          strokeLinecap: 'round', strokeLinejoin: 'round', d: 'm8.7 12.2 2.2 2.2 4.4-4.6',
        }),
      )
    }

    /** The five-point star used by the compact rating readout. */
    function Star({ size = 13 }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', 'aria-hidden': true,
      }, h('path', {
        d: 'M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.85z',
      }))
    }

    /* ── formatting helpers ────────────────────────────────────────────── */

    /**
     * Compact download/star count in the prototype's `128k` style.
     * @param {number} value - Raw count.
     * @returns {string} Compact label.
     */
    function compact(value) {
      const n = Number(value) || 0
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
      if (n >= 100000) return Math.round(n / 1000) + 'k'
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
      return String(n)
    }

    /**
     * The prototype shows a 5-point rating; SkillHub publishes a 0–100000
     * score. The readout is a deterministic, monotonic projection of that
     * score, not a user-rating average, and the inspector says so.
     * @param {number} score - Upstream score.
     * @returns {string} One-decimal rating-like value.
     */
    function scoreToRating(score) {
      const n = Number(score) || 0
      return (4 + Math.min(1, Math.max(0, n) / 100000)).toFixed(1)
    }

    /**
     * Format upstream's score for display.
     *
     * The raw value is a large float — `75093.51584799575` was measured on a real skill — and printing
     * it in full filled the strip with digits nobody can read and implied a precision the number does
     * not have. Rounded to an integer with grouped thousands, which keeps every digit that carries
     * meaning and drops the ones that do not.
     *
     * @param {unknown} score - Upstream score.
     * @returns {string} e.g. `75,094`.
     */
    function formatScore(score) {
      const n = Number(score)
      if (Number.isFinite(n) === false) return '—'
      return Math.round(n).toLocaleString('en-US')
    }

    /**
     * Relative time in the prototype's `3 天前` style.
     *
     * Returns `''` for a timestamp that cannot be a real one, rather than a number. Treating `0`
     * as "the epoch" is how a missing value became "57 年前": absent is not the same as very old,
     * and the caller must be able to tell them apart so it can hide the label instead.
     *
     * @param {number} timestamp - Epoch milliseconds, or 0/undefined when unknown.
     * @returns {string} Relative label, or '' when the time is unknown.
     */
    function relativeTime(timestamp) {
      const value = Number(timestamp)
      // Anything before the harness existed is a placeholder, not a date.
      if (Number.isFinite(value) === false || value < 946684800000) return ''
      const ms = Date.now() - value
      if (ms <= 0) return t('time.justNow')
      const minute = 60000, hour = 60 * minute, day = 24 * hour
      if (ms < hour) return t('time.minutes', { count: Math.max(1, Math.round(ms / minute)) })
      if (ms < day) return t('time.hours', { count: Math.round(ms / hour) })
      if (ms < 30 * day) return t('time.days', { count: Math.round(ms / day) })
      if (ms < 365 * day) return t('time.months', { count: Math.round(ms / (30 * day)) })
      return t('time.years', { count: Math.round(ms / (365 * day)) })
    }

    /**
     * The publisher label: the claim handle when the namespace carries one,
     * otherwise the account handle.
     * @param {object} skill - Normalised skill.
     * @returns {string} Publisher label.
     */
    function publisherOf(skill) {
      return skill.publisher || skill.handle || t('misc.community')
    }

    /* ── upstream access ───────────────────────────────────────────────── */

    /**
     * An error carrying the code the Host sent, so callers can branch on the reason.
     * @param {string} message - What the reader is told.
     * @param {string} code - Machine-readable reason.
     * @returns {Error} The error.
     */
    function fail(message, code) {
      const error = new Error(message)
      error.code = code
      return error
    }

    /**
     * Call the Host, turning a dead connection into the sentence a refused upstream gets.
     *
     * Two different failures arrive here. The Host can answer with its own reason — including
     * `offline` or `timeout`, because *it* could not reach the market — or the Host itself can fail to
     * answer: a restarting harness, a page whose connection dropped, a browser that is offline. The
     * second arrives as a bare `TypeError` carrying an English message, which is not something to show
     * a reader. A request cancelled on purpose passes through untouched, because the callers key their
     * "ignore this one" branch on `AbortError` and must keep seeing it.
     *
     * @param {string} path - Proxy path.
     * @param {object} [init] - Request init.
     * @returns {Promise<Response>} The Host's response.
     * @throws {Error} With code `offline` when the Host could not be reached at all.
     */
    async function hostFetch(path, init) {
      try {
        return await fetch(path, init)
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        throw fail(t('err.offline'), 'offline')
      }
    }

    /**
     * The reason for a failed proxy call, in the reader's language.
     *
     * The Host answers 502 when it could not read the market at all, and its own text for that is a Node
     * message under a Chinese prefix — `技能市场上游请求失败：fetch failed` — which gives the reader
     * nothing to act on. That status gets a sentence of its own instead. Every other status keeps what
     * the Host said: a 400 is the panel's own mistake, and a status the market itself returned carries
     * the market's own reason.
     *
     * @param {any} body - Parsed response body.
     * @param {number} status - HTTP status.
     * @returns {Error} Error carrying `code`.
     */
    function hostFailure(body, status) {
      if (status === 502 || status === 504) return fail(t('err.offline'), 'offline')
      return fail(body?.error ?? t('err.requestFailed', { status }), 'upstream')
    }

    /**
     * Call this plugin's Host proxy with GET.
     * @param {string} path - Proxy path such as `skills` or `categories`.
     * @param {Record<string, string|number|undefined>} [query] - Query values; blanks are dropped.
     * @param {AbortSignal} [signal] - Cancellation.
     * @returns {Promise<any>} Parsed JSON body.
     * @throws {Error} With the upstream reason when the proxy reports one.
     */
    async function api(path, query, signal) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
      }
      const suffix = params.toString()
      const response = await hostFetch(`${apiPath(path)}${suffix ? `?${suffix}` : ''}`, { signal })
      let body
      try {
        body = await response.json()
      } catch {
        throw fail(t('err.notJson', { status: response.status }), 'notJson')
      }
      if (!response.ok) throw hostFailure(body, response.status)
      return body
    }

    /**
     * Call this plugin's Host with a JSON body. Used for the write side —
     * installing and removing a skill on disk — which must happen in Node, not
     * in a page.
     * @param {string} path - Proxy path such as `install`.
     * @param {object} payload - JSON-serialisable request body.
     * @returns {Promise<any>} Parsed JSON body.
     * @throws {Error} With the Host's own reason when the operation fails.
     */
    async function apiPost(path, payload) {
      const response = await hostFetch(apiPath(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      let body
      try {
        body = await response.json()
      } catch {
        throw fail(t('err.notJson', { status: response.status }), 'notJson')
      }
      if (!response.ok) throw hostFailure(body, response.status)
      return body
    }

    /**
     * Upload one file's bytes to this plugin's Host.
     *
     * The body is the file itself rather than JSON, because an archive is binary: base64 inside
     * JSON would inflate it by a third and need the whole thing held as a string first. The
     * original filename travels in the query, where the Host uses it only to report errors.
     *
     * @param {string} path - Proxy path such as `import`.
     * @param {string} fileName - Original filename.
     * @param {Blob} bytes - File contents.
     * @returns {Promise<any>} Parsed JSON body.
     * @throws {Error} With the Host's own reason when the import fails.
     */
    async function apiUpload(path, fileName, bytes) {
      const response = await hostFetch(`${apiPath(path)}?name=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: bytes,
      })
      let body
      try {
        body = await response.json()
      } catch {
        throw fail(t('err.notJson', { status: response.status }), 'notJson')
      }
      if (!response.ok) throw hostFailure(body, response.status)
      return body
    }

    /**
     * Normalise one upstream record into the shape the UI renders. Every field
     * is either upstream data or an explicit fallback, never a fabrication.
     * @param {object} raw - One `data.skills[]` entry.
     * @param {Array<{key: string, name: string}>} categories - Current category list.
     * @returns {object} Normalised skill.
     */
    function normalizeSkill(raw, categories) {
      const namespace = raw?.namespace ?? {}
      const slug = String(raw?.slug ?? '')
      const handle = String(namespace.handle ?? raw?.ownerName ?? '')
      const canonical = String(namespace.canonicalName ?? (handle && slug ? `@${handle}/${slug}` : slug))
      const categoryKey = String(raw?.category ?? '')
      const categoryName = translatedCategory(categoryKey, categories.find((c) => c.key === categoryKey)?.name ?? categoryKey ?? t('overview.unknownCategory'))
      const tags = Array.isArray(raw?.subCategories)
        ? raw.subCategories.map((entry) => String(entry?.name ?? '')).filter(Boolean).slice(0, 3)
        : []
      return {
        id: canonical || slug || String(raw?.name ?? ''),
        slug,
        canonical,
        name: String(raw?.name ?? slug ?? t('overview.unknownSkill')),
        publisher: String(namespace.displayName ?? '') || handle,
        handle,
        official: raw?.verified === true || raw?.source === 'official' || raw?.source === 'deepseek',
        description: String(raw?.description_zh || raw?.description || '').replace(/\s+/g, ' ').trim(),
        version: String(raw?.version ?? ''),
        installs: Number(raw?.downloads ?? 0),
        stars: Number(raw?.stars ?? 0),
        score: Number(raw?.score ?? 0),
        rating: scoreToRating(raw?.score),
        updatedAt: Number(raw?.updated_at ?? raw?.created_at ?? 0),
        updated: relativeTime(raw?.updated_at ?? raw?.created_at),
        createdAt: Number(raw?.created_at ?? 0),
        iconUrl: typeof raw?.iconUrl === 'string' ? raw.iconUrl : '',
        homepage: publicSkillUrl(raw?.homepage, handle, slug),
        category: categoryKey,
        categoryName,
        source: String(raw?.source ?? 'community'),
        tags: tags.length > 0 ? tags : [categoryName],
        requiresApiKey: String(raw?.labels?.requires_api_key ?? '') === 'true',
        serviceized: raw?.isServiceized === true,
      }
    }

    /**
     * Load one page of skills.
     * @param {{page?: number, pageSize?: number, sortBy?: string, keyword?: string, category?: string, signal?: AbortSignal}} options - Query options.
     * @param {Array<{key: string, name: string}>} categories - Category list for labels.
     * @returns {Promise<{skills: object[], total: number}>} Normalised page.
     */
    async function loadSkills(options, categories) {
      const { signal, ...query } = options
      const body = await api('/skills', query, signal)
      const list = Array.isArray(body?.data?.skills) ? body.data.skills : []
      return {
        skills: list.map((raw) => normalizeSkill(raw, categories)).filter((skill) => skill.id !== ''),
        total: Number(body?.data?.total ?? list.length),
      }
    }

    /* ── persisted client state ────────────────────────────────────────── */

    /**
     * Empty state seed.
     *
     * `view` is deliberately not persisted: the panel always opens on 发现, so that entering
     * from the sidebar lands somewhere predictable rather than wherever the last visit ended.
     *
     * `sortBy` is not persisted either, for the same reason. Entering 发现 should present the catalogue
     * in one predictable order — the most-downloaded first, which is what "the marketplace" means to
     * most people — and a remembered choice from a previous visit made the first screen depend on
     * something the user could not see. Within a session the select works normally; only the value
     * across sessions is dropped. A filter that describes a *preference* (category) is still remembered.
     */
    function emptyState() {
      return {
        view: 'market',
        category: 'all',
        sortBy: DEFAULT_SORT,
        detailTab: 'overview',
        installed: [],
        saved: [],
        /**
         * Full records for saved skills, keyed by id.
         *
         * The favorite list is a set of ids plus these records. Ids alone are not
         * enough: resolving a favorite needs the skill's own fields (name, publisher,
         * downloads, rating), the in-memory catalog is empty on a fresh page load, and
         * a record for a skill is not otherwise retrievable — the upstream list
         * endpoint has no id filter. Without this the 收藏 list renders empty until
         * something happens to populate the catalog again.
         */
        savedSkills: {},
        enabled: {},
      }
    }

    /**
     * The empty document, in the shape the Host stores.
     *
     * Separate from {@link emptyState} because the two differ on purpose: the render state also
     * carries `view`, `sortBy` and `detailTab`, which are never written anywhere. Keeping one
     * object for both would make it easy to persist something by accident.
     *
     * @returns {object} Persisted shape.
     */
    function emptyPersisted() {
      return {
        category: 'all',
        installed: [],
        saved: [],
        savedSkills: {},
        enabled: {},
        /**
         * Directories changed since the Host process started, and the start time they were
         * recorded against. The time is what retires the advice: a set recorded before the
         * running Host started is asking for a restart that has already happened.
         */
        pending: { since: 0, dirs: [] },
      }
    }

    /**
     * The document this page is working from: the one place the panel's durable state lives.
     *
     * It used to be `window.localStorage` — read once at mount, written on every change — but
     * that store belongs to the desktop shell, not to this plugin: one LevelDB per user data
     * directory, shared with DSH's own keys and with every other plugin, addressed by origin
     * rather than by plugin. The document now lives in the file the Host owns
     * (`$DSH_HOME/storages/@montersy123/dsh-skill-market/data/panel.json`), and this object is the page's
     * copy of it.
     *
     * ## Why a copy with a deferred write, rather than awaiting the Host
     *
     * `readState()` is called *during* the first render, and a render cannot await a request.
     * So reads are synchronous against this object, and writes update it and POST the whole
     * document immediately — no timer, because a deferred write is a change that closing the page
     * can lose. A failed POST leaves the in-memory copy authoritative for this page's lifetime,
     * which is the degradation the old `try { … } catch { /* storage unavailable *\/ }` had, except
     * that the panel now keeps working against a Host that is merely slow.
     *
     * ## Ordering
     *
     * `hydratePanelState()` runs once, when the client plugin activates, and **no write is
     * allowed before it finishes**: writing first would replace the stored document with the
     * empty defaults this page starts from, which is a data-loss bug rather than a race to
     * tolerate. The panel adopts the hydrated document through `panelListeners`, and the mount
     * reconciliation waits on the same promise, so the Host's answer cannot be overwritten by
     * the ledger it was fetched to correct.
     */
    let panelDocument = emptyPersisted()
    /** Whether the Host's copy has been read yet. Every write is refused until it has. */
    let panelHydrated = false
    /**
     * Whether persistence is off because the Host could not be read.
     *
     * Set when `GET /state` fails (not when it answers "nothing stored"): writing then would replace the stored
     * document with this page's defaults, which is how favorites were once lost. The panel keeps working against
     * its in-memory copy and stops writing until a later read succeeds.
     */
    let panelPersistenceBlocked = false
    /** The one hydration promise, shared by every caller that needs to wait for it. */
    let panelHydration = null
    /** Revision of the document this page last read or wrote, used to notice another window. */
    let panelRevision = 0
    /** Epoch ms the running Host started; the pending set is scoped to it. */
    let panelHostStartedAt = 0
    /** The exact text last handed to the Host, so an unchanged document is never re-sent. */
    let panelFlushed = ''
    /**
     * Whether this page holds changes the Host may not have yet.
     *
     * Read by the periodic sync, which must not adopt another window's copy over them.
     */
    let panelDirty = false
    /** Whether a POST is in flight, so two flushes cannot overlap. */
    let panelFlushing = false
    /**
     * Whether the old Web Storage keys are still holding data that this page adopted.
     *
     * They are deleted only once the document that replaced them has actually been stored — never
     * before. Deleting first is how a migration becomes data loss: a Host half without the `state`
     * route (an older build, a half-finished update) answers 404, the write fails, the keys are
     * already gone, and the favorites have nowhere left to live. That is not hypothetical; it
     * happened, and the values had to be recovered out of LevelDB's write-ahead log.
     */
    let panelLegacyClearPending = false
    /** Panel instances, notified when the document changes underneath them. */
    const panelListeners = new Set()

    /**
     * Reduce an untrusted document to the shape this panel reads.
     *
     * The file is on the user's disk, so a hand edit, an interrupted write or a future version's
     * extra fields must all be survivable: every field is checked and replaced by its default
     * rather than trusted. A field of the wrong type is dropped, never coerced — a string where a
     * list belongs would otherwise render as one favorite per character.
     *
     * A favorite's record is kept only while the favorite list still names its id. The two are one
     * thing — the id list is what renders, the record is what makes it renderable — and an earlier
     * build could drop an id without dropping its record, which then sat in the store forever: not
     * shown, not referred to, and only visible to whoever opened the file. Dropping it here means
     * every load and every write heals that, instead of carrying it forward again.
     *
     * @param {unknown} raw - Parsed file contents, or anything else.
     * @returns {object} Persisted shape.
     */
    function sanitizePersisted(raw) {
      const base = emptyPersisted()
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base
      const strings = (value) => (Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string' && entry !== '')
        : [])
      const records = (value) => (value !== null && typeof value === 'object' && Array.isArray(value) === false
        ? value
        : {})
      const pending = records(raw.pending)
      const saved = strings(raw.saved)
      const named = new Set(saved)
      const savedSkills = {}
      for (const [id, record] of Object.entries(records(raw.savedSkills))) {
        if (named.has(id)) savedSkills[id] = record
      }
      return {
        category: typeof raw.category === 'string' && raw.category !== '' ? raw.category : base.category,
        installed: Array.isArray(raw.installed) ? raw.installed : base.installed,
        saved,
        savedSkills,
        enabled: records(raw.enabled),
        pending: {
          since: Number.isFinite(Number(pending.since)) ? Number(pending.since) : 0,
          dirs: strings(pending.dirs),
        },
      }
    }

    /**
     * Whether sanitising a stored document dropped any favorite records.
     *
     * Used to decide that the file is worth rewriting as soon as it is read: left alone, a document
     * carrying records its favorite list no longer names would keep them until something else
     * happened to change — which, for a user who is done curating their favorites, is never.
     *
     * @param {unknown} raw - The document as it was stored.
     * @param {object} document - The same document after {@link sanitizePersisted}.
     * @returns {boolean} Whether records were dropped.
     */
    function droppedOrphanRecords(raw, document) {
      const rawRecords = raw !== null && typeof raw === 'object' && Array.isArray(raw) === false
        && raw.savedSkills !== null && typeof raw.savedSkills === 'object'
        ? Object.keys(raw.savedSkills).length
        : 0
      return rawRecords > Object.keys(document.savedSkills).length
    }

    /**
     * Add every favorite the other document holds and this one does not.
     *
     * Only used while the old Web Storage keys still exist, which is the transition window: the file
     * is authoritative for the ledger and the category, but a favorite is a thing the user made and
     * nothing else can reconstruct it.
     *
     * @param {object} base - The document to add to; mutated.
     * @param {object} other - The document being merged in.
     * @returns {boolean} Whether anything was added.
     */
    function mergeFavorites(base, other) {
      let added = false
      const known = new Set(base.saved)
      for (const id of other.saved) {
        if (known.has(id)) continue
        base.saved.push(id)
        known.add(id)
        added = true
      }
      for (const [id, record] of Object.entries(other.savedSkills)) {
        if (base.savedSkills[id] !== undefined) continue
        base.savedSkills[id] = record
        added = true
      }
      return added
    }

    /**
     * Notify every mounted panel that the document changed.
     * @returns {void}
     */
    function notifyPanels() {
      for (const listener of [...panelListeners]) {
        try {
          listener()
        } catch {
          /* one panel's failure must not stop the others, or the flush that notified them */
        }
      }
    }

    /**
     * Read the Web Storage keys an earlier build wrote.
     *
     * Guarded on both sides — the property access and the read — because `localStorage` is
     * exactly the kind of thing that throws when it is unavailable (an opaque origin, a blocked
     * third-party context, a user who disabled site data), and an adoption that cannot happen
     * must not stop the panel from mounting.
     *
     * @returns {{state: object | null, pending: string[] | null}} Whatever could be read.
     */
    function readLegacyStorage() {
      const nothing = { state: null, pending: null }
      try {
        const storage = window.localStorage
        if (storage === null || storage === undefined) return nothing
        let state = null
        try {
          const raw = storage.getItem(LEGACY_STATE_KEY)
          if (raw !== null) state = JSON.parse(raw)
        } catch {
          state = null
        }
        let pending = null
        try {
          const raw = storage.getItem(LEGACY_PENDING_KEY)
          const parsed = raw === null ? null : JSON.parse(raw)
          pending = Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : null
        } catch {
          pending = null
        }
        return { state, pending }
      } catch {
        return nothing
      }
    }

    /**
     * Delete the Web Storage keys an earlier build wrote.
     *
     * Called once the contents have been adopted **and stored**, so the desktop shell's store stops
     * holding this plugin's data at all — which is the point of the move, not a tidy-up.
     *
     * @returns {void}
     */
    function clearLegacyStorage() {
      try {
        window.localStorage.removeItem(LEGACY_STATE_KEY)
        window.localStorage.removeItem(LEGACY_PENDING_KEY)
      } catch {
        /* unreachable storage has nothing to clear */
      }
    }

    /**
     * Put the document back into the Web Storage keys, as a rescue copy.
     *
     * Reached only when the Host cannot store the document it was just sent — an older Host half
     * without the `state` route, or a request that failed. Losing a favorite because the new home
     * for it is unavailable is worse than writing the old home one more time, and the copy is
     * deleted the moment the file store works. The shape is the one the previous build read, so
     * the data also survives a downgrade.
     *
     * @param {object} document - The document to preserve.
     * @returns {void}
     */
    function writeLegacyStorage(document) {
      try {
        window.localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify({
          category: document.category,
          installed: document.installed,
          saved: document.saved,
          savedSkills: document.savedSkills,
          enabled: document.enabled,
        }))
        window.localStorage.setItem(LEGACY_PENDING_KEY, JSON.stringify(document.pending.dirs))
      } catch {
        /* storage unavailable too: the page still holds the document in memory */
      }
    }

    /**
     * Send the document to the Host, looping until the stored copy matches this one.
     *
     * @returns {Promise<void>} Resolves when the attempt is over. A failure is not thrown: the
     *   page keeps its own copy and the next change, or the next focus, tries again.
     */
    async function flushPanelState() {
      if (panelHydrated === false) return
      // The stored document could not be read: writing now would replace it with this page's defaults.
      if (panelPersistenceBlocked === true) return
      if (panelFlushing === true) {
        // A write is already on its way and will pick this change up on its next turn.
        panelDirty = true
        return
      }
      panelFlushing = true
      try {
        for (;;) {
          const body = JSON.stringify(panelDocument)
          if (body === panelFlushed) {
            panelDirty = false
            break
          }
          try {
            const answer = await apiPost(STATE_PATH, panelDocument)
            const revision = Number(answer?.revision ?? 0)
            if (Number.isFinite(revision) && revision > 0) panelRevision = revision
            const startedAt = Number(answer?.harnessStartedAt ?? 0)
            if (Number.isFinite(startedAt) && startedAt > 0) panelHostStartedAt = startedAt
          } catch {
            // The Host could not store it. Keep a copy where the older build kept it, so an
            // unavailable file store costs nothing; the copy goes away with the next successful
            // write, which is also the only moment the old keys are deleted.
            writeLegacyStorage(panelDocument)
            break
          }
          // `panelDocument` is re-serialised rather than assumed unchanged: a change that landed
          // while the request was in flight has to be sent too, and must not be recorded as
          // already stored.
          if (JSON.stringify(panelDocument) === body) {
            panelFlushed = body
            panelDirty = false
            if (panelLegacyClearPending === true) {
              clearLegacyStorage()
              panelLegacyClearPending = false
            }
          }
        }
      } finally {
        panelFlushing = false
      }
    }

    /**
     * Write the document, now.
     *
     * Called directly rather than deferred to a timer. Deferring was tried — the idea being that a
     * single user action writes more than one slice (a toggle records the pending directory *and*
     * the enabled map; a save records the id list *and* the record) so one timer could coalesce
     * them into one request. Two reasons it is not worth it:
     *
     *  - **The coalescing already happens.** A second call while a write is in flight marks the
     *    document dirty and returns; the write in flight re-serialises when it lands and sends the
     *    newer document itself, so the requests a burst produces are bounded either way.
     *  - **A timer is a window in which the change is not durable.** The check that first exercised
     *    this path lost the pending set exactly there: the panel wrote it to memory, the timer had
     *    not fired, and the page went away. `localStorage` wrote synchronously; a move to a file is
     *    no reason to start dropping the last change.
     *
     * @returns {void}
     */
    function requestPanelFlush() {
      if (panelHydrated === false) return
      // Nothing is written while the stored document is unreadable: marking it dirty would also stop the sync
      // that is the only thing able to lift that block.
      if (panelPersistenceBlocked === true) return
      panelDirty = true
      void flushPanelState()
    }

    /**
     * Read the stored document once, adopting anything an earlier build left in Web Storage.
     *
     * Never rejects: an older Host half without the `state` route, or a Host that is not
     * reachable at all, must still leave a working panel — it just cannot remember anything
     * beyond this page.
     *
     * @returns {Promise<void>} Resolves once the document is in memory.
     */
    async function hydratePanelState() {
      let remote = null
      /** Whether the Host answered at all. A failed read is not the same as "nothing stored". */
      let answered = false
      try {
        const answer = await api(STATE_PATH)
        answered = true
        remote = answer?.state ?? null
        const revision = Number(answer?.revision ?? 0)
        if (Number.isFinite(revision) && revision > 0) panelRevision = revision
        const startedAt = Number(answer?.harnessStartedAt ?? 0)
        if (Number.isFinite(startedAt) && startedAt > 0) panelHostStartedAt = startedAt
      } catch {
        /* an older Host, or none: the panel still works, without persistence */
      }
      // A read that failed must not be treated as an empty document. That mistake let a momentary failure
      // (Windows holding the file while a rename retries) replace every favorite with the defaults this page
      // started from. Persistence stays off until a read succeeds, so the panel keeps working and stops writing.
      if (answered === false) {
        panelPersistenceBlocked = true
        panelHydrated = true
        return
      }
      panelPersistenceBlocked = false
      /** Whether what is now in memory differs from what the Host holds. */
      let changed = false
      const legacy = readLegacyStorage()
      if (remote === null && legacy.state !== null) {
        // Nothing stored yet, so the old keys are the only copy there is: adopt them, or the
        // move would silently discard every favorite and ledger row the user already had. A
        // stored document wins over them, because it is the newer authority.
        panelDocument = sanitizePersisted(legacy.state)
        changed = true
      } else {
        panelDocument = sanitizePersisted(remote)
        // Both copies can be present during the move: a page still running the previous client keeps
        // writing its own keys until it is closed. The file is the newer authority for everything the
        // Host derives — the ledger, the enabled map, the category — but favorites are additive user
        // data, so they are unioned instead of one side winning. Dropping a favorite the user just
        // added in the other window is the worse of the two mistakes; the only thing a union can do
        // wrong is resurrect one they removed moments ago.
        if (legacy.state !== null) {
          const added = mergeFavorites(panelDocument, sanitizePersisted(legacy.state))
          if (added === true) changed = true
        }
        // Records the favorite list no longer names are dropped on the way in, and the file is
        // rewritten for it rather than keeping them until some later change.
        if (droppedOrphanRecords(remote, panelDocument) === true) changed = true
      }
      if (panelDocument.pending.dirs.length === 0 && legacy.pending !== null && legacy.pending.length > 0) {
        panelDocument.pending = { since: panelHostStartedAt, dirs: legacy.pending }
        changed = true
      }
      // Deleted only after the document that replaces them has been stored — see the flag's own
      // note. Adopting without storing, then deleting, is the failure this ordering exists for.
      if (legacy.state !== null || legacy.pending !== null) panelLegacyClearPending = true
      // A pending set recorded before this Host started is asking for a restart that has already
      // happened, so it is spent. Guarded on a known start time: without one the comparison
      // would retire a set that is merely being read on a page that cannot reach the Host.
      if (panelHostStartedAt > 0
        && (panelDocument.pending.since !== panelHostStartedAt || panelDocument.pending.dirs.length === 0)) {
        if (panelDocument.pending.since !== 0 || panelDocument.pending.dirs.length > 0) changed = true
        panelDocument.pending = { since: 0, dirs: [] }
      }
      panelHydrated = true
      if (changed === true) {
        // Adoption has to reach the file to be worth anything — and only then are the old keys
        // deleted, so a write that never lands leaves the data where it was.
        await flushPanelState()
      } else {
        panelFlushed = JSON.stringify(panelDocument)
        if (panelLegacyClearPending === true) {
          clearLegacyStorage()
          panelLegacyClearPending = false
        }
      }
      notifyPanels()
    }

    /**
     * Hydrate once, and hand the same promise to everyone who needs to wait for it.
     * @returns {Promise<void>} Resolves when the document is in memory.
     */
    function panelStateReady() {
      if (panelHydration === null) panelHydration = hydratePanelState()
      return panelHydration
    }

    /**
     * Adopt a document another window wrote.
     *
     * The replacement for the `storage` event: it runs when a panel mounts, when the window
     * regains focus, and on {@link PANEL_SYNC_INTERVAL_MS} while one is open. Refused while this
     * page holds unwritten changes — the window that made the change is the one that knows.
     *
     * @returns {Promise<boolean>} Whether a newer document was adopted.
     */
    async function syncPanelState() {
      if (panelHydrated === false || panelDirty === true || panelFlushing === true) return false
      try {
        const answer = await api(STATE_PATH)
        // A successful read lifts the block a failed hydration put in place.
        panelPersistenceBlocked = false
        const revision = Number(answer?.revision ?? 0)
        if (Number.isFinite(revision) === false || revision === panelRevision) return false
        panelRevision = revision
        const startedAt = Number(answer?.harnessStartedAt ?? 0)
        if (Number.isFinite(startedAt) && startedAt > 0) panelHostStartedAt = startedAt
        const stored = answer?.state ?? null
        // A page that already holds a document never adopts "nothing": a Host that cannot read its file is
        // indistinguishable from one with no file when it answers the old way, and replacing a known document
        // with the defaults is the exact loss this panel is trying not to repeat.
        if (stored === null && panelRevision > 0) return false
        panelDocument = sanitizePersisted(stored)
        if (panelHostStartedAt > 0 && panelDocument.pending.since !== panelHostStartedAt) {
          panelDocument.pending = { since: 0, dirs: [] }
        }
        // Another window's document is now the stored one. Saying so is what stops this window from
        // writing it straight back — unless sanitising it dropped records, in which case the stored
        // copy is *not* what this page holds and claiming otherwise would leave the leftovers there
        // until the next unrelated change.
        const cleaned = droppedOrphanRecords(stored, panelDocument)
        panelFlushed = cleaned ? '' : JSON.stringify(panelDocument)
        panelDirty = false
        if (cleaned === true) requestPanelFlush()
        notifyPanels()
        return true
      } catch {
        return false
      }
    }

    /**
     * Read persisted state.
     *
     * Synchronous by contract — it is called during the first render — and safe before
     * hydration: it then answers with the defaults, and the panel is told again when the
     * document arrives.
     *
     * @returns {object} Store shape.
     */
    function readState() {
      return {
        ...emptyState(),
        category: panelDocument.category,
        installed: panelDocument.installed,
        saved: panelDocument.saved,
        savedSkills: panelDocument.savedSkills,
        enabled: panelDocument.enabled,
      }
    }

    /**
     * Persist the durable slices of the store.
     *
     * `view` and `sortBy` are not among them — see {@link emptyState}. Everything here is state that
     * should survive a reload; the view and the catalogue's opening order intentionally are not.
     *
     * @param {object} state - Store shape.
     * @returns {void}
     */
    function writeState(state) {
      panelDocument = {
        ...panelDocument,
        category: typeof state.category === 'string' && state.category !== '' ? state.category : panelDocument.category,
        installed: Array.isArray(state.installed) ? state.installed : panelDocument.installed,
        saved: Array.isArray(state.saved) ? state.saved : panelDocument.saved,
        savedSkills: state.savedSkills !== null && typeof state.savedSkills === 'object' && Array.isArray(state.savedSkills) === false
          ? state.savedSkills
          : panelDocument.savedSkills,
        enabled: state.enabled !== null && typeof state.enabled === 'object' && Array.isArray(state.enabled) === false
          ? state.enabled
          : panelDocument.enabled,
      }
      requestPanelFlush()
    }

    /* ── small presentational pieces ───────────────────────────────────── */

    /**
     * The card/inspector glyph plate: upstream artwork when it exists, the
     * category glyph on a tinted plate otherwise.
     * @param {object} props - `skill`, `large`.
     * @returns {object} Element.
     */
    function SkillIcon({ skill, large }) {
      const [broken, setBroken] = React.useState(false)
      const hue = CATEGORY_HUE[skill.category] ?? 240
      const plate = {
        background: `color-mix(in oklch, oklch(64% 0.16 ${hue}) 14%, var(--sm-surface))`,
        color: `oklch(46% 0.16 ${hue})`,
      }
      const className = `sm-skill-icon${large ? ' lg' : ''}${skill.iconUrl && !broken ? '' : ' is-tinted'}`
      if (skill.iconUrl && !broken) {
        return h('span', { className: 'sm-skill-icon' + (large ? ' lg' : '') },
          h('img', { src: skill.iconUrl, alt: '', loading: 'lazy', onError: () => setBroken(true) }))
      }
      return h('span', { className, style: plate },
        h(Icon, { name: CATEGORY_ICON[skill.category] ?? 'i-file', size: large ? 26 : 20 }))
    }

    /**
     * Compact statistics row: download count, rating, save count.
     *
     * Every figure carries an icon instead of a word. The words were `2.4M downloads · ★5.0 · 305 saves` in
     * English, which wrapped onto a second line inside a card and made the row's height depend on the
     * language; an icon is the same width in every language and needs no translation at all. The labels live
     * in `title` and `aria-label`, so the meaning is still available to a mouse and to a screen reader.
     *
     * @param {object} props - `skill`.
     * @returns {object} Element.
     */
    function Stats({ skill }) {
      return h('div', { className: 'sm-stats sm-num' },
        h('span', { className: 'sm-stat', title: t('card.downloads') },
          h(Icon, { name: 'i-download', size: 13 }),
          compact(skill.installs)),
        h('span', { className: 'sm-sep' }, '·'),
        h('span', { className: 'sm-rating', title: t('card.ratingTitle') }, h(Star, null), skill.rating),
        h('span', { className: 'sm-sep' }, '·'),
        h('span', { className: 'sm-stat', title: t('card.saves') },
          h(Icon, { name: 'i-bookmark', size: 13 }),
          compact(skill.stars)))
    }

    /**
     * The bookmark toggle shared by cards and the inspector.
     * @param {object} props - `saved`, `onToggle`, `name`, `size`.
     * @returns {object} Element.
     */
    function SaveButton({ saved, onToggle, name }) {
      return h('button', {
        type: 'button',
        className: 'sm-save-btn' + (saved ? ' saved' : ''),
        'aria-pressed': saved,
        'aria-label': t(saved ? 'card.unsave' : 'card.save', { name }),
        title: t(saved ? 'card.unsaveShort' : 'card.saveShort'),
        onClick: (event) => { event.stopPropagation(); onToggle() },
      }, h(Icon, { name: 'i-bookmark' }))
    }

    /* ── cards ─────────────────────────────────────────────────────────── */

    /**
     * One card in the `全部技能` grid.
     * @param {object} props - `skill`, `installed`, `saved`, `open`, handlers.
     * @returns {object} Element.
     */
    function SkillCard({
      skill, installed, saved, open, installing, installError,
      // Only the local version is used here, for the button's tooltip; the update
      // decision itself belongs to the 已安装 and 收藏 rows.
      update = NO_UPDATE,
      safety = 'unknown',
      onOpen, onInstall, onToggleSave,
    }) {
      return h('article', {
        className: 'sm-card sm-skill-card' + (open ? ' is-open' : ''),
        role: 'button',
        tabIndex: 0,
        'aria-label': t('card.view', { name: skill.name }),
        onClick: onOpen,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() }
        },
      },
        h('div', { className: 'sm-card-top' },
          h(SkillIcon, { skill }),
          h('div', { className: 'sm-card-title' },
            h('div', { className: 'sm-name-row' },
              h('h3', { className: 'sm-skill-name', title: skill.name }, skill.name),
              h(SafetyBadge, { verdict: safety, compact: false }),
              skill.official ? h('span', { className: 'sm-verified', title: t('card.official') }, h(Verified, null)) : null),
            h('span', { className: 'sm-publisher', title: skill.canonical || publisherOf(skill) },
              publisherOf(skill)))),
        // Outside the header, pinned to the card's own corner. It is a per-card action, not part of
        // the skill's identity, so it should not compete with the name for space in the title row —
        // and `sm-card-title` carries right padding to keep a long name clear of it.
        h(SaveButton, { saved, name: skill.name, onToggle: onToggleSave }),
        h('p', { className: 'sm-card-desc' }, skill.description || t('card.noDescription')),
        installError
          ? h('p', { className: 'sm-install-error', title: installError }, installError)
          : null,
        h('div', { className: 'sm-tags' }, skill.tags.map((tag) => h('span', { key: tag, className: 'sm-tag' }, tag))),
        h('div', { className: 'sm-card-foot' },
          h(Stats, { skill }),
          // Two states on a catalog card: 安装 when absent, 已安装 when present. The update
          // affordance deliberately lives on 已安装 and 收藏 only — the catalog is for
          // finding skills, and comparing releases belongs next to the install it would
          // replace.
          installed
            ? h('button', {
              type: 'button',
              className: 'sm-install-btn installed',
              title: update.local === '' ? t('card.installed') : t('misc.localVersion', { version: update.local }),
              onClick: (event) => { event.stopPropagation(); onOpen() },
            }, h(Icon, { name: 'i-check', size: 15 }), t('card.installed'))
            : h('button', {
              type: 'button',
              className: 'sm-install-btn' + (installing ? ' is-busy' : ''),
              disabled: installing,
              'aria-busy': installing,
              onClick: (event) => { event.stopPropagation(); if (!installing) onInstall() },
            }, h(Icon, { name: 'i-download', size: 15 }), t(installing ? 'card.installing' : 'card.install'))))
    }

    /** The update state of a skill whose latest published version is unknown. */
    const NO_UPDATE = Object.freeze({ available: false, local: '', latest: '' })

    /**
     * Compare two release strings, so "forward" and "backward" can be told apart.
     *
     * Numeric segments compare as numbers (`1.21.10` is newer than `1.9.0`, which a string
     * comparison gets wrong), and anything non-numeric is compared literally. A release that
     * cannot be parsed sorts as neither newer nor older, so an unrecognised format never
     * triggers the downgrade prompt.
     *
     * @param {string} left - Candidate version.
     * @param {string} right - Version to compare against.
     * @returns {number} Negative when left is older, positive when newer, 0 when equal or unparseable.
     */
    function compareVersions(left, right) {
      const a = String(left).split('.')
      const b = String(right).split('.')
      const length = Math.max(a.length, b.length)
      for (let index = 0; index < length; index += 1) {
        const x = a[index]
        const y = b[index]
        if (x === y) continue
        if (x === undefined) return -1
        if (y === undefined) return 1
        const nx = /^\d+$/.test(x) ? Number(x) : Number.NaN
        const ny = /^\d+$/.test(y) ? Number(y) : Number.NaN
        if (Number.isNaN(nx) || Number.isNaN(ny)) return 0
        return nx < ny ? -1 : 1
      }
      return 0
    }

    /**
     * One row of a table, as trimmed cells. The outer pipes are optional in GFM, so they are dropped only
     * when present.
     * @param {string} line - Table row.
     * @returns {string[]} Cells.
     */
    const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
    /**
     * The row that turns the line above it into a table header — `| --- | :-: |`. It must carry a pipe, or
     * a `---` thematic break would pass for one.
     * @param {string} line - Candidate line.
     * @returns {boolean} Whether it is a delimiter row.
     */
    const isTableDelimiter = (line) => line.includes('|')
      && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)
    /**
     * Column alignments from a delimiter row.
     * @param {string} line - Delimiter row.
     * @returns {Array<string|undefined>} `left`, `center`, `right` or undefined per column.
     */
    const tableAlignments = (line) => tableCells(line).map((cell) => {
      const left = cell.startsWith(':')
      const right = cell.endsWith(':')
      if (left && right) return 'center'
      if (right) return 'right'
      return left ? 'left' : undefined
    })

    /**
     * Render the small Markdown subset SkillHub content actually uses.
     *
     * Built as React elements rather than HTML: the text is author-supplied from a public registry, so it
     * is treated as data, never as markup. Headings, list items, fenced code, block quotes, GFM tables and
     * paragraphs are recognised; inline emphasis, `code` spans and links are handled within a line.
     *
     * The host's own renderer is preferred whenever the build provides it (see `Prose`), so this is the
     * fallback — and it has to hold its own, because skill documents are written in real markdown: tables
     * are common in them, and a renderer that joins a table's lines into one paragraph turns the table
     * into a wall of pipes.
     *
     * @param {string} source - Markdown text.
     * @returns {object} Element.
     */
    function Markdown({ source, onOpenFile }) {
      const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let list = null
      let code = null
      let paragraph = []

      /** Flush the paragraph being collected. */
      const flushParagraph = () => {
        if (paragraph.length === 0) return
        blocks.push({ kind: 'p', text: paragraph.join(' ') })
        paragraph = []
      }
      /** Flush the list being collected. */
      const flushList = () => {
        if (list === null) return
        blocks.push(list)
        list = null
      }

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        if (line.trim().startsWith('```')) {
          if (code === null) {
            flushParagraph()
            flushList()
            code = []
          } else {
            blocks.push({ kind: 'code', lines: code })
            code = null
          }
          continue
        }
        if (code !== null) {
          code.push(line)
          continue
        }
        // A table is a header line followed by a delimiter row. Without this the table's lines fall into
        // the paragraph branch and are joined with spaces, which turns a table into a wall of pipes — the
        // exact complaint that made this renderer grow a table rule.
        if (line.includes('|') && index + 1 < lines.length && isTableDelimiter(lines[index + 1])) {
          flushParagraph()
          flushList()
          const header = tableCells(line)
          const align = tableAlignments(lines[index + 1])
          const rows = []
          index += 2
          while (index < lines.length && lines[index].trim() !== '' && lines[index].includes('|')) {
            rows.push(tableCells(lines[index]))
            index += 1
          }
          index -= 1
          blocks.push({ kind: 'table', header, align, rows })
          continue
        }
        const heading = line.match(/^(#{1,6})\s+(.*)$/)
        if (heading !== null) {
          flushParagraph()
          flushList()
          blocks.push({ kind: 'h', level: heading[1].length, text: heading[2].trim() })
          continue
        }
        const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
        if (bullet !== null) {
          flushParagraph()
          if (list === null) list = { kind: 'ul', items: [] }
          list.items.push(bullet[1].trim())
          continue
        }
        if (line.trim() === '') {
          flushParagraph()
          flushList()
          continue
        }
        if (line.startsWith('>')) {
          flushParagraph()
          flushList()
          blocks.push({ kind: 'quote', text: line.replace(/^>\s?/, '').trim() })
          continue
        }
        flushList()
        paragraph.push(line.trim())
      }
      if (code !== null) blocks.push({ kind: 'code', lines: code })
      flushParagraph()
      flushList()

      /**
       * Render inline `**bold**`, `` `code` `` and `[label](href)` spans as elements.
       *
       * A link to another file of the bundle (`references/guide.md`) is a button when the caller can open
       * files, and a plain label otherwise: the preview has no navigation context in the overview, and a
       * dead control would promise one. Absolute http(s) links are real anchors, opened in a new tab.
       *
       * @param {string} text - One line of text.
       * @returns {Array} React children.
       */
      const inline = (text) => {
        const out = []
        const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
        let last = 0
        let match
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > last) out.push(text.slice(last, match.index))
          // Captured per iteration: the handler runs long after the loop, when `match` is null again.
          const href = match[4]
          if (match[1] !== undefined) {
            out.push(h('strong', { key: `${match.index}b` }, match[1]))
          } else if (match[2] !== undefined) {
            out.push(h('code', { key: `${match.index}c` }, match[2]))
          } else if (/^https?:\/\//i.test(href)) {
            out.push(h('a', {
              key: `${match.index}l`,
              className: 'sm-md-link',
              href,
              target: '_blank',
              rel: 'noreferrer noopener',
            }, match[3]))
          } else if (onOpenFile === undefined) {
            out.push(h('span', { key: `${match.index}l`, className: 'sm-md-ref', title: href }, match[3]))
          } else {
            out.push(h('button', {
              key: `${match.index}l`,
              type: 'button',
              className: 'sm-md-ref',
              title: href,
              onClick: () => onOpenFile(href),
            }, match[3]))
          }
          last = match.index + match[0].length
        }
        if (last < text.length) out.push(text.slice(last))
        return out
      }

      return h('div', { className: 'sm-md' }, blocks.map((block, index) => {
        const key = `${block.kind}-${String(index)}`
        if (block.kind === 'h') return h('h' + String(Math.min(block.level + 2, 6)), { key }, inline(block.text))
        if (block.kind === 'ul') return h('ul', { key }, block.items.map((item, i) => h('li', { key: i }, inline(item))))
        if (block.kind === 'code') return h('pre', { key }, h('code', null, block.lines.join('\n')))
        if (block.kind === 'quote') return h('blockquote', { key }, inline(block.text))
        if (block.kind === 'table') {
          const alignStyle = (column) => block.align[column] === undefined ? undefined : { textAlign: block.align[column] }
          return h('div', { key, className: 'sm-table-wrap' },
            h('table', { className: 'sm-table' },
              h('thead', null,
                h('tr', null, block.header.map((cell, column) => h('th', { key: column, style: alignStyle(column) }, inline(cell))))),
              block.rows.length === 0
                ? null
                : h('tbody', null, block.rows.map((row, rowIndex) => h('tr', { key: rowIndex },
                  block.header.map((_, column) => h('td', { key: column, style: alignStyle(column) }, inline(row[column] ?? ''))))))))
        }
        return h('p', { key }, inline(block.text))
      }))
    }

    /**
     * One node of the file tree, rendered recursively and collapsible.
     *
     * The listing arrives flat, so the hierarchy is drawn here. Every directory starts
     * folded: a skill bundle can hold dozens of files across nested folders, and opening
     * one gives the shape of the bundle at a glance instead of a wall of paths. The first
     * level is therefore the most informative view, and a branch opens on request.
     *
     * @param {{nodes: Array<object>, depth?: number, onOpen?: (path: string) => void}} props - Tree nodes, indent, and the file handler.
     * @returns {object} Element.
     */
    function FileTree({ nodes, depth = 0, onOpen }) {
      const [closed, setClosed] = React.useState(() => new Set(nodes.filter((node) => node.kind === 'dir').map((node) => node.path)))
      return h('div', { className: 'sm-tree' }, nodes.map((node) => {
        const isClosed = closed.has(node.path)
        /** Fold or unfold one directory. */
        const toggle = () => {
          setClosed((current) => {
            const next = new Set(current)
            if (next.has(node.path)) next.delete(node.path)
            else next.add(node.path)
            return next
          })
        }
        if (node.kind === 'dir') {
          return h('div', { key: node.path, className: 'sm-tree-group' },
            h('button', {
              type: 'button',
              className: 'sm-tree-row sm-tree-dir',
              style: { paddingLeft: `${String(8 + depth * 16)}px` },
              'aria-expanded': !isClosed,
              onClick: toggle,
            },
              h(Icon, { name: isClosed ? 'i-chevron-right' : 'i-chevron-down', size: 13 }),
              h(Icon, { name: 'i-folder', size: 14 }),
              h('span', { className: 'sm-tree-name' }, node.name),
              h('span', { className: 'sm-num sm-tree-meta' },
                t('files.nodeSummary', { files: node.files, size: humanSize(node.bytes) }))),
            isClosed ? null : h(FileTree, { nodes: node.children, depth: depth + 1, onOpen }))
        }
        // Files are the actionable rows: a button, so the whole row is a click target and
        // the list is reachable by keyboard too.
        return h('button', {
          key: node.path,
          type: 'button',
          className: 'sm-tree-row sm-tree-file',
          style: { paddingLeft: `${String(8 + depth * 16)}px` },
          title: t('files.nodeTitle', { path: node.path }),
          onClick: () => onOpen?.(node.path),
        },
          h('span', { className: 'sm-tree-ic' }),
          h(Icon, { name: 'i-file', size: 14 }),
          h('span', { className: 'sm-tree-name' }, node.name),
          h('span', { className: 'sm-num sm-tree-meta' }, humanSize(node.size)))
      }))
    }

    /**
     * The published version list, with the recent entries in front and the rest folded.
     *
     * Three is the number that fits without pushing 版本与来源 off the screen, and a long
     * history is not read top to bottom — the older rows are there to be available, not to
     * be scanned. The count on the toggle says how much is behind it, so folding never
     * hides the shape of the history.
     *
     * Each row can install that release. Upstream serves any named version's file list and
     * files (`version=` is honoured on both endpoints), so this reinstalls the directory
     * rather than merely labelling it — which is what makes it useful for stepping back
     * from a release that broke something.
     *
     * @param {{versions: Array<object>, installedVersion: string, onInstall: (version: string) => void, busy: boolean}} props - Version records and install wiring.
     * @returns {object} Element.
     */
    function VersionHistory({ versions, installedVersion, onInstall, busy }) {
      const [expanded, setExpanded] = React.useState(false)
      const shown = expanded ? versions : versions.slice(0, 3)
      const hidden = versions.length - shown.length
      return h(React.Fragment, null,
        h('div', { className: 'sm-versions' }, shown.map((entry, index) => {
          const version = String(entry?.version ?? '')
          const isInstalled = version !== '' && version === installedVersion
          return h('div', {
            key: String(entry?.versionId ?? entry?.version ?? index),
            className: 'sm-version-row',
          },
            h('span', { className: 'sm-version-tag sm-num' }, 'v' + (version || '—')),
            h('div', { className: 'sm-version-main' },
              h('div', { className: 'sm-version-log' }, String(entry?.changelog ?? '') || t('versions.noChangelog')),
              h('div', { className: 'sm-version-date sm-num' },
                new Date(Number(entry?.createdAt ?? 0) || Date.now()).toLocaleString('zh-CN'))),
            h('div', { className: 'sm-version-actions' },
              index === 0 ? h('span', { className: 'sm-badge plain' }, t('versions.latest')) : null,
              isInstalled
                ? h('span', { className: 'sm-badge plain' }, t('card.installed'))
                : h('button', {
                  type: 'button',
                  className: 'sm-btn sm-btn-secondary sm-btn-sm',
                  disabled: busy,
                  onClick: () => onInstall(version),
                }, h(Icon, { name: 'i-download', size: 14 }), t('card.install'))))
        })),
        versions.length > 3
          ? h('button', {
            type: 'button',
            className: 'sm-btn sm-btn-secondary sm-btn-sm sm-versions-toggle',
            'aria-expanded': expanded,
            onClick: () => setExpanded((current) => !current),
          }, h(Icon, { name: expanded ? 'i-chevron-down' : 'i-chevron-right', size: 14 }),
          expanded ? t('versions.collapse') : t('versions.expand', { count: hidden }))
          : null)
    }

    /**
     * Loading placeholder shaped like a skill card.
     * @returns {object} Element.
     */
    function SkeletonCard() {
      return h('div', { className: 'sm-skeleton', 'aria-hidden': true },
        h('div', { className: 'sm-sk-head' },
          h('div', { className: 'sm-sk-plate' }),
          h('div', { className: 'sm-sk-lines' },
            h('div', { className: 'sm-sk-line', style: { width: '58%' } }),
            h('div', { className: 'sm-sk-line', style: { width: '34%' } }))),
        h('div', { className: 'sm-sk-line', style: { width: '100%' } }),
        h('div', { className: 'sm-sk-line', style: { width: '82%' } }))
    }

    /**
     * The shared empty/error state.
     * @param {object} props - `icon`, `title`, `body`, `error`, `children`.
     * @returns {object} Element.
     */
    function EmptyState({ icon, title, body, error, children }) {
      return h('div', { className: 'sm-empty' + (error ? ' is-error' : '') },
        h('span', { className: 'sm-empty-mark' }, h(Icon, { name: icon, size: 22 })),
        h('h3', null, title),
        body ? h('p', null, body) : null,
        children ? h('div', { className: 'sm-empty-actions' }, children) : null)
    }

    /**
     * The switch used by installed and imported rows.
     * @param {object} props - `checked`, `label`, `onChange`.
     * @returns {object} Element.
     */
    function Switch({ checked, label, onChange }) {
      return h('label', { className: 'sm-switch', title: t('installed.toggleLabel') },
        h('input', {
          type: 'checkbox',
          checked,
          'aria-label': label,
          onChange: (event) => onChange(event.target.checked),
        }),
        h('span', { className: 'sm-track' }),
        h('span', { className: 'sm-thumb' }))
    }

    /* ── the panel ─────────────────────────────────────────────────────── */

    /**
     * The complete market panel.
     * @param {object} props - Slot props injected by the registration.
     * @returns {object} Element.
     */
    function SkillMarketPanel(props) {
      const store = React.useMemo(() => readState(), [])
      const [view, setView] = React.useState(store.view)
      const [category, setCategory] = React.useState(store.category)
      const [sortBy, setSortBy] = React.useState(store.sortBy)
      const [query, setQuery] = React.useState('')
      const [debouncedQuery, setDebouncedQuery] = React.useState('')
      const [selected, setSelected] = React.useState(null)
      const [detailTab, setDetailTab] = React.useState(store.detailTab)
      /**
       * Full detail for the open skill, fetched from SkillHub on demand.
       *
       * `overviewMd`, the version list and the file listing exist only behind per-skill
       * endpoints, so they cannot ride the list cards. Cached per `@handle/slug` because
       * 62 versions and 84 paths are not worth refetching every time the panel reopens.
       * @type {[Record<string, object>, Function]}
       */
      const [details, setDetails] = React.useState({})
      /**
       * Scan verdicts, keyed by skill id.
       *
       * Fetched separately from `details` because the two are needed at different times: a card needs
       * only the verdict, and pulling a whole detail response (2.3 KB, mostly description) once per
       * card would be wasteful. The Host answers the verdict from its cached detail fetch.
       * @type {[Record<string, {kind: string, verdict?: string, vendors?: Array<object>}>, Function]}
       */
      const [security, setSecurity] = React.useState({})
      /**
       * Ids whose verdict has been asked for, including requests still in flight and ones that
       * failed. Rendering calls the loader, so this is what stops a re-render from re-requesting.
       * @type {React.MutableRefObject<Set<string>>}
       */
      const securityRequests = React.useRef(new Set())
      /**
       * The file whose contents the drawer is previewing, if any.
       *
       * A file's bytes exist only behind a per-file endpoint, so the preview is fetched
       * on demand. Held as `{path, version}` so a preview opened from the version list
       * reads that release rather than the latest.
       * @type {[{path: string, version: string} | null, Function]}
       */
      const [preview, setPreview] = React.useState(null)
      /**
       * Files read before the open one, newest last — the trail a document's links leave behind.
       *
       * Following `references/topics.md` from `SKILL.md` replaces what the dialog shows, so without this the
       * reader who follows a link has no way back except closing the dialog and finding the tree row again.
       * The trail is emptied whenever a file is opened from the tree: that is a new read, not a step.
       * @type {[Array<{path: string, version: string}>, Function]}
       */
      const [previewTrail, setPreviewTrail] = React.useState([])
      /** Fetched file contents, keyed by `<version>:<path>` so releases do not collide. */
      const [previews, setPreviews] = React.useState({})
      const [installed, setInstalled] = React.useState(store.installed)
      /**
       * Saved skill ids, newest first — the favorite order the panel shows.
       * @type {[string[], Function]}
       */
      const [saved, setSaved] = React.useState(store.saved)
      /**
       * Saved records keyed by id, so the 收藏 list renders on a cold page load
       * without waiting for a catalog page to happen to contain those skills.
       *
       * A favorite with no record here cannot be resolved and is pruned, since this
       * build treats ids-without-records as data to discard rather than migrate.
       * @type {[Record<string, object>, Function]}
       */
      const [savedSkills, setSavedSkills] = React.useState(store.savedSkills)
      const [enabled, setEnabled] = React.useState(store.enabled)
      /**
       * Skills that live on this machine rather than coming from the market.
       *
       * Both origins: `local` for a package imported through this page, and `manual` for a
       * directory the user placed in a root themselves. They belong together here because the page
       * is about local skills, and a hand-copied one is exactly that — reporting it only under
       * 已安装 left this page unable to show what is actually installed locally.
       *
       * Not client state: the directory is the record, exactly as it is for an installed skill.
       * Keeping a separate ledger is what let the panel list an imported skill that existed
       * nowhere — the row was real, the skill was not.
       * @type {Array<object>}
       */
      const imported = React.useMemo(
        () => installed.filter((entry) => entry.origin === 'local' || entry.origin === 'manual'),
        [installed],
      )
      /** Progress of an in-flight local import, or null. */
      const [importProgress, setImportProgress] = React.useState(null)
      /**
       * The confirmation the panel is currently asking, or null.
       *
       * One slot is enough — asking two questions at once is not a state worth supporting, and a
       * second request replaces the first rather than queueing behind a dialog nobody dismissed.
       * @type {[{title: string, body: string, detail: string, confirmLabel: string, danger: boolean, onConfirm: Function} | null, Function]}
       */
      const [confirmRequest, setConfirmRequest] = React.useState(null)
      const [catalog, setCatalog] = React.useState({ skills: [], total: 0 })
      const [status, setStatus] = React.useState('loading')
      const [failure, setFailure] = React.useState('')
      const [categories, setCategories] = React.useState(FALLBACK_CATEGORIES)
      /**
       * Category-vocabulary revision. `-1` means "the vocabulary has not
       * resolved yet": the card loader waits for it, so the first page is
       * labelled with the site's own category names instead of being fetched
       * twice — once with the fallback list and once with the live one.
       */
      const [categoriesRev, setCategoriesRev] = React.useState(-1)
      const [toast, setToast] = React.useState(null)
      const [dragOver, setDragOver] = React.useState(false)
      /**
       * Skill directories whose enable/disable choice was made since this page
       * loaded. Shown as advice to restart; never enforced.
       * @type {[Set<string>, Function]}
       */
      const [pendingRestart, setPendingRestart] = React.useState(() => readPending())
      /** Bumped to force the skill list to reload (refresh action, retry). */
      const [reloadNonce, setReloadNonce] = React.useState(0)
      /**
       * The one in-flight install, if any. A real install downloads a whole
       * file bundle, so the UI must be able to say "installing…" on the exact
       * card and refuse a second click instead of starting a parallel download.
       * @type {[{kind: 'idle'} | {kind: 'installing', id: string, name: string} | {kind: 'failed', id: string, name: string, reason: string}, Function]}
       */
      const [installState, setInstallState] = React.useState({ kind: 'idle' })
/**
       * [dsh-perfect-ui patch] Self update check for THIS plugin
       * (`@local/dsh-perfect-ui`), not for the recommended third-party bundles:
       * the button and the banner exist so the user learns about a newer
       * 橘小黑工作台 itself. The panel runs it on mount (no button press), so
       * this state is the *result*: {phase:'running'|'done'|'error', info,
       * error, pending}. `pluginUpdatesOpen` shows the dialog.
       * Same Host endpoint as the workbench page (`/self`), so both agree.
       * @type {[object|null, Function]}
       */
      const [pluginUpdates, setPluginUpdates] = React.useState(null)
      const [pluginUpdatesOpen, setPluginUpdatesOpen] = React.useState(false)
      const [pluginUpdatesDismissed, setPluginUpdatesDismissed] = React.useState(false)
      const pluginUpdatesBusy = React.useRef(false)
      /**
       * [dsh-perfect-ui patch] Run the shared self-update check. Kept in a
       * callback so the re-check button inside the dialog and the top-bar
       * control share one guard: a second click while a check is in flight
       * must be a no-op. `force` bypasses the Host side 30-minute cache.
       */
      const checkPluginUpdates = React.useCallback((force) => {
        if (pluginUpdatesBusy.current) return
        pluginUpdatesBusy.current = true
        setPluginUpdates((previous) => ({
          phase: 'running',
          info: (previous && previous.info) || null,
          error: '',
          pending: null,
        }))
        fetch('/api/dsh-perfect-ui-plugins/self' + (force === true ? '?force=1' : ''))
          .then((response) => response.text().then((text) => {
            if (text === '' || text.trim() === '') throw new Error('空响应（HTTP ' + response.status + '）')
            return JSON.parse(text)
          }))
          .then((answer) => {
            if (answer === null || answer.ok !== true) throw new Error((answer && answer.error) || '检测失败')
            const info = {
              name: answer.name || '@local/dsh-perfect-ui',
              installed: answer.installed || '',
              latest: answer.latest || '',
              canUpdate: answer.canUpdate === true,
              updateMode: answer.updateMode || 'unknown',
              repoUrl: answer.repoUrl || '',
              error: answer.error || '',
              checkedAt: answer.checkedAt || '',
            }
            /* Cache on window so reopening the panel within the TTL shows the
               last result at once instead of re-running git ls-remote. */
            try { window.__dshPuSelfCache = { at: Date.now(), info } } catch { /* ignore */ }
            setPluginUpdates({ phase: 'done', info, error: '', pending: null })
          })
          .catch((error) => {
            setPluginUpdates((previous) => ({
              phase: 'error',
              info: (previous && previous.info) || null,
              error: '检测失败：' + ((error && error.message) || String(error)),
              pending: null,
            }))
          })
          .then(() => { pluginUpdatesBusy.current = false })
      }, [])
      /**
       * [dsh-perfect-ui patch] Update this plugin from the dialog. The Host
       * computes the target version itself (same口径 as the workbench). Only
       * registry / git installs are updatable this way; a local `link:`
       * install has no versions to compare, so the dialog just says so.
       * The outcome goes through the panel toast (the re-check right after
       * would overwrite a notice kept in this state, and a toast outlives it).
       */
      const applyPluginUpdate = React.useCallback((info) => {
        if (info === null || info === undefined) return
        setPluginUpdates((previous) => (previous === null ? previous : { ...previous, pending: info.name }))
        fetch('/api/dsh-perfect-ui-plugins/update', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: info.name }),
        })
          .then((response) => response.json())
          .then((answer) => {
            setPluginUpdates((previous) => (previous === null ? previous : { ...previous, pending: null }))
            setToast({
              id: Date.now(),
              message: answer && answer.ok
                ? ((answer.message || '更新完成') + '，重启 DSH 后生效')
                : ((answer && answer.error) || '更新失败'),
            })
            checkPluginUpdates(true)
          })
          .catch((error) => {
            setPluginUpdates((previous) => (previous === null ? previous : { ...previous, pending: null }))
            setToast({ id: Date.now(), message: '更新异常：' + ((error && error.message) || String(error)) })
          })
      }, [checkPluginUpdates])
      /**
       * [dsh-perfect-ui patch] Auto-detect: no button press. On mount, reuse a
       * result younger than 5 minutes (the window cache survives panel
       * remounts), otherwise run the check. Errors stay quiet here — the
       * dialog shows them only when the user opens it, so a failed check does
       * not shout at someone who just wanted to browse skills.
       */
      React.useEffect(() => {
        const cached = window.__dshPuSelfCache
        if (cached && cached.info && Date.now() - cached.at < 5 * 60 * 1000) {
          setPluginUpdates({ phase: 'done', info: cached.info, error: '', pending: null })
          return
        }
        checkPluginUpdates(false)
      }, [])
      const contentRef = React.useRef(null)
      const searchRef = React.useRef(null)
      const fileRef = React.useRef(null)
      const toastTimer = React.useRef(null)
      /**
       * Whether an install is in flight. A ref, not the state value: the guard
       * must reject a second click that arrives before React has re-rendered,
       * which reading `installState` inside the callback cannot do.
       */
      const installBusy = React.useRef(false)

      /**
       * Every skill this session has seen, so 已安装/收藏 rows survive paging.
       * A ref also keeps the card loader independent of the category list's
       * identity: the newest vocabulary is read at call time.
       */
      const seen = React.useRef(new Map())
      const categoriesRef = React.useRef(categories)
      categoriesRef.current = categories
      const remember = React.useCallback((list) => {
        for (const skill of list) seen.current.set(skill.id, skill)
      }, [])

      /** Persist the durable slices whenever one of them changes. */
      React.useEffect(() => {
        writeState({ category, sortBy, installed, saved, savedSkills, enabled })
      }, [category, sortBy, installed, saved, savedSkills, enabled])

      /**
       * Reconcile the local ledger with the Host on mount.
       *
       * The Host is the authority: it reports every skill actually on disk, so its answer both
       * adopts changed paths/sizes and *creates* rows the panel has never seen. That second half
       * is what makes a locally imported skill appear at all — an earlier version only patched
       * rows already in the ledger, so anything the Host knew and the ledger did not was
       * invisible, which is exactly the case an import produces.
       *
       * A row that the Host does not know about is dropped, except for a legacy favorite whose
       * record has no directory behind it: those predate the directory-is-the-record rule and
       * are kept rather than silently discarded.
       */
      React.useEffect(() => {
        const controller = new AbortController()
        // Hydration first. It replaces the ledger with the stored copy, so reconciling before it
        // settles would let the adoption overwrite the Host's answer with the very rows this
        // effect exists to correct.
        panelStateReady()
          .then(() => api('installed', undefined, controller.signal))
          .then((body) => {
            const hostRows = Array.isArray(body?.skills) ? body.skills : []
            setInstalled((current) => {
              const known = new Set(current.map((entry) => String(entry.id)))
              const fromHost = hostRows.map((host) => {
                const directoryName = String(host.directoryName
                  ?? String(host.directory ?? '').split(/[\\/]/).pop())
                const previous = current.find((entry) => entry.directoryName === directoryName)
                // The Host's `handle`/`slug` are the **upstream** identifiers it recovered from the
                // install record; the directory name only approximates them (`user_814dbe54` is on disk
                // as `user-814dbe54`). Deriving them again from the directory name here undid that and
                // built an id the catalogue never uses — so every catalog card read "not installed".
                // The directory name is still the fallback, for a row the Host could not identify.
                const [directoryHandle, ...directorySlugParts] = directoryName.split('--')
                const handle = String(host.handle ?? '').trim() || directoryHandle
                const slug = String(host.slug ?? '').trim() || directorySlugParts.join('--')
                return {
                  id: `@${handle}/${slug}`,
                  // The Host's answer wins for the time too: it reports the recorded install
                  // time, or the directory's mtime when there is no record. Falling back to 0
                  // here is what produced "安装于 57 年前", so an absent value stays absent.
                  installedAt: Number(host.installedAt ?? 0) || Number(previous?.installedAt ?? 0) || 0,
                  name: host.name,
                  version: host.version || '',
                  latestVersion: host.latestVersion ?? '',
                  directory: host.directory,
                  directoryName,
                  registeredAs: host.name,
                  handle,
                  slug,
                  origin: host.origin ?? 'market',
                  // The Host's own answer for whether it is on, used whenever this browser has no
                  // recorded choice. Guessing from the ledger made a skill that is plainly in the
                  // skill root show as 已停用.
                  enabled: host.enabled !== false,
                  files: host.files,
                  bytes: host.bytes,
                }
              })
              const hostIds = new Set(fromHost.map((entry) => entry.id))
              const orphans = current.filter((entry) => (
                hostIds.has(String(entry.id)) === false
                && String(entry.id).startsWith('local-')
              ))
              return [...fromHost, ...orphans]
            })
            // The `enabled` map is a cache of where the directories are, so it is rebuilt from
            // this answer rather than merged. Merging let an entry from a previous session keep
            // overriding the Host, which is how a skill sitting in the skill root was labelled
            // 已停用 while another view called it enabled.
            setEnabled(Object.fromEntries(hostRows.map((host) => {
              const directoryName = String(host.directoryName
                ?? String(host.directory ?? '').split(/[\\/]/).pop())
              return [directoryName, host.enabled !== false]
            })))
          })
          .catch(() => {
            /* the ledger stays as it was; nothing here is worth an error surface */
          })
        return () => controller.abort()
        // Re-runs whenever a skill is written or toggled, so the cache follows the disk.
      }, [reloadNonce])

      /**
       * Seed the in-memory catalog from the saved records on a cold load.
       *
       * `seen` is a ref, not state, so this runs once: it makes 收藏 rows resolvable
       * before any catalog page arrives, which is what lets the list render after a
       * reload instead of only after the next save. Records are overwritten by live
       * data as pages load, because `remember()` sets the same ids.
       */
      React.useEffect(() => {
        for (const [id, record] of Object.entries(savedSkills)) {
          if (seen.current.has(id) === false) seen.current.set(id, record)
        }
        // `savedSkills` at mount is the persisted snapshot; later writes are already
        // in `seen` through toggleSave/remember, so this must not re-run per change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      /** Search is debounced, mirroring the prototype's 300 ms feel. */
      React.useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
        return () => window.clearTimeout(timer)
      }, [query])

      /*
       * There is deliberately no keyboard shortcut to focus the search field.
       *
       * `/` belongs to the conversation — it opens slash commands — so a window-level
       * listener that calls `preventDefault()` on it is competing for input the panel does
       * not own. The existing guard (skip while an input has focus) only covers the case
       * where focus is already in a field; a `/` typed into the composer while focus sits
       * anywhere else would still be swallowed, and the listener stays armed even when the
       * panel is off screen. `⌘K` is the shell's, which is why the old handler returned
       * early for it and advertised a key it never handled.
       */

      /** Escape closes the inspector, like the prototype — unless a file dialog is open over it. */
      React.useEffect(() => {
        if (selected === null) return undefined
        // The dialog is the innermost layer and closes on its own Escape; closing the whole drawer out
        // from under it would throw away the reader's place in the tree.
        const onKeyDown = (event) => { if (event.key === 'Escape' && preview === null) setSelected(null) }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [selected, preview])

      /** The category vocabulary is upstream data; fall back to the shipped list. */
      React.useEffect(() => {
        const controller = new AbortController()
        api('/categories', undefined, controller.signal)
          .then((body) => {
            const items = Array.isArray(body?.items) ? body.items : []
            const list = items
              .filter((item) => item?.active !== false && Number(item?.level ?? 1) === 1)
              .filter((item) => HIDDEN_CATEGORIES.has(String(item?.key)) === false)
              .sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0))
              .map((item) => ({ key: String(item.key), name: String(item.name || item.key) }))
            if (list.length > 0) setCategories(list)
            setCategoriesRev((current) => (current < 0 ? 0 : current + 1))
          })
          .catch(() => {
            // The shipped vocabulary already rendered; unblock the card loader.
            setCategoriesRev((current) => (current < 0 ? 0 : current))
          })
        return () => controller.abort()
      }, [])

      /**
       * Fetch the per-category totals once the vocabulary is known.
       *
       * Runs after the vocabulary resolves, and never blocks the card list: the chips
       * render immediately with their names and gain counts when this answers. A
       * failure leaves the chips count-less rather than hiding them.
       */
      React.useEffect(() => {
        if (categoriesRev < 0) return undefined
        const controller = new AbortController()
        api('category-counts', undefined, controller.signal)
          .then((body) => {
            const counts = body?.counts
            if (counts !== null && typeof counts === 'object') {
              const clean = {}
              for (const [key, value] of Object.entries(counts)) {
                if (Number.isFinite(Number(value))) clean[key] = Number(value)
              }
              setCategoryCounts(clean)
            }
          })
          .catch(() => {
            /* counts are decoration: keep the chips without them */
          })
        return () => controller.abort()
      }, [categoriesRev])

      /**
       * The query the catalog currently reflects, and therefore the one every page
       * fetch must use. Held in one place because the first page and each appended
       * page have to agree on it, and because a change here means the accumulated
       * pages are stale.
       */
      const catalogQuery = React.useMemo(() => ({
        sortBy,
        keyword: debouncedQuery.trim(),
        category: category === 'all' ? '' : category,
      }), [sortBy, debouncedQuery, category])

      /** How many rows one page holds. Also the stepping size for the lazy loader. */
      const PAGE_SIZE = 60
      /**
       * How many scan-verdict requests to keep in flight while filling a page of cards.
       *
       * One request per card, and a page is 60 — so this is a deliberate ceiling rather than a
       * measurement. Low enough not to open 60 sockets at once, high enough that a page fills in
       * well under a second against the Host's cache.
       */
      const SECURITY_CONCURRENCY = 6
      const [pageCount, setPageCount] = React.useState(0)
      const [hasMore, setHasMore] = React.useState(false)
      const [loadingMore, setLoadingMore] = React.useState(false)
      /** Guards the loader against the observer firing while a page is in flight. */
      const loadingMoreRef = React.useRef(false)
      /** The sentinel the lazy loader watches. */
      const sentinelRef = React.useRef(null)

      /**
       * Load the first page of a query and replace the catalog.
       *
       * Runs on every filter change, and resets the paging state with it: appended
       * pages belong to the query that produced them, so they are dropped rather than
       * merged into an unrelated result set.
       */
      React.useEffect(() => {
        if (categoriesRev < 0) return undefined
        const controller = new AbortController()
        setStatus('loading')
        setFailure('')
        loadSkills({ page: 1, pageSize: PAGE_SIZE, ...catalogQuery, signal: controller.signal }, categoriesRef.current)
          .then((page) => {
            remember(page.skills)
            setCatalog(page)
            setPageCount(1)
            setHasMore(page.skills.length > 0 && page.skills.length < page.total)
            setStatus('ready')
          })
          .catch((error) => {
            if (error?.name === 'AbortError') return
            setFailure(error instanceof Error ? error.message : String(error))
            setStatus('error')
          })
        return () => controller.abort()
      }, [catalogQuery, categoriesRev, remember, reloadNonce])

      /**
       * Append the next page to the catalog.
       *
       * Idempotent per page number and safe to call repeatedly: the observer can fire
       * more than once while a page is on the wire, and a second request for the same
       * page would duplicate every card. A failure leaves the loaded pages intact and
       * simply stops offering more, because a mid-list error is not worth replacing
       * what already rendered.
       */
      const loadMore = React.useCallback(async () => {
        if (loadingMoreRef.current || hasMore === false || status !== 'ready') return
        loadingMoreRef.current = true
        setLoadingMore(true)
        const nextPage = pageCount + 1
        const controller = new AbortController()
        try {
          const page = await loadSkills(
            { page: nextPage, pageSize: PAGE_SIZE, ...catalogQuery, signal: controller.signal },
            categoriesRef.current,
          )
          if (page.skills.length === 0) {
            setHasMore(false)
            return
          }
          remember(page.skills)
          setCatalog((current) => {
            // Deduplicate by id: upstream paging is offset-based, so a skill inserted
            // between two requests can shift a row into the page just fetched.
            const seenIds = new Set(current.skills.map((skill) => skill.id))
            const fresh = page.skills.filter((skill) => seenIds.has(skill.id) === false)
            return { skills: [...current.skills, ...fresh], total: page.total }
          })
          setPageCount(nextPage)
          setHasMore(page.skills.length > 0 && nextPage * PAGE_SIZE < page.total)
        } catch {
          /* keep what is rendered; the footer offers a retry by scrolling again */
        } finally {
          loadingMoreRef.current = false
          setLoadingMore(false)
        }
      }, [catalogQuery, hasMore, pageCount, remember, status])

      /**
       * Load the next page when the sentinel scrolls into view.
       *
       * The observer is re-created whenever the callback identity changes, which is
       * exactly when the paging state moved — so it always watches the current
       * sentinel with the current page number. Profiles without
       * `IntersectionObserver` (and jsdom) fall through to the explicit button the
       * grid renders, so the list is still reachable without it.
       */
      React.useEffect(() => {
        const node = sentinelRef.current
        if (node === null || typeof window.IntersectionObserver !== 'function') return undefined
        const observer = new window.IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void loadMore()
        }, { rootMargin: '600px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
      }, [loadMore, hasMore, pageCount])

      /**
       * Adopt the stored document, and keep adopting it.
       *
       * Hydration starts when the client plugin activates, which is normally before this panel is
       * mounted — but "normally" is not a contract, so the listener is attached either way and the
       * document is also applied immediately, which makes the late case work and the early case a
       * no-op. The same subscription covers what the `storage` event used to: another window
       * writing the file raises nothing in this one, so the focus listener and the interval ask
       * the Host instead.
       */
      React.useEffect(() => {
        let live = true
        const adopt = () => {
          if (live === false) return
          const next = readState()
          setCategory(next.category)
          setInstalled(next.installed)
          setSaved(next.saved)
          setSavedSkills(next.savedSkills)
          setEnabled(next.enabled)
          setPendingRestart(readPending())
        }
        panelListeners.add(adopt)
        adopt()
        const onFocus = () => { void syncPanelState() }
        window.addEventListener('focus', onFocus)
        const timer = window.setInterval(() => { void syncPanelState() }, PANEL_SYNC_INTERVAL_MS)
        return () => {
          live = false
          panelListeners.delete(adopt)
          window.removeEventListener('focus', onFocus)
          window.clearInterval(timer)
        }
      }, [])

      /**
       * Reset the drawer when the inspector switches subject.
       *
       * The tab goes back to 概览, and an open file preview is dropped: a preview is one file *of one
       * skill*, so carrying it across a switch left this skill's 文件 tab pointing at the previous
       * skill's path — which, while the cache key was `<version>:<path>`, meant it rendered the
       * previous skill's contents.
       */
      React.useEffect(() => {
        setDetailTab('overview')
        setPreview(null)
        // A trail belongs to one skill's bundle: carrying it across a switch would let "back" open a file
        // of the skill the reader just left.
        setPreviewTrail([])
      }, [selected])

      /**
       * Bring the list back to its top whenever the result set changes. The head
       * is now fixed, so a reader who filters while scrolled to the middle of the
       * previous list would otherwise keep staring at the middle of the new one.
       */
      React.useEffect(() => {
        if (contentRef.current !== null) contentRef.current.scrollTop = 0
      }, [category, sortBy, debouncedQuery])

      /** Announce a transient message with the prototype's 4.2 s lifetime. */
      const notify = React.useCallback((message, undo) => {
        setToast({ id: Date.now(), message, undo: typeof undo === 'function' ? undo : null })
        if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), 4200)
      }, [])
      React.useEffect(() => () => {
        if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      }, [])

      const installedIds = React.useMemo(() => new Set(installed.map((entry) => entry.id)), [installed])
      const savedIds = React.useMemo(() => new Set(saved), [saved])
      /**
       * The skill a row describes, by its own id.
       * @param {string} id - Skill id.
       * @returns {object | null} Catalog record, or null.
       */
      const findSkill = React.useCallback((id) => seen.current.get(id) ?? null, [])
      const selectedSkill = selected === null ? null : findSkill(selected)

      /**
       * Whether a row's skill is enabled, as the Host reported it.
       *
       * Keyed by **directory name**, not by id. Disabled state is a location on disk, and the
       * directory is the one name the filesystem, the Host and every view agree on. Ids do not
       * qualify: the same skill is `@local/demo` in 已安装 and `local-…` in 本地导入, so an
       * `enabled` map keyed by id let one view call a skill disabled while another called it
       * enabled — and a skill plainly present in the skill root showed as 已停用.
       *
       * @param {object} entry - Installed ledger row.
       * @returns {boolean} True when the skill is on.
       */
      const isEnabled = React.useCallback((entry) => {
        const key = String(entry?.directoryName ?? entry?.id ?? '')
        const chosen = enabled[key]
        if (chosen !== undefined) return chosen !== false
        // No local choice recorded: the Host's answer is the only honest source.
        return entry?.enabled !== false
      }, [enabled])

      /**
       * Record that a skill's enabled state changed since this page loaded.
       *
       * Kept as advice, not as a gate: the change already took effect on the Host,
       * so the panel never blocks or nags. Turning a skill back to its original
       * state removes it from the list again, so the reminder only ever names
       * skills that really differ.
       *
       * @param {string} directoryName - Skill directory name, or '' to skip.
       * @returns {void}
       */
      const markPending = React.useCallback((directoryName) => {
        if (directoryName === '') return
        setPendingRestart((current) => {
          const next = new Set(current)
          next.add(directoryName)
          writePending(next)
          return next
        })
      }, [])

      /**
       * Turn an installed skill on or off in the running session.
       *
       * The switch is not a local flag: it calls the Host, which moves the directory
       * between the skill root and the disabled store and reconciles its live
       * registrations, so the change is durable the moment the Host answers. The row
       * is only updated from the Host's own answer, so the UI cannot disagree with
       * the runtime.
       *
       * The user-facing message is only "restart DeepSeek Harness for this to take
       * effect", because a conversation keeps the tool set and skill catalog its agent
       * was created with — so whether *this* conversation notices is not something the
       * panel can promise.
       *
       * @param {object} skill - Catalog skill or installed row carrying `id`.
       * @param {object} entry - The installed row, which knows the directory.
       * @param {boolean} next - Desired state.
       * @returns {Promise<void>} Resolves once the Host has answered.
       */
      const setSkillEnabled = React.useCallback(async (skill, entry, next) => {
        const directory = String(entry?.directory ?? '').split(/[\\/]/).pop()
        // Keyed by directory name for the same reason `isEnabled` reads it that way: it is the one
        // identifier the filesystem and every view share, so a choice made in one list is seen by
        // the others. An id-keyed write left the other view still calling the skill disabled.
        const key = String(entry?.directoryName ?? skill?.id ?? '')
        if (directory === '') {
          // Nothing on disk to toggle (a legacy bookmark row): local only.
          setEnabled((current) => ({ ...current, [key]: next }))
          return
        }
        setEnabled((current) => ({ ...current, [key]: next }))
        try {
          const body = await apiPost('enabled', { directory, enabled: next })
          const reported = Array.isArray(body?.installed?.skills) ? body.installed.skills : []
          const match = reported.find((row) => String(row.directory).endsWith(directory))
          if (match !== undefined) {
            setEnabled((current) => ({ ...current, [key]: match.enabled === true }))
          }
          markPending(directory)
          notify(t(next ? 'action.enableRestart' : 'action.disableRestart', { name: skill.name }))
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          setEnabled((current) => ({ ...current, [key]: !next }))
          notify(t('action.toggleFailed', { name: skill.name, reason }))
        }
      }, [markPending, notify])

      /**
       * Install a skill for real: ask the Host to download and write it.
       *
       * Nothing is recorded locally until the Host reports success, so the UI can
       * never claim a skill is installed when the bytes did not land. A failure
       * is surfaced with the Host's own reason (network, size ceiling, missing
       * `SKILL.md`, checksum mismatch) instead of a generic error.
       *
       * Reinstalling over an existing skill is the same call, and the Host replaces the
       * directory in one step — so passing `version` is how the version list steps back to
       * an older release. The version recorded is the one the Host reports, which is the
       * release it actually wrote.
       *
       * @param {object} skill - Normalised skill from the catalog.
       * @param {string} [version] - Release to install; latest when omitted.
       * @returns {Promise<void>} Resolves once the attempt has been reported.
       */
      const install = React.useCallback(async (skill, version = '') => {
        seen.current.set(skill.id, skill)
        if (installBusy.current) return
        installBusy.current = true
        setInstallState({ kind: 'installing', id: skill.id, name: skill.name })
        notify(t(version === '' ? 'action.installingNamed' : 'action.installingVersion', { name: skill.name, version }))
        try {
          const body = await apiPost('install', {
            slug: skill.slug,
            namespace: skill.handle,
            name: skill.name,
            version: version === '' ? skill.version : version,
          })
          const result = body?.install
          if (result === undefined || typeof result.directory !== 'string') {
            throw new Error(t('action.noInstallResult'))
          }
          const installedVersion = result.version || (version === '' ? skill.version : version)
          setInstalled((current) => {
            const directoryName = String(result.directory).split(/[\\/]/).pop()
            const row = {
              id: skill.id,
              installedAt: Date.now(),
              version: installedVersion,
              directory: result.directory,
              directoryName,
              registeredAs: result.name,
              handle: skill.handle,
              slug: skill.slug,
              origin: 'market',
              files: result.files,
              bytes: result.bytes,
            }
            // Replacing an installed version keeps its row rather than adding a second one.
            const existing = current.findIndex((entry) => entry.id === skill.id)
            if (existing < 0) return [row, ...current]
            const next = [...current]
            next[existing] = row
            return next
          })
          // A reinstall over a parked skill stays parked, so the enable switch must follow
          // the Host's answer rather than being forced on. Claiming it is enabled while the
          // files sit in the disabled store would make the switch lie about the disk.
          const becameEnabled = result.enabled !== false
          // Keyed by directory name, like every other write to this map: an id key used to be
          // written here and read by directory elsewhere, so the two never met.
          const installedKey = String(result.directory).split(/[\\/]/).pop()
          setEnabled((current) => ({ ...current, [installedKey]: becameEnabled }))
          setInstallState({ kind: 'idle' })
          markPending(String(result.directory).split(/[\\/]/).pop())
          notify(becameEnabled
            ? t('action.installedDetail', { name: skill.name, version: installedVersion, files: result.files, directory: result.directory })
            : t('action.updatedParked', { name: skill.name, version: installedVersion, files: result.files }))
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          setInstallState({ kind: 'failed', id: skill.id, name: skill.name, reason })
          notify(t('action.installFailed', { name: skill.name, reason }))
        } finally {
          // Released last, so a second click cannot slip in before React has
          // re-rendered the button out of its busy state.
          installBusy.current = false
        }
      }, [notify])

      /**
       * Find the installed row behind a skill, by identity rather than by id alone.
       *
       * Ids are `@handle/slug`, and the same skill can appear under different publishers —
       * a favorite may carry the record it was saved from while the install came from
       * another. The directory name `<handle>--<slug>` is what the filesystem actually
       * has, so it is the reliable key; the id is only a fallback for rows with no
       * directory of their own.
       *
       * Defined before every consumer: these are `const` arrow functions in one component
       * body, so a later definition is a temporal dead zone at render, not a hoisted call.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle`, `slug`.
       * @returns {object | undefined} The installed ledger entry.
       */
      const installedEntryFor = React.useCallback((skill) => {
        const handle = String(skill?.handle ?? '')
        const slug = String(skill?.slug ?? '')
        const directoryName = handle !== '' && slug !== '' ? `${handle}--${slug}` : ''
        /**
         * Compare directory names loosely, because the two sides spell the namespace differently.
         *
         * A catalog skill carries the **upstream** handle (`user_814dbe54`), while a ledger row's
         * `directoryName` is what the filesystem has (`user-814dbe54` — `safeSegment` rewrites `_` to
         * `-`). Exact equality therefore never matched for a namespace containing an underscore, which
         * is common, and every consumer of this lookup — the update affordance, the 已安装 button state,
         * the drawer's install check — silently reported "not installed".
         *
         * Folding `_` and `-` together is safe here: a directory name never contains `_`, so nothing
         * distinct is being conflated.
         */
        const canonical = (value) => String(value ?? '').replace(/_/g, '-')
        return installed.find((row) => (
          (directoryName !== '' && canonical(row.directoryName) === canonical(directoryName))
          || row.id === skill?.id
        ))
      }, [installed])

      /**
       * Perform a confirmed uninstall: delete the directory, then drop the ledger row.
       *
       * Split from the asking so the same work can be reached from the dialog's confirm button.
       * Identity, not id: a favorite saved under one publisher must still uninstall the copy that
       * is actually on disk. The Host resolves the root from the directory name, so removing a
       * parked skill works the same as removing a live one.
       *
       * @param {object} skill - Skill or ledger row carrying `id` and `name`.
       * @returns {Promise<void>} Resolves once the attempt has been reported.
       */
      /**
       * Perform a confirmed uninstall: delete the directory, then drop the ledger row.
       *
       * Split from the asking so the same work can be reached from the dialog's confirm button.
       * Identity, not id: a favorite saved under one publisher must still uninstall the copy that
       * is actually on disk. The Host resolves the root from the directory name, so removing a
       * parked skill works the same as removing a live one.
       *
       * Removal needs the restart advice as much as an install does, and for the same reason: a
       * conversation keeps the skill catalog and tool set its agent was built with, so the skill keeps
       * loading until the process restarts even though its files are gone. Without this the panel
       * reported a clean removal and the skill carried on working — the user's only clue that something
       * had not taken effect.
       *
       * @param {object} skill - Skill or ledger row carrying `id` and `name`.
       * @returns {Promise<void>} Resolves once the attempt has been reported.
       */
      const uninstallConfirmed = React.useCallback(async (skill) => {
        const entry = installedEntryFor(skill)
        const directory = entry?.directory
        const directoryName = String(directory ?? entry?.directoryName ?? '').split(/[\\/]/).pop()
        let answer
        if (directory !== undefined) {
          try {
            answer = await apiPost('uninstall', { name: directoryName })
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            notify(t('action.uninstallFailed', { name: skill.name, reason }))
            return
          }
        }
        const rowId = entry?.id ?? skill.id
        setInstalled((current) => current.filter((row) => row.id !== rowId))
        if (selected === rowId) setSelected(null)
        // Marked even though the row is gone: the banner counts changes made this session, and the
        // skill is still live in whatever conversation is already running.
        markPending(directoryName)
        notify(t(answer?.uninstall?.wasDisabled === true ? 'action.removeFromDisabled' : 'action.uninstalledRestart', { name: skill.name }))
      }, [installedEntryFor, markPending, notify, selected])

      /**
       * Ask before removing a skill, then do it.
       *
       * The question is asked in the panel's own dialog rather than `window.confirm`: the native
       * sheet cannot be styled, ignores the surrounding UI, and on the desktop shell looks like a
       * browser warning rather than part of the product. The dialog also names what is about to
       * happen — which directory, and how many files — so the answer is informed.
       *
       * @param {object} skill - Skill or ledger row carrying `id` and `name`.
       * @returns {void}
       */
      const uninstall = React.useCallback((skill) => {
        const entry = installedEntryFor(skill)
        setConfirmRequest({
          title: t('action.uninstalling', { name: skill.name }),
          body: t('action.uninstallBody'),
          detail: entry?.directory === undefined
            ? ''
            : `${String(entry.directory).split(/[\\/]/).pop()}${entry.files ? `（${String(entry.files)} 个文件）` : ''}`,
          confirmLabel: t('action.uninstall'),
          danger: true,
          onConfirm: () => { void uninstallConfirmed(skill) },
        })
      }, [installedEntryFor, uninstallConfirmed])

      const toggleSave = React.useCallback((skill) => {
        setSaved((current) => {
          const has = current.includes(skill.id)
          notify(t(has ? 'action.unsavedNamed' : 'action.savedNamed', { name: skill.name }))
          return has ? current.filter((id) => id !== skill.id) : [skill.id, ...current]
        })
        // Keep the record alongside the id so the favorite survives a reload; drop
        // it on unsave so unbookmarked skills stop occupying storage.
        setSavedSkills((current) => {
          if (current[skill.id] !== undefined) {
            const { [skill.id]: removed, ...rest } = current
            return rest
          }
          return { ...current, [skill.id]: skill }
        })
      }, [notify])

      /** Open a skill's detail drawer, preferring fresh upstream data. */
      /**
       * Whether a skill has no upstream record, so there is nothing for the detail drawer to describe.
       *
       * Three ways a skill gets here, and all of them matter:
       *
       *   `local`  — imported through the panel, so its id is `@local/…`
       *   `manual` — a directory the user placed in a root themselves
       *
       * The origin is the reliable signal when the caller has it: a hand-placed directory is named by
       * the user, so its id looks exactly like a published one (`@libai/1.0.5`) and every detail
       * request for it would be a 404 dressed up as a drawer. The id and handle are checked as a
       * fallback for callers holding only a normalised skill, whose origin was not carried along.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle` and/or `origin`.
       * @param {string} [origin] - The row's origin, when the caller knows it.
       * @returns {boolean} True when the skill exists only on this machine.
       */
      const isLocalSkill = React.useCallback((skill, origin) => {
        const known = String(origin ?? skill?.origin ?? '')
        if (known !== '') return known !== 'market'
        return String(skill?.id ?? '').startsWith('@local/') || String(skill?.handle ?? '') === 'local'
      }, [])

      /**
       * Open the detail drawer for a skill.
       *
       * Refuses a skill with no upstream record rather than showing an empty drawer: every tab in it
       * describes SkillHub, and for a local skill all of it would be empty or invented. Such skills
       * are still listed and still toggleable — only the detail view is withheld.
       *
       * @param {object} skill - Skill or row to describe.
       * @param {string} [origin] - The row's origin, when the caller knows it.
       * @returns {void}
       */
      const openDetail = React.useCallback((skill, origin) => {
        if (isLocalSkill(skill, origin)) return
        seen.current.set(skill.id, skill)
        setSelected(skill.id)
      }, [isLocalSkill])

      /**
       * Fetch the per-skill detail bundle the list endpoint cannot provide.
       *
       * Three upstream resources, one round trip each: the record itself (which carries
       * `overviewMd` and the latest version), the full version list, and the file
       * listing. They are fetched together because the drawer shows all three and a
       * partial answer would render misleading sections — an empty version list reads
       * as "no history" rather than "not loaded yet".
       *
       * A skill with no `@handle/slug` (a local import) has no upstream record, so it is
       * marked as such and the drawer hides those sections instead of erroring.
       *
       * @param {object} skill - Normalised skill, or a row carrying handle/slug.
       * @returns {Promise<void>} Resolves once the attempt has been recorded.
       */
      const loadDetail = React.useCallback(async (skill, options = {}) => {
        const id = String(skill?.id ?? '')
        const slug = String(skill?.slug ?? '')
        const namespace = String(skill?.handle ?? '')
        if (id === '') return
        if (slug === '' || namespace === '' || id.startsWith('local-')) {
          setDetails((current) => ({ ...current, [id]: { kind: 'unavailable' } }))
          return
        }
        setDetails((current) => ({ ...current, [id]: { kind: 'loading' } }))
        const query = { slug, namespace }
        try {
          const [detail, versions, files] = await Promise.all([
            api('skill-detail', query),
            api('skill-versions', query).catch(() => null),
            api('skill-files', query).catch(() => null),
          ])
          const fileList = Array.isArray(files?.files) ? files.files : []
          setDetails((current) => ({
            ...current,
            [id]: {
              kind: 'ready',
              summary: String(detail?.skill?.summary_zh || detail?.skill?.summary || ''),
              latestVersion: String(detail?.latestVersion?.version ?? ''),
              latestChangelog: String(detail?.latestVersion?.changelog ?? ''),
              latestAt: Number(detail?.latestVersion?.createdAt ?? 0),
              sourceUrl: publicSkillUrl(detail?.skill?.sourceUrl, namespace, slug),
              versions: Array.isArray(versions?.versions) ? versions.versions : [],
              files: fileList,
              filesVersion: String(files?.version ?? ''),
            },
          }))
        } catch (error) {
          setDetails((current) => ({
            ...current,
            [id]: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) },
          }))
          if (options.quiet !== true) notify(t('action.detailFailed', { reason: error instanceof Error ? error.message : String(error) }))
        }
      }, [notify])

      /**
       * Load the scan verdict for one skill, at most once.
       *
       * Called while rendering, so it has to be idempotent and must not re-request: the in-flight set
       * is checked first, then the cache. A failure is remembered too — a card that silently retried
       * on every render would hammer the Host for a verdict that is not there.
       *
       * @param {object} skill - Skill carrying `handle`/`slug` and `id`.
       * @returns {void}
       */
      const loadSecurity = React.useCallback((skill) => {
        const id = String(skill?.id ?? '')
        const slug = String(skill?.slug ?? '')
        const namespace = String(skill?.handle ?? '')
        if (id === '' || slug === '' || namespace === '' || id.startsWith('@local/')) return
        if (securityRequests.current.has(id)) return
        securityRequests.current.add(id)
        setSecurity((current) => (current[id] === undefined ? { ...current, [id]: { kind: 'loading' } } : current))
        api('skill-security', { slug, namespace })
          .then((body) => {
            setSecurity((current) => ({
              ...current,
              [id]: {
                kind: 'ready',
                verdict: String(body?.verdict ?? 'unknown'),
                vendors: Array.isArray(body?.vendors) ? body.vendors : [],
              },
            }))
          })
          .catch((error) => {
            setSecurity((current) => ({
              ...current,
              [id]: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) },
            }))
          })
      }, [])

      /**
       * The scan verdict for a skill, for rendering.
       * @param {object} skill - Skill or row carrying `id`.
       * @returns {{kind: string, verdict?: string, vendors?: Array<object>}} Cache entry, or a pending marker.
       */
      const securityFor = React.useCallback(
        (skill) => security[String(skill?.id ?? '')] ?? { kind: 'idle' },
        [security],
      )

      /**
       * Cache key for one file of one skill.
       *
       * The skill is part of the key, and that is the point of it: a path and a version are shared by
       * every skill — `SKILL.md` at the latest release is the common case — so a key without the skill
       * made the second skill's 文件 tab a cache hit on the first skill's text. Keyed by `id`, like the
       * detail and scan caches, because that is the identity the drawer is already showing.
       *
       * @param {object} skill - Skill carrying `id`.
       * @param {string} filePath - Path inside the bundle.
       * @param {string} version - Release the file was read from; '' for latest.
       * @returns {string} Cache key.
       */
      function previewKey(skill, filePath, version) {
        return `${String(skill?.id ?? '')}|${version}:${filePath}`
      }

      /**
       * Load one file's text for the drawer's preview.
       *
       * Keyed by skill, version and path, and skipped when already fetched, so flipping between
       * files and back does not refetch. A file that cannot be read leaves an error in the
       * cache entry and the preview says so rather than showing an empty pane.
       *
       * @param {object} skill - Skill carrying `id`/`handle`/`slug`.
       * @param {string} filePath - Path inside the bundle.
       * @param {string} version - Release to read; '' for latest.
       * @returns {Promise<void>} Resolves once the attempt has been recorded.
       */
      const loadPreview = React.useCallback(async (skill, filePath, version) => {
        const key = previewKey(skill, filePath, version)
        const query = {
          slug: String(skill?.slug ?? ''),
          namespace: String(skill?.handle ?? ''),
          path: filePath,
        }
        if (query.slug === '' || query.namespace === '') {
          setPreviews((current) => ({ ...current, [key]: { kind: 'failed', reason: t('files.noSource') } }))
          return
        }
        if (version !== '') query.version = version
        setPreviews((current) => ({ ...current, [key]: { kind: 'loading' } }))
        try {
          const body = await api('skill-file', query)
          setPreviews((current) => ({
            ...current,
            [key]: {
              kind: 'ready',
              text: typeof body?.text === 'string' ? body.text : '',
              truncated: body?.truncated === true,
              bytes: Number(body?.bytes ?? 0),
            },
          }))
        } catch (error) {
          setPreviews((current) => ({
            ...current,
            [key]: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) },
          }))
        }
      }, [])

      /** Open the preview for one file from the tree, fetching it when not already held. */
      const openPreview = React.useCallback((skill, filePath, version = '') => {
        // A file picked out of the tree is a new read, so the link trail starts over from here.
        setPreviewTrail([])
        setPreview({ path: filePath, version })
        const key = previewKey(skill, filePath, version)
        if (previews[key] !== undefined) return
        void loadPreview(skill, filePath, version)
      }, [previews, loadPreview])

      /**
       * Follow a document's link to a neighbouring file, remembering where the reader was.
       *
       * Separate from `openPreview` because that one resets the trail; this one grows it, which is what
       * makes the dialog's back control meaningful.
       */
      const followPreview = React.useCallback((skill, filePath, version = '') => {
        if (preview !== null) setPreviewTrail((trail) => [...trail, preview])
        setPreview({ path: filePath, version })
        const key = previewKey(skill, filePath, version)
        if (previews[key] !== undefined) return
        void loadPreview(skill, filePath, version)
      }, [preview, previews, loadPreview])

      /** Step back to the file the reader came from, reloading it only if the cache lost it. */
      const backPreview = React.useCallback((skill) => {
        if (previewTrail.length === 0) return
        const previous = previewTrail[previewTrail.length - 1]
        setPreviewTrail((trail) => trail.slice(0, -1))
        setPreview(previous)
        const key = previewKey(skill, previous.path, previous.version)
        if (previews[key] === undefined) void loadPreview(skill, previous.path, previous.version)
      }, [previewTrail, previews, loadPreview])

      /**
       * Install one named release, replacing whatever version is on disk.
       *
       * Installing a release that is not the latest *is* the point — stepping back is why the
       * version list offers it. Only the destructive direction asks first: confirming a forward
       * update would train people to dismiss the prompt, which is exactly when a downgrade slips
       * through.
       */
      const installVersion = React.useCallback((skill, version) => {
        if (version === '') return
        const entry = installedEntryFor(skill)
        const currentVersion = String(entry?.version ?? '')
        if (entry !== undefined && currentVersion !== '' && compareVersions(version, currentVersion) < 0) {
          setConfirmRequest({
            title: t('action.downgrade', { name: skill.name, version }),
            body: t('action.downgradeBody', { current: currentVersion }),
            detail: '',
            confirmLabel: t('action.downgradeConfirm'),
            danger: true,
            onConfirm: () => { void install(skill, version) },
          })
          return
        }
        void install(skill, version)
      }, [install, installedEntryFor])

      /**
       * The latest version this panel knows for one skill, or '' when unknown.
       *
       * Two sources, cheapest first: the installed ledger carries what `/installed`
       * reported, and the detail cache carries what an opened drawer learned. Neither is
       * invented — an unknown latest version simply offers no update.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle`, `slug`.
       * @returns {string} Version string, or ''.
       */
      const latestFor = React.useCallback((skill) => {
        const fromLedger = installedEntryFor(skill)?.latestVersion
        if (typeof fromLedger === 'string' && fromLedger !== '') return fromLedger
        const detail = details[String(skill?.id ?? '')]
        return detail?.kind === 'ready' ? String(detail.latestVersion ?? '') : ''
      }, [installedEntryFor, details])

      /**
       * Whether one skill can be updated, and to what.
       *
       * Requires all three facts: the skill is installed, its local version is known, and
       * upstream publishes a different one. Any missing piece means no update is offered,
       * which is the honest answer rather than a guess.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle`, `slug`.
       * @returns {{available: boolean, local: string, latest: string}} State.
       */
      const updateStateFor = React.useCallback((skill) => {
        const entry = installedEntryFor(skill)
        const local = String(entry?.version ?? '')
        const latest = latestFor(skill)
        return {
          available: entry !== undefined && local !== '' && latest !== '' && local !== latest,
          local,
          latest,
        }
      }, [installedEntryFor, latestFor])

      /**
       * Load a skill's detail the first time its drawer is opened.
       *
       * Guarded on the absence of a cache entry rather than on `selected` alone: `details`
       * is a dependency, so an unguarded fetch would loop. A cached `failed` entry is also
       * left alone — reopening the drawer is not a retry, and the drawer offers one.
       */
      React.useEffect(() => {
        if (selected === null) return
        const skill = seen.current.get(selected)
        if (skill === undefined) return
        if (details[selected] !== undefined) return
        void loadDetail(skill, { quiet: true })
      }, [selected, details, loadDetail])

      /**
       * Build a directory tree from the flat file list SkillHub publishes.
       *
       * The endpoint returns `path` strings with `/` separators and no hierarchy, so the
       * tree is derived here. Directories sort before files and both sort by name, which
       * is what makes the listing readable at a glance.
       *
       * @param {Array<{path: string, size: number, sha256?: string}>} files - Flat listing.
       * @returns {{nodes: Array<object>, files: number, bytes: number, total: number}} Tree and totals.
       */
      const buildFileTree = React.useCallback((files) => {
        const root = { dirs: new Map(), files: [] }
        for (const entry of files) {
          const path = String(entry?.path ?? '')
          if (path === '') continue
          const segments = path.split('/').filter((segment) => segment !== '' && segment !== '.')
          if (segments.length === 0) continue
          let node = root
          for (const segment of segments.slice(0, -1)) {
            if (node.dirs.has(segment) === false) node.dirs.set(segment, { dirs: new Map(), files: [] })
            node = node.dirs.get(segment)
          }
          node.files.push({ name: segments[segments.length - 1], size: Number(entry?.size ?? 0) })
        }

        /** Recursively turn one node into sorted render data. */
        const render = (node, prefix) => {
          const dirs = [...node.dirs.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, child]) => {
              const children = render(child, `${prefix}${name}/`)
              return {
                kind: 'dir',
                name,
                path: `${prefix}${name}`,
                children: children.nodes,
                files: children.files,
                bytes: children.bytes,
              }
            })
          const leaves = [...node.files]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((file) => ({ kind: 'file', name: file.name, size: file.size, path: `${prefix}${file.name}` }))
          return {
            nodes: [...dirs, ...leaves],
            files: dirs.reduce((total, dir) => total + dir.files, 0) + leaves.length,
            bytes: dirs.reduce((total, dir) => total + dir.bytes, 0)
              + leaves.reduce((total, file) => total + file.size, 0),
          }
        }

        const tree = render(root, '')
        return { nodes: tree.nodes, files: tree.files, bytes: tree.bytes, total: files.length }
      }, [])

      /**
       * Import local skill packages for real: send the bytes, let the Host unpack them.
       *
       * The file used to be read for its name and size and then thrown away, so the panel
       * listed a skill that existed nowhere — not on disk, not in the registry, not callable.
       * Now the archive is uploaded, unpacked into the shared skill root by the Host, and picked
       * up by the next scan, which is what makes it an ordinary local skill.
       *
       * A `.zip` goes as it is; a folder is turned into one first, on this side, so both arrive
       * through the same endpoint and the Host has one format to validate.
       *
       * Files are sent one at a time and failures are reported per file, so one bad package does
       * not stop the rest and the reason names the file it belongs to.
       */
      const addLocalFiles = React.useCallback(async (files) => {
        if (files === null || files === undefined || files.length === 0) return
        const chosen = Array.from(files)
        setImportProgress({ done: 0, total: chosen.length, name: String(chosen[0]?.name ?? '') })
        let done = 0
        const failures = []
        const names = []
        for (const file of chosen) {
          try {
            // A directory carries no name of its own; `relativePath` is the folder the user chose.
            const label = String(file.name ?? '') || String(file.webkitRelativePath ?? '').split('/')[0] || 'skill'
            const body = await apiUpload('import', label, file)
            const result = body?.import
            if (result === undefined || typeof result.directory !== 'string') {
              // Naming what was actually received makes a stub or a shape mismatch debuggable
              // instead of reading as "the Host failed".
              throw new Error(t('import.noResultDetail', { body: JSON.stringify(body)?.slice(0, 160) ?? 'null' }))
            }
            names.push(String(result.name ?? label))
          } catch (error) {
            // One key for the whole line: a filename joined to a reason by a full-width colon is a
            // sentence, and English needs a different separator.
            failures.push(t('import.fileFailed', { name: String(file.name ?? ''), reason: error instanceof Error ? error.message : String(error) }))
          }
          done += 1
          setImportProgress({ done, total: chosen.length, name: String(file.name ?? '') })
        }
        setImportProgress(null)
        // The scan is the ledger: an imported skill is whatever the Host now finds on disk, so
        // asking it again is what makes the new row appear — and it cannot disagree with disk.
        setReloadNonce((current) => current + 1)
        if (failures.length === 0) {
          notify(names.length === 1
            ? t('import.doneOne', { name: names[0] })
            : t('import.doneMany', { count: names.length }))
        } else if (names.length === 0) {
          notify(t('import.failed', { reason: failures[0] }))
        } else {
          notify(t('import.doneMixed', { ok: names.length, failed: failures.length, reason: failures[0] }))
        }
      }, [notify])

      /**
       * Remove a locally imported skill from disk.
       *
       * Routed through the same uninstall as an installed skill, because it *is* the same
       * operation: the directory is the record, so deleting the ledger row without deleting the
       * directory would leave the skill on disk and back in the list after the next scan.
       */
      const removeLocal = React.useCallback(async (row) => {
        await uninstall({ id: row.id, name: row.name, handle: row.handle, slug: row.slug })
      }, [uninstall])

      /** Switch the shell to this panel and reset the scroll position. */
      const goToView = React.useCallback((nextView) => {
        setView(nextView)
        if (contentRef.current !== null) contentRef.current.scrollTop = 0
      }, [])

      const pickFiles = React.useCallback(() => { fileRef.current?.click() }, [])

      /** The header action: open the import view, or the picker when already there. */
      const onImportAction = React.useCallback(() => {
        if (view === 'import') pickFiles()
        else goToView('import')
      }, [view, pickFiles, goToView])

      /* ── derived lists ───────────────────────────────────────────────── */

      const visible = React.useMemo(() => {
        const needle = debouncedQuery.trim().toLowerCase()
        if (needle === '') return catalog.skills
        return catalog.skills.filter((skill) => (
          (skill.name + ' ' + skill.publisher + ' ' + skill.description + ' ' + skill.tags.join(' ') + ' ' + skill.canonical)
            .toLowerCase()
            .includes(needle)
        ))
      }, [catalog.skills, debouncedQuery])

      /**
       * Request scan verdicts for the cards on screen, a few at a time.
       *
       * Declared *after* `visible`: these are `const` bindings in one function body, so reading
       * `visible` from an effect above its declaration would be a temporal dead zone at render.
       *
       * A page holds 60 cards and each verdict is its own request, so firing them all at once would
       * open 60 sockets to the Host on every page load. This walks the list through a small window
       * instead — the cards appear immediately and their badges fill in as answers arrive. Only the
       * rows actually on screen are asked about, so filtering the list does not queue work for cards
       * nobody is looking at.
       *
       * The re-run is harmless by construction: `securityRequests` holds every id already asked
       * about, so a second pass over the same list finds nothing to do and returns without touching
       * the state — no loop.
       *
       * @returns {void}
       */
      React.useEffect(() => {
        const queue = visible.filter((skill) => (
          skill?.id !== undefined
          && security[skill.id] === undefined
          && securityRequests.current.has(String(skill.id)) === false
          && String(skill.id).startsWith('@local/') === false
        ))
        if (queue.length === 0) return undefined
        let cancelled = false
        let cursor = 0
        const worker = () => {
          if (cancelled) return
          const next = queue[cursor]
          cursor += 1
          if (next === undefined) return
          loadSecurity(next)
          // Chained rather than awaited together: the window stays at SECURITY_CONCURRENCY.
          window.setTimeout(worker, 0)
        }
        for (let index = 0; index < SECURITY_CONCURRENCY; index += 1) worker()
        return () => { cancelled = true }
      }, [visible, security, loadSecurity])

      /**
       * Resolve one favorite to something renderable.
       *
       * Two sources only, both of which the current build writes: the in-memory
       * catalog (live upstream detail for anything this page loaded) and the
       * persisted record (which is what makes a favorite survive a reload).
       *
       * Ids saved by the build that persisted ids only resolve to nothing, and are
       * deliberately not rescued: that data is discarded rather than migrated, so
       * there is no third fallback and no background refetch here.
       *
       * `catalog` is a dependency although the body never reads it directly. The
       * lookup goes through the `seen` ref, which mutates without any state change,
       * so without this the callback identity would survive the catalog arriving and
       * every memo built on it would keep returning its first, empty answer.
       *
       * @param {string} id - Skill id.
       * @returns {object | null} Record, or null when nothing can resolve it.
       */
      const resolveSaved = React.useCallback((id) => {
        const live = findSkill(id)
        if (live !== null) return live
        return savedSkills[id] ?? null
      }, [findSkill, savedSkills, catalog])

      // `catalog` keeps this fresh for the same reason `resolveSaved` depends on it:
      // the skill detail comes from the `seen` ref, so only a catalog change tells
      // React that these rows have anything new to show.
      /**
       * Build a renderable record for an installed skill this browser never listed.
       *
       * The ledger row carries the directory name, the registered name, the version and
       * (from the Host) the publisher and slug, which is everything the row and the detail
       * drawer need to start from. Opening the drawer then fills in the real upstream
       * fields, so this record is a starting point, not a substitute.
       *
       * @param {object} entry - Installed ledger entry.
       * @returns {object} Skill-shaped record.
       */
      const skillFromInstalled = React.useCallback((entry) => {
        const directoryName = String(entry.directoryName
          ?? String(entry.directory ?? '').split(/[\\/]/).pop())
        const handle = String(entry.handle ?? directoryName.split('--')[0] ?? '')
        const slug = String(entry.slug ?? (directoryName.includes('--') ? directoryName.slice(directoryName.indexOf('--') + 2) : directoryName))
        return {
          id: entry.id,
          slug,
          canonical: handle === '' ? slug : `@${handle}/${slug}`,
          name: entry.registeredAs || directoryName || String(entry.id),
          publisher: handle || t('misc.localMachine'),
          handle,
          official: false,
          description: t('overview.installedHint'),
          version: String(entry.version ?? ''),
          installs: 0,
          stars: 0,
          score: 0,
          rating: '—',
          updatedAt: 0,
          updated: t('misc.unknown'),
          createdAt: Number(entry.installedAt ?? 0),
          iconUrl: '',
          homepage: '',
          category: '',
          categoryName: t('overview.unknownCategory'),
          source: 'local',
          tags: [],
          requiresApiKey: false,
          serviceized: false,
        }
      }, [])

      const installedRows = React.useMemo(() => installed.map((entry) => ({
        entry,
        skill: findSkill(entry.id) ?? skillFromInstalled(entry),
      })), [installed, findSkill, skillFromInstalled, catalog])

      const savedRows = React.useMemo(() => saved
        .map((id) => ({ id, skill: resolveSaved(id) }))
        .filter((row) => row.skill !== null), [saved, resolveSaved])

      /**
       * Drop favorite ids that cannot be resolved, once the catalog has loaded.
       *
       * Orphaned ids come from the build that persisted ids without records, and the
       * decision here is to discard that data rather than migrate it — so instead of
       * leaving dead entries in storage that will never render, they are pruned. The
       * `status` guard matters: pruning before the first catalog page lands would
       * delete perfectly good favorites that simply have not been fetched yet.
       */
      React.useEffect(() => {
        if (status === 'loading') return
        const orphans = saved.filter((id) => resolveSaved(id) === null)
        if (orphans.length === 0) return
        const dropped = new Set(orphans)
        setSaved((current) => current.filter((id) => dropped.has(id) === false))
        setSavedSkills((current) => {
          const next = { ...current }
          for (const id of orphans) delete next[id]
          return next
        })
        notify(t('error.prunedFavorites', { count: orphans.length }))
      }, [status, saved, resolveSaved, notify])

      /**
       * Per-category totals from the Host.
       *
       * These are whole-category totals, not the size of the loaded page: the chip
       * row must name every category whatever is currently filtered or searched.
       * Deriving them from `catalog.skills` was the bug — filtering to one category
       * left the other chips with no count and the row collapsed to just that chip.
       */
      const [categoryCounts, setCategoryCounts] = React.useState({})

      /**
       * Resolve a category label from the live vocabulary, falling back to a
       * normalised upstream key when the list has not arrived yet.
       * @param {string} key - Category key.
       * @returns {string} Display label.
       */
      const categoryLabel = React.useCallback((key) => {
        if (key === '' || key === undefined || key === null) return t('overview.unknownCategory')
        const upstream = categories.find((entry) => entry.key === key)?.name
        // Upstream sends a Chinese display name; the dictionary can override it per language.
        return translatedCategory(key, upstream ?? key)
      }, [categories])

      /* ── views ───────────────────────────────────────────────────────── */

      /**
       * Fixed head of the 发现 view: title, sort control and the category
       * chips. It sits outside the scroll region, so the filters and the sort
       * order stay reachable however far the card list has been scrolled.
       * @returns {object} Element.
       */
      function marketHead() {
        return h(React.Fragment, null,
          h('div', { className: 'sm-page-head' },
            h('div', null,
              h('p', { className: 'sm-eyebrow' }, t('discover.eyebrow')),
              h('h1', { className: 'sm-page-title' }, t('discover.title')),
              h('p', { className: 'sm-page-sub' },
                t('discover.subtitle'))),
            h('div', { className: 'sm-page-actions' },
              h('span', { className: 'sm-select-wrap' },
                h('select', {
                  value: sortBy,
                  'aria-label': t('sort.aria'),
                  onChange: (event) => setSortBy(event.target.value),
                }, SORTS.map((option) => h('option', { key: option.value, value: option.value }, t(option.label))))))),

          // Above the list it filters, and inside the fixed head — so the search stays
          // reachable while the card list scrolls, which is where someone reading results
          // actually wants it.
          h('div', { className: 'sm-search sm-search-row' },
            h(Icon, { name: 'i-search', size: 16 }),
            h('input', {
              ref: searchRef,
              type: 'search',
              value: query,
              placeholder: t('search.placeholder'),
              'aria-label': t('search.placeholder'),
              autoComplete: 'off',
              onChange: (event) => {
                setQuery(event.target.value)
                if (view !== 'market') setView('market')
              },
            })),

          h('div', { className: 'sm-chips' },
            h('button', {
              type: 'button',
              className: 'sm-chip' + (category === 'all' ? ' active' : ''),
              title: t('discover.all'),
              onClick: () => setCategory('all'),
              // The API total, not `catalog.skills.length`: that is the size of the
              // loaded page, which is what made every count in the panel look wrong.
            }, t('discover.all') + ' ', h('span', { className: 'sm-chip-n' }, catalog.total.toLocaleString('zh-CN'))),
            categories
              .map((entry) => {
                // The chip's own name is either an upstream Chinese name or a dictionary key, so both
                // resolve through the same helper. The tooltip states that the count is the category's
                // total, not the number currently listed.
                const label = translatedCategory(entry.key, entry.name)
                const total = categoryCounts[entry.key]
                return h('button', {
                  key: entry.key,
                  type: 'button',
                  className: 'sm-chip' + (category === entry.key ? ' active' : ''),
                  title: total === undefined
                    ? label
                    : t('discover.chipTitle', { name: label, count: total }),
                  onClick: () => setCategory(entry.key),
                }, label, total === undefined
                  ? null
                  : h('span', { className: 'sm-chip-n' }, total))
              })))
      }

      /** Scrolling body of the 发现 view: failure state and the card grid. */
      function marketBody() {
        const searching = debouncedQuery.trim() !== ''
        return h(React.Fragment, null,
          status === 'error'
            ? h(EmptyState, {
              icon: 'i-help',
              title: t('error.catalog'),
              body: failure,
              error: true,
            }, h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: () => setReloadNonce((current) => current + 1),
            }, h(Icon, { name: 'i-refresh', size: 16 }), t('error.retry')))
            : null,

          status === 'loading' && catalog.skills.length === 0
            ? h('section', null,
              h('div', { className: 'sm-section-head' },
                h('h2', null, category === 'all' ? t('discover.all') : categoryLabel(category)),
                h('span', { className: 'sm-meta sm-num' }, t('status.loading'))),
              h('div', { className: 'sm-grid-cards' }, Array.from({ length: 8 }, (_, index) => h(SkeletonCard, { key: index }))))
            : null,

          status !== 'loading' || catalog.skills.length > 0
            ? h(React.Fragment, null,
              h('section', null,
                h('div', { className: 'sm-section-head' },
                  h('h2', null, category === 'all' ? t('discover.all') : categoryLabel(category)),
                  h('span', { className: 'sm-meta sm-num' },
                    t('discover.total', { total: catalog.total.toLocaleString() })
                    + (searching || category !== 'all'
                      ? t('discover.pageOf', { shown: visible.length.toLocaleString() })
                      : ''))),
                visible.length > 0
                  ? h(React.Fragment, null,
                    h('div', { className: 'sm-grid-cards', 'data-count': visible.length }, visible.map((skill) => h(SkillCard, {
                      key: skill.id,
                      skill,
                      installed: installedIds.has(skill.id),
                      saved: savedIds.has(skill.id),
                      update: updateStateFor(skill),
                      safety: securityFor(skill).verdict ?? 'unknown',
                      open: selected === skill.id,
                      installing: installState.kind === 'installing' && installState.id === skill.id,
                      installError: installState.kind === 'failed' && installState.id === skill.id
                        ? installState.reason
                        : null,
                      onOpen: () => openDetail(skill),
                      onInstall: () => install(skill),
                      onToggleSave: () => toggleSave(skill),
                    }))),
                    // Lazy-load footer: the sentinel is what the observer watches, and
                    // the button is the same action for profiles without an observer
                    // (jsdom, or an environment that blocks it). Saying how many rows
                    // are loaded keeps the state legible while scrolling.
                    h('div', { className: 'sm-loadmore', ref: sentinelRef },
                      hasMore
                        ? h(React.Fragment, null,
                          h('button', {
                            type: 'button',
                            className: 'sm-btn sm-btn-secondary',
                            disabled: loadingMore,
                            onClick: () => { void loadMore() },
                          }, h(Icon, { name: 'i-download', size: 15 }),
                          t(loadingMore ? 'status.loading' : 'card.loadMore')),
                          h('span', { className: 'sm-meta sm-num' },
                            t('card.showing', {
                              shown: visible.length.toLocaleString(),
                              total: catalog.total.toLocaleString(),
                            })))
                        : h('span', { className: 'sm-meta sm-num' },
                          t('card.showingAll', { total: visible.length.toLocaleString() }))))
                  : h(EmptyState, {
                    icon: 'i-search',
                    title: t('empty.noMatch'),
                    body: t('empty.noMatchBody'),
                  })))
            : null)
      }

      /**
       * Fixed head of the 已安装 view: the title and the sync action.
       * @returns {object} Element.
       */
      function installedHead() {
        return h('div', { className: 'sm-page-head' },
          h('div', null,
            h('p', { className: 'sm-eyebrow' }, t('installed.eyebrow')),
            h('h1', { className: 'sm-page-title' }, t('view.installed')),
            h('p', { className: 'sm-page-sub' },
              t('installed.subtitle', { count: installed.length }))))
      }

      /**
       * Scrolling body of the 已安装 view: restart advice and library rows.
       *
       * There is no "sync details" here any more. Detail comes from SkillHub on demand —
       * the drawer fetches it per skill — and the Host's `/installed` answer supplies the
       * publisher and slug, so a row for a skill this browser never listed can still name
       * itself and open its detail. The banner and button existed only to paper over that
       * gap, and with the gap closed they can no longer become true.
       */
      function installedBody() {
        return h(React.Fragment, null,
          pendingRestart.size > 0
            ? h('div', { className: 'sm-restart-banner' },
              h('span', { className: 'sm-rb-ic' }, h(Icon, { name: 'i-refresh', size: 18 })),
              h('div', { className: 'sm-rb-text' },
                h('strong', null, t('restart.bannerTitle', { count: pendingRestart.size })),
                // Deliberately one line. The panel cannot restart the process, and
                // anything longer invites the user to read a promise into a change
                // whose visibility depends on the conversation the agent was built
                // with. Say what is true and stop.
                h('p', null, t('restart.effect'))),
              h('div', { className: 'sm-rb-actions' },
                h('button', {
                  type: 'button',
                  className: 'sm-btn sm-btn-ghost sm-btn-sm',
                  title: t('restart.dismissTitle'),
                  onClick: () => {
                    setPendingRestart(new Set())
                    writePending(new Set())
                  },
                }, t('restart.dismiss'))))
            : null,

          installed.length === 0
            ? h(EmptyState, {
              icon: 'i-download',
              title: t('empty.noInstalled'),
              body: t('empty.noInstalledBody'),
            }, h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: () => goToView('market'),
            }, t('empty.goDiscover')))
            : h('div', { className: 'sm-list' }, installedRows.map(({ entry, skill }) => {
              const name = skill?.name ?? entry.id
              return h('div', { className: 'sm-list-row', key: entry.id },
                h(SkillIcon, { skill: skill ?? { category: '', iconUrl: '' } }),
                h('div', { className: 'sm-row-main' },
                  h('div', { className: 'sm-name-row' },
                    h('h3', null, name),
                    skill?.official ? h('span', { className: 'sm-verified' }, h(Verified, null)) : null,
                    isEnabled(entry) ? null : h('span', { className: 'sm-badge plain' }, t('installed.disabled'))),
                  h('div', { className: 'sm-row-sub' },
                    h('span', { className: 'sm-num' }, 'v' + (entry.version || skill?.version || '—')),
                    h('span', { className: 'sm-sep' }, '·'),
                    // A locally imported skill has no publisher, so the badge says where it came from
                    // instead. A hand-placed directory is named too, because only one of the two came
                    // through this panel. A `manual` skill with a catalogue record still names its
                    // publisher below, and that is deliberate: it has one.
                    entry.origin === 'local' || entry.origin === 'manual'
                      ? t(entry.origin === 'manual' ? 'import.badgeManual' : 'import.badgeLocal')
                      : (skill ? publisherOf(skill) : t('misc.machineRecord')),
                    // Shown only when there is a number. A skill with no catalog record has no download
                    // count, and `0` is what an absent count looks like — printing it states a fact
                    // nobody measured. Keyed on `local` alone: a hand-placed directory can still have a
                    // publisher record, and then its download count is real.
                    entry.origin === 'local' || Number(skill?.installs ?? 0) <= 0
                      ? null
                      : h(React.Fragment, null,
                        h('span', { className: 'sm-sep' }, '·'),
                        h('span', { className: 'sm-num sm-stat', title: t('card.downloads') },
                          h(Icon, { name: 'i-download', size: 12 }),
                          compact(skill.installs))),
                    relativeTime(entry.installedAt) === ''
                      ? null
                      : h(React.Fragment, null,
                        h('span', { className: 'sm-sep' }, '·'),
                        h('span', { className: 'sm-num' }, t('installed.installedAt', { time: relativeTime(entry.installedAt) })))),
                  entry.directory
                    ? h('div', { className: 'sm-num', style: { fontSize: '11px', color: 'var(--sm-muted)', marginTop: '3px', overflowWrap: 'anywhere' }, title: entry.directory },
                      t('installed.dirPrefix') + entry.directory,
                      entry.files ? t('installed.fileCount', { count: entry.files }) : '')
                    : null),
                h('div', { className: 'sm-row-actions' },
                  entry.directoryName !== undefined && pendingRestart.has(entry.directoryName)
                    ? h('span', { className: 'sm-badge update', title: t('installed.pendingBadgeTitle') }, t('installed.pendingBadge'))
                    : null,
                  h(Switch, {
                    checked: isEnabled(entry),
                    label: t('installed.enableNamed', { name }),
                    onChange: (checked) => setSkillEnabled(skill ?? { id: entry.id, name }, entry, checked),
                  }),
                  // Only when there is something to describe: a local import or a hand-placed directory
                  // has no upstream record, so the button is withheld rather than opening a drawer of
                  // empty tabs. The origin is what says so — the id of a hand-placed directory looks
                  // exactly like a published one.
                  skill && isLocalSkill(skill, entry.origin) === false
                    ? h('button', {
                      type: 'button',
                      className: 'sm-btn sm-btn-secondary sm-btn-sm',
                      onClick: () => openDetail(skill, entry.origin),
                    }, t('installed.details'))
                    : null,
                  // The library is where an outdated install is most visible, so the update
                  // belongs here as well as on the favorite row.
                  skill !== null && updateStateFor(skill).available
                    ? h('button', {
                      type: 'button',
                      className: 'sm-btn sm-btn-primary sm-btn-sm',
                      disabled: installState.kind === 'installing',
                      title: t('saved.versionArrow', { local: updateStateFor(skill).local, latest: updateStateFor(skill).latest }),
                      onClick: () => installVersion(skill, updateStateFor(skill).latest),
                    }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), t('saved.update'))
                    : null,
                  h('button', {
                    type: 'button',
                    className: 'sm-icon-btn',
                    'aria-label': t('action.uninstallNamed', { name }),
                    title: t('action.uninstall'),
                    onClick: () => uninstall(skill ?? { id: entry.id, name }),
                  }, h(Icon, { name: 'i-trash' }))))
            })))
      }

      /**
       * Fixed head of the 收藏 view.
       * @returns {object} Element.
       */
      function savedHead() {
        return h('div', { className: 'sm-page-head' },
          h('div', null,
            h('p', { className: 'sm-eyebrow' }, t('saved.eyebrow')),
            h('h1', { className: 'sm-page-title' }, t('view.saved')),
            h('p', { className: 'sm-page-sub' }, t('saved.subtitle', { count: saved.length }))))
      }

      /** Scrolling body of the 收藏 view: saved rows with a one-click install. */
      function savedBody() {
        return h(React.Fragment, null,
          saved.length === 0
            ? h(EmptyState, {
              icon: 'i-bookmark',
              title: t('empty.noSaved'),
              body: t('empty.noSavedBody'),
            }, h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: () => goToView('market'),
            }, t('empty.goDiscover')))
            : h('div', { className: 'sm-list' }, savedRows.map(({ skill }) => h('div', {
              className: 'sm-list-row',
              key: skill.id,
            },
              h(SkillIcon, { skill }),
              h('div', { className: 'sm-row-main' },
                h('div', { className: 'sm-name-row' },
                  h('h3', null, skill.name),
                  skill.official ? h('span', { className: 'sm-verified' }, h(Verified, null)) : null),
                h('div', { className: 'sm-row-sub' },
                  publisherOf(skill),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num sm-stat', title: t('card.downloads') },
                    h(Icon, { name: 'i-download', size: 12 }),
                    compact(skill.installs)),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num sm-stat', title: t('card.ratingTitle') },
                    h(Star, { size: 12 }),
                    skill.rating))),
              h('div', { className: 'sm-row-actions' },
                // Same rule as the library row: a skill with no upstream record has no drawer to offer.
                // Kept here too rather than relying on the guard inside openDetail, because a button
                // that does nothing when pressed is its own defect.
                isLocalSkill(skill)
                  ? null
                  : h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-secondary sm-btn-sm',
                    // The same drawer the market and library rows open; a favorite is a
                    // skill like any other, so the entries into it must not differ.
                    onClick: () => openDetail(skill),
                  }, t('installed.details')),
                updateStateFor(skill).available
                  ? h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-primary sm-btn-sm',
                    disabled: installState.kind === 'installing',
                    title: 'v' + updateStateFor(skill).local + ' → v' + updateStateFor(skill).latest,
                    onClick: () => installVersion(skill, updateStateFor(skill).latest),
                  }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), t('saved.update'))
                  : null,
                // 已安装 here follows the same identity rule as the update button: a favorite
                // saved from one publisher must still read as installed when the install came
                // from another.
                installedIds.has(skill.id) || installedEntryFor(skill) !== undefined
                  ? h('span', { className: 'sm-badge plain' }, t('card.installed'))
                  : h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-secondary sm-btn-sm',
                    onClick: () => install(skill),
                  }, h(Icon, { name: 'i-download', size: 15 }), t('card.install')),
                h('button', {
                  type: 'button',
                  className: 'sm-icon-btn',
                  'aria-label': t('card.unsave', { name: skill.name }),
                  title: t('card.unsaveShort'),
                  onClick: () => toggleSave(skill),
                }, h(Icon, { name: 'i-bookmark-check' })))))))
      }

      /**
       * Fixed head of the 本地导入 view.
       * @returns {object} Element.
       */
      function importHead() {
        return h('div', { className: 'sm-page-head' },
          h('div', null,
            h('p', { className: 'sm-eyebrow' }, t('import.eyebrow')),
            h('h1', { className: 'sm-page-title' }, t('view.import')),
            h('p', { className: 'sm-page-sub' }, t('import.subtitle'))))
      }

      /** Scrolling body of the 本地导入 view: dropzone, counters, imported rows. */
      function importBody() {
        const enabledCount = imported.filter((row) => isEnabled(row)).length
        const dropzone = h('div', {
          className: 'sm-dropzone' + (dragOver ? ' dragover' : ''),
          role: 'button',
          tabIndex: 0,
          'aria-label': t('import.dropAria'),
          onClick: pickFiles,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pickFiles() }
          },
          onDragOver: (event) => { event.preventDefault(); setDragOver(true) },
          onDragLeave: () => setDragOver(false),
          onDrop: (event) => {
            event.preventDefault()
            setDragOver(false)
            addLocalFiles(event.dataTransfer?.files)
          },
        },
          h('span', { className: 'sm-dz-ic' }, h(Icon, { name: 'i-upload', size: 22 })),
          h('h3', null, t('import.dropTitle')),
          h('p', null, t('import.dropNote')),
          // A span, not a button: the zone itself is the control, and nesting a button inside a
          // clickable element would fire the picker twice.
          h('div', { className: 'sm-dz-actions' },
            h('span', { className: 'sm-btn sm-btn-secondary sm-dz-browse' },
              h(Icon, { name: 'i-folder', size: 16 }), t('import.browse'))))

        return h(React.Fragment, null,
          dropzone,
          h('div', { className: 'sm-stat-cards' },
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('import.statImported')),
              h('div', { className: 'sm-v' }, imported.length)),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('import.statEnabled')),
              h('div', { className: 'sm-v' }, enabledCount)),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('import.statFormat')),
              h('div', { className: 'sm-v' }, '.zip'))),
          importProgress === null
            ? null
            : h('p', { className: 'sm-body-note' },
              t('import.progress', { done: importProgress.done + 1, total: importProgress.total, name: importProgress.name })),
          imported.length === 0
            ? h(EmptyState, {
              icon: 'i-upload',
              title: t('import.empty'),
              body: t('import.emptyBody'),
            })
            : h('div', { className: 'sm-list' }, imported.map((row) => h('div', {
              className: 'sm-list-row',
              key: row.id,
            },
              h(SkillIcon, { skill: { category: '', iconUrl: '' } }),
              h('div', { className: 'sm-row-main' },
                h('div', { className: 'sm-name-row' },
                  h('h3', null, row.name),
                  // Distinguishes a package this page imported from a directory the user placed in
                  // a root by hand: both are local, but only one of them came through the panel.
                  h('span', { className: 'sm-src-badge' }, h(Icon, { name: 'i-folder', size: 11 }),
                    t(row.origin === 'manual' ? 'import.badgeManual' : 'import.badgeLocal')),
                  isEnabled(row) ? null : h('span', { className: 'sm-badge plain' }, t('installed.disabled'))),
                h('div', { className: 'sm-row-sub' },
                  row.version ? h('span', { className: 'sm-num' }, 'v' + row.version) : h('span', null, t('installed.noVersion')),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num', title: row.directory }, t('installed.fileCountBare', { count: row.files ?? 0 })),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num' }, humanSize(row.bytes ?? 0)))),
              h('div', { className: 'sm-row-actions' },
                h(Switch, {
                  checked: isEnabled(row),
                  label: t('installed.enableNamed', { name: row.name }),
                  onChange: (checked) => {
                    // `setSkillEnabled(skill, entry, next)`: the skill carries the id the switch
                    // state is keyed by, the entry carries the directory to move on disk.
                    void setSkillEnabled(
                      { id: row.id, name: row.name, handle: row.handle, slug: row.slug },
                      row,
                      checked,
                    )
                  },
                }),
                h('button', {
                  type: 'button',
                  className: 'sm-icon-btn',
                  'aria-label': t('installed.removeNamed', { name: row.name }),
                  title: t('installed.remove'),
                  onClick: () => removeLocal(row),
                }, h(Icon, { name: 'i-trash' })))))))
      }

      /* ── inspector ───────────────────────────────────────────────────── */

      /**
       * Overview tab: the skill's own `SKILL.md` body, plus the list-card facts.
       *
       * `SKILL.md` is the file the harness actually loads, so this is the same text an
       * installed skill would run — shown before installing. When it cannot be read the
       * tab falls back to the published summary, and says which of the two it is showing
       * rather than passing one off as the other.
       */
      /**
       * Overview tab: the list-card facts, and the published summary when there is one.
       *
       * Deliberately does NOT inline the skill's `SKILL.md`. That body is often thousands of
       * words, and it is already readable in full — with its own directory tree and per-file
       * preview — in 文件. Summarising it here duplicated the source, pushed 关键信息 off the
       * panel, and could only ever be an approximation of a file the user can open directly.
       */
      function overviewTab(skill, detail) {
        const bullets = [
          t(skill.official ? 'overview.fromOfficial' : 'overview.fromCommunity', { canonical: skill.canonical }),
          t('card.categoryLabel', { name: skill.categoryName }),
          skill.version ? t('overview.version', { version: skill.version }) : t('overview.versionMaintained'),
          skill.requiresApiKey ? t('overview.needsKey') : t('overview.noKey'),
        ]
        const summary = detail?.kind === 'ready' ? detail.summary : ''
        return h(React.Fragment, null,
          detail?.kind === 'failed'
            ? h('p', { className: 'sm-body-note' }, t('overview.summaryFailed', { reason: detail.reason }))
            : null,
          detail?.kind === 'ready' && summary !== ''
            ? h(React.Fragment, null,
              h('h4', null, t('overview.summary')),
              h('div', { className: 'sm-prose' }, h(Prose, { source: summary })))
            : null,
          detail?.kind === 'ready' && summary === ''
            ? h(React.Fragment, null,
              h('h4', null, t('overview.summary')),
              h('div', { className: 'sm-prose' }, h(Prose, { source: skill.description || t('card.noDescription') })))
            : null,
          h('h4', null, t('overview.keyInfo')),
          h('ul', { className: 'sm-feat-list' },
            bullets.map((text) => h('li', { key: text }, h(Icon, { name: 'i-check', size: 16 }), h('span', null, text)))),
          h('h4', null, t('overview.useCases')),
          h('div', { className: 'sm-tags' },
            skill.tags.map((tag) => h('span', { key: tag, className: 'sm-tag' }, tag)),
            h('span', { className: 'sm-tag' }, skill.categoryName)))
      }

      /**
       * Files tab: the bundle's directory tree.
       *
       * Straight from `/files`, which reports exactly what an install would write — so this is also the
       * place to see what a skill would put on disk before installing it. Clicking a file no longer
       * replaces the tree here: the file opens in a dialog over the panel (`FileDialog`), which has the
       * room a 560px drawer does not, and leaves the tree in place behind it.
       *
       * @param {object} skill - Skill the drawer is showing.
       * @param {object} detail - Detail entry carrying the file list.
       * @returns {object} Element.
       */
      function filesTab(skill, detail) {
        if (detail === undefined || detail.kind === 'loading') {
          return h('p', { className: 'sm-body-note' }, t('files.loading'))
        }
        if (detail.kind === 'unavailable') {
          return h('p', { className: 'sm-body-note' }, t('files.localHasNone'))
        }
        if (detail.kind === 'failed') {
          return h('p', { className: 'sm-body-note' }, t('files.failed', { reason: detail.reason }))
        }
        const tree = buildFileTree(detail.files)

        if (tree.nodes.length === 0) {
          return h('p', { className: 'sm-body-note' }, t('files.none'))
        }
        return h(React.Fragment, null,
          h('h4', null, t('files.heading')),
          h('p', { className: 'sm-body-note' },
            t('files.treeSummaryBase', { files: tree.total, size: humanSize(tree.bytes) })
            + (detail.filesVersion !== '' ? t('files.manifestVersion', { version: detail.filesVersion }) : '')
            + t('files.treeHint')),
          h(FileTree, {
            nodes: tree.nodes,
            onOpen: (filePath) => openPreview(skill, filePath, ''),
          }))
      }

      /** Versions tab: the published history, and whether this install is behind it. */
      function versionTab(skill, detail) {
        // Same identity rule as the update button, so this tab cannot disagree with the row
        // that opened it: a favorite saved under one publisher still finds its install.
        const installedRow = installedEntryFor(skill)
        const local = String(installedRow?.version ?? '').trim()
        const latest = detail?.kind === 'ready' ? detail.latestVersion : ''
        const behind = local !== '' && latest !== '' && local !== latest
        const rows = [
          [t('versions.currentVersion'), skill.version || t('misc.notStated')],
          [t('versions.category'), skill.categoryName],
          [t('versions.source'), t(skill.source === 'official' ? 'misc.official' : 'misc.community')],
          [t('versions.identifier'), skill.canonical],
          [t('versions.firstSeen'), new Date(skill.createdAt || Date.now()).toLocaleDateString(uiLocale())],
          [t('versions.updatedAt'), t('versions.updatedAtValue', {
            date: new Date(skill.updatedAt || Date.now()).toLocaleDateString(uiLocale()),
            relative: skill.updated,
          })],
        ]
        const versions = detail?.kind === 'ready' ? detail.versions : []
        return h(React.Fragment, null,
          installedRow !== undefined
            ? h(React.Fragment, null,
              h('h4', null, t('saved.update')),
              h('div', { className: 'sm-perm' },
                h('span', { className: 'sm-perm-ic' },
                  h(Icon, { name: behind ? 'i-arrow-up-circle' : 'i-check', size: 17 })),
                h('div', { className: 'sm-perm-main' },
                  h('div', { className: 'sm-perm-title' },
                    h('strong', null, t(behind ? 'versions.newAvailable' : 'versions.upToDate')),
                    h('span', { className: 'sm-risk ' + (behind ? 'mid' : 'low') },
                      t(behind ? 'saved.updatable' : 'versions.latest'))),
                  h('div', { className: 'sm-perm-desc sm-num' },
                    t('versions.comparison', {
                      local: local || t('misc.notStated'),
                      latest: latest || t('misc.notStated'),
                    })
                    + (behind && detail?.latestChangelog ? ' · ' + detail.latestChangelog : '')))))
            : null,
          h('h4', null, t('versions.heading')),
          detail?.kind === 'loading'
            ? h('p', { className: 'sm-body-note' }, t('versions.loading'))
            : null,
          detail?.kind === 'unavailable'
            ? h('p', { className: 'sm-body-note' }, t('versions.localHasNone'))
            : null,
          versions.length > 0
            ? h(VersionHistory, {
              versions,
              installedVersion: local,
              busy: installState.kind === 'installing',
              onInstall: (version) => installVersion(skill, version),
            })
            : detail?.kind === 'ready'
              ? h('p', { className: 'sm-body-note' }, t('versions.none'))
              : null,
          h('h4', null, t('versions.versionAndSource')),
          rows.map(([label, value]) => h('div', { className: 'sm-perm', key: label },
            h('div', { className: 'sm-perm-main' },
              h('div', { className: 'sm-perm-title' }, h('strong', null, label)),
              h('div', { className: 'sm-perm-desc sm-num' }, String(value))))))
      }

      /** Permissions tab: what the skill declares, with this plugin's own access. */
      function permissionsTab(skill) {
        const rows = [
          {
            icon: 'i-globe',
            title: t('perm.network'),
            risk: 'mid',
            desc: t('perm.networkDesc', { key: t(skill.requiresApiKey ? 'perm.needsKey' : 'perm.noKeyNote') }),
          },
          {
            icon: 'i-metadata',
            title: t('perm.metadata'),
            risk: 'low',
            desc: t('perm.metadataDesc'),
          },
          {
            icon: 'i-folder',
            title: t('perm.localLibrary'),
            risk: 'low',
            desc: t('perm.localLibraryDesc'),
          },
        ]
        return h(React.Fragment, null,
          h('h4', null, t('perm.heading')),
          h('p', { className: 'sm-body-note' }, t('perm.note')),
          rows.map((row) => h('div', { className: 'sm-perm', key: row.title },
            h('span', { className: 'sm-perm-ic' }, h(Icon, { name: row.icon, size: 17 })),
            h('div', { className: 'sm-perm-main' },
              h('div', { className: 'sm-perm-title' },
                h('strong', null, row.title),
                h('span', { className: 'sm-risk ' + row.risk }, t(RISK_LABELS[row.risk]))),
              h('div', { className: 'sm-perm-desc' }, row.desc)))))
      }

      /**
       * The address to offer for a skill, from whichever source knows one.
       *
       * Both the listing and the detail response can carry it, and either may be missing. Preferring
       * the detail keeps the earlier behaviour; the important part is that whatever comes out has
       * already been through {@link publicSkillUrl}, so the tab never links to the API host.
       *
       * @param {object} skill - Skill record.
       * @param {object | undefined} detail - Cached detail, when loaded.
       * @returns {string} A URL a person can open, or ''.
       */
      function homepageFor(skill, detail) {
        const fromDetail = detail?.kind === 'ready' ? String(detail.sourceUrl ?? '') : ''
        return fromDetail !== '' ? fromDetail : String(skill.homepage ?? '')
      }

      /**
       * Safety tab: the scan verdict, and the vendors' own reports.
       *
       * Its own tab rather than a section of 指标: the verdict comes from the publisher's third-party
       * scans, while 指标 is about popularity, and folding one into the other buried the only part of
       * the drawer that says whether the thing is safe to install.
       *
       * The per-vendor links are offered only when a URL exists — a queued scan has none, and a link
       * built from nothing would be the same fault as the API-host homepage link.
       *
       * @param {object} skill - Skill record, for its id.
       * @returns {object} Element.
       */
      function safetyTab(skill) {
        const entry = securityFor(skill)
        if (entry.kind === 'loading' || entry.kind === 'idle') {
          return h(React.Fragment, null,
            h('h4', null, t('safety.heading')),
            h('p', { className: 'sm-body-note' }, t('safety.loading')))
        }
        if (entry.kind === 'failed') {
          return h(React.Fragment, null,
            h('h4', null, t('safety.heading')),
            // Stated rather than hidden: an empty section would read as "no findings".
            h('p', { className: 'sm-body-note' }, t('safety.failed', { reason: String(entry.reason ?? '') })))
        }
        const vendors = Array.isArray(entry.vendors) ? entry.vendors : []
        if (vendors.length === 0) {
          return h(React.Fragment, null,
            h('h4', null, t('safety.heading')),
            h('p', { className: 'sm-body-note' }, t('safety.none')))
        }
        const safe = entry.verdict === 'safe'
        const verdictText = t(safe
          ? 'safety.allBenign'
          : (entry.verdict === 'risk'
            ? 'safety.hasRisk'
            : (entry.verdict === 'pending' ? 'safety.pending' : 'safety.unknown')))
        return h(React.Fragment, null,
          h('h4', null, t('safety.heading')),
          h('p', { className: 'sm-body-note' }, t('safety.note')),
          // One row per vendor, each carrying its own verdict. The shield is green per row because a
          // row only exists to state what that vendor said — the single 安全 badge at the top of the
          // drawer is what requires *every* vendor to agree, and this list is where a disagreement
          // becomes visible.
          h('div', { className: 'sm-safety-vendors' },
            vendors.map((vendor) => {
              const vendorSafe = String(vendor.status) === 'benign'
              const vendorText = String(vendor.statusText || vendor.status || '—')
              return h('div', { className: 'sm-safety-vendor' + (vendorSafe ? '' : ' plain'), key: String(vendor.vendor) },
                h('span', { className: 'sm-safety-mark' },
                  h(Icon, { name: vendorSafe ? 'i-shield-check' : 'i-shield', size: 15 })),
                h('span', { className: 'sm-safety-label' },
                  h('strong', null, vendorLabel(vendor.vendor)),
                  h('span', null, vendorText)),
                typeof vendor.reportUrl === 'string' && vendor.reportUrl !== ''
                  ? h('a', {
                    className: 'sm-link-out sm-safety-report',
                    href: vendor.reportUrl,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                  }, t('safety.report'), h(Icon, { name: 'i-link', size: 12 }))
                  : null)
            })),
          // Said plainly, because the badge only appears for one verdict and its absence is otherwise
          // ambiguous between "not safe" and "not scanned".
          h('p', { className: 'sm-body-note' },
            t(safe ? 'safety.shownNote' : 'safety.hiddenNote')))
      }

      /** Metrics tab: the upstream counters, honestly labelled. */
      function metricsTab(skill, detail) {
        const homepage = homepageFor(skill, detail)
        return h(React.Fragment, null,
          h('h4', null, t('metrics.heading')),
          h('p', { className: 'sm-body-note' }, t('metrics.note')),
          h('div', { className: 'sm-stat-cards', style: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.downloads')),
              h('div', { className: 'sm-v' }, compact(skill.installs))),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.stars')),
              h('div', { className: 'sm-v' }, compact(skill.stars))),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.score')),
              h('div', { className: 'sm-v' }, formatScore(skill.score))),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.rating')),
              h('div', { className: 'sm-v' }, skill.rating))),
          homepage
            ? h(React.Fragment, null,
              h('h4', null, t('metrics.homepage')),
              h('p', null, h('a', {
                className: 'sm-link-out',
                href: homepage,
                target: '_blank',
                rel: 'noreferrer noopener',
              }, homepage, h(Icon, { name: 'i-link', size: 13 }))))
            : null)
      }

      /** The sliding inspector with its four tabs. */
      function inspector() {
        const skill = selectedSkill
        const open = skill !== null
        const detail = skill === null ? undefined : details[skill.id]
        const tabs = [
          ['overview', 'tab.overview'],
          ['files', 'tab.files'],
          ['versions', 'tab.versions'],
          ['permissions', 'tab.permissions'],
          ['safety', 'tab.safety'],
          ['metrics', 'tab.metrics'],
        ]
        // Named 安全扫描 rather than 安全 on purpose: the tab holds the scan's results, and a tab
        // called 安全 reads as the panel asserting the skill is safe before it has said anything.
        //
        // The shield marks it so it can be found among six, and the icon is tinted green only when
        // every vendor reported benign. The label is never tinted: a green 安全扫描 tab would make
        // the same claim as the badge, on a scan that may have failed.
        const selectedVerdict = skill === null ? 'unknown' : (securityFor(skill).verdict ?? 'unknown')
        const body = skill === null
          ? null
          : detailTab === 'files' ? filesTab(skill, detail)
            : detailTab === 'versions' ? versionTab(skill, detail)
              : detailTab === 'permissions' ? permissionsTab(skill)
                : detailTab === 'safety' ? safetyTab(skill)
                  : detailTab === 'metrics' ? metricsTab(skill, detail)
                    : overviewTab(skill, detail)
        return h(React.Fragment, null,
          h('div', {
            className: 'sm-scrim' + (open ? ' show' : ''),
            onClick: () => setSelected(null),
          }),
          h('aside', {
            className: 'sm-inspector' + (open ? ' open' : ''),
            'aria-hidden': !open,
            'aria-label': t('drawer.aria'),
          }, skill === null ? null : h(React.Fragment, null,
            h('div', { className: 'sm-insp-head' },
              h('div', { className: 'sm-insp-top' },
                h(SkillIcon, { skill, large: true }),
                h('button', {
                  type: 'button',
                  className: 'sm-icon-btn',
                  'aria-label': t('drawer.close'),
                  onClick: () => setSelected(null),
                }, h(Icon, { name: 'i-x' }))),
              h('h2', null, skill.name),
              h('div', { className: 'sm-insp-pub' },
                publisherOf(skill),
                skill.official ? h('span', { className: 'sm-verified' }, h(Verified, null)) : null,
                h('span', { className: 'sm-dot-sep' }, '·'),
                skill.categoryName),
              h('div', { className: 'sm-insp-actions' },
                installedIds.has(skill.id)
                  ? h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-secondary',
                    onClick: () => uninstall(skill),
                  }, h(Icon, { name: 'i-check', size: 16 }), t('drawer.uninstallInstalled'))
                  : h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-primary',
                    onClick: () => install(skill),
                  }, h(Icon, { name: 'i-download', size: 16 }), t('drawer.installSkill')),
                h('button', {
                  type: 'button',
                  className: 'sm-btn sm-btn-secondary',
                  'aria-pressed': savedIds.has(skill.id),
                  onClick: () => toggleSave(skill),
                }, h(Icon, { name: 'i-bookmark', size: 16 }), t(savedIds.has(skill.id) ? 'drawer.savedState' : 'card.saveShort'))),
              h('div', { className: 'sm-insp-meta' },
                h('span', { className: 'sm-num' }, skill.version ? 'v' + skill.version : t('drawer.versionUnknown')),
                h('span', { className: 'sm-sep' }, '·'),
                h('span', null, t(skill.source === 'official' ? 'drawer.sourceOfficial' : 'drawer.sourceCommunity')),
                h('span', { className: 'sm-sep' }, '·'),
                h('span', null, t('drawer.updatedAt', { time: skill.updated }))),
            // Above the tab strip, in the drawer's fixed header rather than inside a tab's body: the
            // counters are true whichever tab is open, and inside 概览 they scrolled away with it.
            h(StatStrip, { skill }),
            h('div', { className: 'sm-tabs', role: 'tablist' },
              tabs.map(([key, label]) => h('button', {
                key,
                type: 'button',
                role: 'tab',
                className: 'sm-tab' + (detailTab === key ? ' active' : '')
                  + (key === 'safety' ? ' sm-tab-icon' : '')
                  + (key === 'safety' && selectedVerdict === 'safe' ? ' sm-tab-safe' : ''),
                'aria-selected': detailTab === key,
                onClick: () => setDetailTab(key),
              }, key === 'safety' ? h(Icon, { name: 'i-shield-check', size: 13 }) : null, t(label)))),
            // The header ends here, and the body starts as its SIBLING. Written as one nested call by mistake, the
            // body landed inside the header: measured in the running app, `.sm-insp-body` reported a parent of
            // `.sm-insp-head` (a block, row-direction box) instead of `.sm-inspector` (the column flex container).
            // With no flex parent the body was never given a height — clientHeight 5862 === scrollHeight 5862, the
            // full content height — and everything past the panel's 1352px was clipped, so the drawer could not be
            // scrolled despite `overflow-y: auto` being in force. Both closing parentheses below matter: the first
            // pair closes the header, and the run at the end closes the fragment, the aside and the outer fragment.
            ),
            h('div', { className: 'sm-insp-body' }, body))))
      }

      /* ── assembly ────────────────────────────────────────────────────── */

/* [dsh-perfect-ui patch] Top-left entry: "check THIS plugin's own update".
         The panel itself only manages skills, so the Host route
         /api/dsh-perfect-ui-plugins/self (the same one the workbench page uses)
         reports whether 橘小黑工作台 itself has a newer version: installed from
         this plugin's package.json, latest from the repository tags.
         registry / git installs get an「更新」button (宿主 updateBundle);
         a local `link:` install only gets the honest instruction. */
      const renderPluginUpdates = () => {
        if (!pluginUpdatesOpen || pluginUpdates === null) return null
        const info = pluginUpdates.info
        const mode = info === null || info === undefined ? '' : (info.updateMode || '')
        const isLink = mode === 'link'
        /* registry 安装由宿主 updateBundle 推；Git 安装也能推——但要由 Host 现算
           「最新 tag 的完整 commit」当 spec（客户端不需要任何 token，也不传 spec，
           免得被前端伪造）。link 安装没有版本可升级，只如实说明。 */
        const canInstall = info !== null && info !== undefined && info.canUpdate === true
          && (mode === 'registry' || mode === 'git')
        const kindText = mode === 'registry' ? 'registry' : mode === 'git' ? 'Git' : (isLink ? 'link' : '本地')
        /* Closing the list also hides the strip: the user has just read it, so
           repeating the same notice underneath would be noise. The top-bar
           badge keeps the count, so the entry stays one click away. */
        const closing = () => { setPluginUpdatesOpen(false); setPluginUpdatesDismissed(true) }
        const rows = []
        if (info) {
          const busy = pluginUpdates.pending === info.name
          const note = pluginUpdates.phase === 'error'
            ? '检测失败'
            : info.error
              ? '无法读取远端：' + info.error
              : info.canUpdate === true
                ? (isLink
                  ? '本地 link 安装 · 远端最新 v' + info.latest + '，git pull 后重新构建即可'
                  : (mode === 'git'
                    ? '可更新到 v' + info.latest + '（Git 安装 · 钉 tag commit 原地更新）'
                    : '可更新 v' + info.installed + ' → v' + info.latest))
                : '已是最新' + (info.latest ? '（远端 v' + info.latest + '）' : '')
          rows.push(h('div', { className: 'sm-pu-row' + (info.canUpdate === true ? '' : ' is-clean'), key: 'self' },
            h('div', { className: 'sm-pu-rowmain' },
              h('div', { className: 'sm-pu-name' }, info.name || '@local/dsh-perfect-ui',
                h('span', { className: 'sm-pu-kind' }, kindText)),
              h('div', { className: 'sm-pu-note' }, note)),
            canInstall ? h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary sm-btn-sm',
              disabled: busy,
              onClick: () => applyPluginUpdate(info),
            }, busy ? '更新中…' : '更新') : null))
        }
        const summary = pluginUpdates.phase === 'running'
          ? (info && info.installed ? '当前 v' + info.installed + ' · 正在检测…' : '正在检测橘小黑工作台的最新版本…')
          : pluginUpdates.phase === 'error'
            ? pluginUpdates.error
            : info
              ? '当前 v' + (info.installed || '?')
                + (info.canUpdate === true ? ' · 可更新到 v' + info.latest : ' · 已是最新')
              : ''
        return h('div', { className: 'sm-confirm-layer' },
          h('div', { className: 'sm-confirm-scrim', role: 'presentation', onClick: closing }),
          h('div', {
            className: 'sm-confirm sm-pu-card',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': '橘小黑工作台更新',
          },
            h('h2', { className: 'sm-confirm-title' }, '橘小黑工作台更新'),
            h('p', { className: 'sm-confirm-body' + (pluginUpdates.phase === 'error' ? ' sm-pu-err' : '') }, summary),
            rows.length ? h('div', { className: 'sm-pu-list' }, rows) : null,
            h('div', { className: 'sm-confirm-actions' },
              h('button', {
                type: 'button',
                className: 'sm-btn sm-btn-secondary',
                disabled: pluginUpdates.phase === 'running',
                onClick: () => checkPluginUpdates(true),
              }, pluginUpdates.phase === 'running' ? '检测中…' : '重新检测'),
              h('button', { type: 'button', className: 'sm-btn sm-btn-primary', onClick: closing }, '关闭'))))
      }

      /* [dsh-perfect-ui patch] Auto-detected result, used by the top-bar badge
         and the notice strip: one boolean for one plugin. */
      const selfHasUpdate = pluginUpdates !== null && pluginUpdates.info !== null
        && pluginUpdates.info !== undefined && pluginUpdates.info.canUpdate === true
      const openPluginUpdates = () => {
        setPluginUpdatesOpen(true)
        const cache = window.__dshPuSelfCache
        const stale = !cache || Date.now() - cache.at > 5 * 60 * 1000
        if (pluginUpdates === null || pluginUpdates.phase === 'error' || stale) checkPluginUpdates(false)
      }
      /* The strip only appears when the automatic check found a newer version
         and the user has not dismissed it this session — detection without a popup. */
      const pluginUpdatesNotice = selfHasUpdate && !pluginUpdatesDismissed && !pluginUpdatesOpen
        ? h('div', { className: 'sm-pu-stage' },
          h(Icon, { name: 'i-arrow-up-circle', size: 14 }),
          h('span', { className: 'sm-pu-stage-text' },
            '橘小黑工作台有新版本 v' + (pluginUpdates.info.latest || '')),
          h('button', {
            type: 'button',
            className: 'sm-btn sm-btn-secondary sm-btn-sm',
            onClick: openPluginUpdates,
          }, '查看'),
          h('button', {
            type: 'button',
            className: 'sm-icon-btn sm-pu-stage-x',
            'aria-label': '关闭提示',
            title: '本次不再提示',
            onClick: () => setPluginUpdatesDismissed(true),
          }, h(Icon, { name: 'i-x', size: 14 })))
        : null

      const liveClass = status === 'loading' ? 'is-idle' : status === 'error' ? 'is-error' : ''
      const liveText = t(status === 'loading' ? 'status.syncing'
        : status === 'error' ? 'status.error'
          : 'status.connected')

      return h('div', { 'data-skill-market': '', 'data-skill-market-panel': PANEL_ID },
        h('header', { className: 'sm-topbar' },
          h('button', {
            type: 'button',
            className: 'sm-btn sm-btn-ghost sm-btn-sm' + (selfHasUpdate ? ' sm-pu-hit' : ''),
            'aria-label': '检测本插件更新',
            title: pluginUpdates === null || pluginUpdates.phase !== 'done'
              ? '检测橘小黑工作台是否有新版本'
              : (selfHasUpdate
                ? '橘小黑工作台有新版本 v' + (pluginUpdates.info.latest || '')
                : '橘小黑工作台已是最新版本'),
            onClick: () => {
              if (pluginUpdatesOpen) { setPluginUpdatesOpen(false); return }
              openPluginUpdates()
            },
          }, h(Icon, { name: 'i-arrow-up-circle', size: 16 }),
            h('span', { className: 'sm-btn-label' }, '检测更新'),
            selfHasUpdate ? h('span', { className: 'sm-pu-badge sm-pu-dot' }) : null),
          h('div', { className: 'sm-topbar-actions' },
            h('button', {
              type: 'button',
              className: 'sm-icon-btn',
              'aria-label': t('search.refresh'),
              title: t('search.refreshShort'),
              onClick: () => setReloadNonce((current) => current + 1),
            }, h(Icon, { name: 'i-refresh' })),
            h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: onImportAction,
            }, h(Icon, { name: 'i-upload', size: 16 }), h('span', { className: 'sm-btn-label' }, t('import.pickFile'))))),

        pluginUpdatesNotice,

        h('div', { className: 'sm-viewbar' },
          h('div', { className: 'sm-viewtabs', role: 'tablist', 'aria-label': t('panel.aria') },
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'market' ? ' active' : ''),
              'aria-selected': view === 'market', onClick: () => goToView('market'),
            }, t('view.discover')),
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'installed' ? ' active' : ''),
              'aria-selected': view === 'installed', onClick: () => goToView('installed'),
            }, t('view.installed') + ' ', h('span', { className: 'sm-vt-count' }, installed.length)),
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'saved' ? ' active' : ''),
              'aria-selected': view === 'saved', onClick: () => goToView('saved'),
            }, t('view.saved') + ' ', h('span', { className: 'sm-vt-count' }, saved.length)),
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'import' ? ' active' : ''),
              'aria-selected': view === 'import', onClick: () => goToView('import'),
            }, t('view.import') + ' ', h('span', { className: 'sm-vt-count' }, imported.length)))),

        h('div', { className: 'sm-fixed' },
          h('div', { className: 'sm-bounded' },
            view === 'installed' ? installedHead()
              : view === 'saved' ? savedHead()
                : view === 'import' ? importHead()
                  : marketHead())),

        h('main', { className: 'sm-content', ref: contentRef },
          h('div', { className: 'sm-inner sm-bounded' },
            view === 'installed' ? installedBody()
              : view === 'saved' ? savedBody()
                : view === 'import' ? importBody()
                  : marketBody())),

        h('div', { className: 'sm-statusbar' },
          h('span', { className: 'sm-live ' + liveClass }, liveText),
          h('span', { className: 'sm-num' }, t('metrics.total', { total: catalog.total.toLocaleString() })),
          h('span', { className: 'sm-spacer' }),
          h('span', null, 'SkillHub · api.skillhub.cn')),

        inspector(),

        // Over the drawer, under the confirmation dialog: a file is read *from* the drawer, and a
        // confirmation is a question about the whole panel that must not be buried by a preview.
        h(FileDialog, {
          preview,
          skill: selectedSkill,
          file: preview === null ? undefined : previews[previewKey(selectedSkill, preview.path, preview.version)],
          // The file list is what tells a link in a document whether it points inside the bundle, and the
          // version follows the preview so a link inside an old release stays in that release.
          files: selectedSkill === null ? undefined : details[selectedSkill.id]?.files,
          canGoBack: previewTrail.length > 0,
          onBack: () => backPreview(selectedSkill),
          // Following a link keeps the trail, which is what the back control walks back along.
          onOpenFile: (path) => followPreview(selectedSkill, path, preview?.version ?? ''),
          onClose: () => setPreview(null),
        }),

        h(ConfirmDialog, { request: confirmRequest, onClose: () => setConfirmRequest(null) }),

        renderPluginUpdates(),

        h('div', { className: 'sm-toast-wrap' },
          toast === null ? null : h('div', { className: 'sm-toast' },
            h('span', null, toast.message),
            toast.undo === null ? null : h('button', {
              type: 'button',
              className: 'sm-toast-undo',
              onClick: () => { setToast(null); toast.undo() },
            }, t('toast.undo'))),

        h('input', {
          ref: fileRef,
          type: 'file',
          accept: '.zip',
          multiple: true,
          hidden: true,
          onChange: (event) => {
            addLocalFiles(event.target.files)
            event.target.value = ''
          },
        })))
    }

    /**
     * Install this panel's stylesheet and return its cleanup.
     *
     * A dynamic client bundle is a classic script: it receives `window`,
     * `document` and `require`, and nothing else — there is no `styles` free
     * global in the shipped web shell, so reaching for one throws a
     * `ReferenceError` at activation and fails the whole boot audit. The
     * supported mechanism is a `<style>` tag: the kernel's `claimStyles` /
     * `removeOwnedStyles` already inventory and evict the tags a factory
     * injects, keyed by the plugin that materialised it.
     *
     * @param {string} css - Stylesheet text.
     * @returns {() => void} Removes the tag again.
     */
    function insertStylesheet(css) {
      if (typeof document === 'undefined') return () => {}
      const tag = document.createElement('style')
      tag.textContent = css
      document.head.appendChild(tag)
      return () => { tag.remove() }
    }

    /**
     * Read the directories changed since the Harness last started.
     *
     * Changing a skill is applied on the Host immediately, but an *already open* conversation
     * keeps the tool set and skill catalog its agent was created with, so its model may not learn
     * about the change until the Harness restarts. The panel cannot restart the process — on the
     * desktop the Host is a child of the Electron shell, and `webServer` exposes no restart
     * capability — so it says so, and lets the user keep changing skills until they are done.
     *
     * That advice has to outlive a page reload, because the change is still unapplied to the
     * conversation the user is in. It must **not** outlive the restart it asks for, or the banner
     * becomes permanent — the complaint the previous build fixed by splitting the set across
     * `localStorage` and `sessionStorage`, where a fresh *window* retired it.
     *
     * The file gives a better boundary than the window ever could: the set is recorded against
     * the epoch time the running Host started (`pending.since`), and a set recorded before that
     * time is spent, because the restart it asked for has happened. A window reopened while the
     * same Host keeps running now correctly keeps advising — the change really is still unapplied
     * — and a Harness restart clears it even if the window was never closed.
     *
     * @returns {Set<string>} Directory names.
     */
    function readPending() {
      if (panelHostStartedAt > 0 && panelDocument.pending.since !== panelHostStartedAt) {
        if (panelDocument.pending.since !== 0 || panelDocument.pending.dirs.length > 0) {
          panelDocument = { ...panelDocument, pending: { since: 0, dirs: [] } }
          requestPanelFlush()
        }
        return new Set()
      }
      return new Set(panelDocument.pending.dirs)
    }

    /**
     * Persist the changed-directory set, dropping it once it is empty.
     * @param {Set<string>} pending - Directory names.
     * @returns {void}
     */
    function writePending(pending) {
      panelDocument = {
        ...panelDocument,
        pending: pending.size === 0
          ? { since: 0, dirs: [] }
          : { since: panelHostStartedAt, dirs: [...pending] },
      }
      requestPanelFlush()
    }

    /**
     * Drop a skill file's YAML frontmatter, returning just the instruction body.
     *
     * `SKILL.md` opens with `---` delimited metadata (name, description, version…) that the
     * drawer header already presents, so the overview shows only the prose. A file with no
     * frontmatter, or an unterminated one, is returned unchanged rather than emptied — a
     * truncated file must not look like an empty skill.
     *
     * @param {string} text - Raw file contents.
     * @returns {string} The body, trimmed.
     */
    function stripFrontmatter(text) {
      const source = String(text ?? '').replace(/\r\n?/g, '\n')
      if (source.startsWith('---\n') === false) return source.trim()
      const end = source.indexOf('\n---', 4)
      if (end < 0) return source.trim()
      const after = source.indexOf('\n', end + 1)
      return (after < 0 ? '' : source.slice(after + 1)).trim()
    }

    /**
     * Render a Markdown file from a skill bundle, keeping its frontmatter readable.
     *
     * A `SKILL.md` opens with a YAML block. Passing it straight to {@link Markdown} turns the
     * metadata into paragraphs, which reads as broken prose and buries the actual body. So the
     * frontmatter is lifted out and shown as a labelled monospace block — the file is being
     * *viewed*, so its metadata is part of what the user asked to see — and the body is
     * rendered as Markdown below it.
     *
     * @param {{text: string, path?: string, onOpenFile?: (href: string) => void}} props - Raw file contents,
     *   its bundle path (so a transient host failure is not carried to the next file), and the handler that
     *   follows a link to a neighbouring file of the same bundle.
     * @returns {object} Element.
     */
    function MarkdownFile({ text, path, onOpenFile }) {
      const source = String(text ?? '').replace(/\r\n?/g, '\n')
      const closed = source.startsWith('---\n') ? source.indexOf('\n---', 4) : -1
      const frontmatter = closed < 0 ? '' : source.slice(4, closed)
      const body = stripFrontmatter(source)
      return h(React.Fragment, null,
        frontmatter === ''
          ? null
          : h(React.Fragment, null,
            h('div', { className: 'sm-preview-label' }, 'Frontmatter'),
            h('pre', { className: 'sm-preview-code' }, h('code', null, frontmatter))),
        body === '' ? null : h(Prose, { source: body, onOpenFile, resetKey: path }))
    }

    /**
     * One file of a skill's bundle, read in a dialog over the panel.
     *
     * Reading a file used to replace the tree inside the drawer, and the drawer is 560px — the narrowest
     * surface in the panel, on the one action that benefits from width. The file now opens over the whole
     * panel instead: the tree stays where it was, and the content gets the room. The exits are the ones
     * the confirmation dialog already taught — the close button, the scrim, Escape.
     *
     * @param {{preview: object|null, skill: object|null, file: object|undefined, files: Array<object>,
     *   canGoBack: boolean, onBack: Function, onOpenFile: (path: string) => void, onClose: Function}} props -
     *   What is open, whose file it is, the cached read for it, the bundle's file list, whether a followed
     *   link left a trail, the handler that steps back along it, the handler that follows a link, and the
     *   dismisser.
     * @returns {object|null} Element, or null when nothing is open.
     */
    function FileDialog({ preview, skill, file, files, canGoBack, onBack, onOpenFile, onClose }) {
      const closeRef = React.useRef(null)
      const bodyRef = React.useRef(null)
      React.useEffect(() => {
        if (preview === null) return undefined
        // The dialog is the innermost layer, so it takes focus and Escape rather than leaving them on
        // the drawer underneath.
        closeRef.current?.focus()
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [preview, onClose])
      if (preview === null) return null
      const name = preview.path.split('/').pop()
      const markdown = /\.(md|markdown)$/i.test(preview.path)
      const shownPath = preview.version === '' ? preview.path : preview.path + ' · v' + preview.version
      const ready = file?.kind === 'ready'
      /**
       * Follow a link from this file to another one of the bundle, if that is where it points.
       * A link out of the bundle (a URL, an absolute path, or one climbing past the root) stays inert: the
       * dialog is a reader, and the only thing it can meaningfully open is another file of the same skill.
       * @param {string} href - Link target as written in the markdown.
       * @returns {void}
       */
      const openLinkedFile = (href) => {
        const target = resolveBundlePath(preview.path, href)
        if (target === undefined) return
        if (Array.isArray(files) && files.some((entry) => entry.path === target) === false) return
        onOpenFile?.(target)
      }
      return h('div', { className: 'sm-preview-layer' },
        h('div', {
          className: 'sm-preview-scrim',
          role: 'presentation',
          onClick: onClose,
        }),
        h('div', {
          className: 'sm-preview-dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': preview.path,
          'data-skill': skill?.id ?? '',
        },
          h('div', { className: 'sm-preview-head' },
            // Only there once a link has been followed: a back control with nowhere to go is a dead one.
            canGoBack === true
              ? h('button', {
                type: 'button',
                className: 'sm-icon-btn',
                'aria-label': t('files.backOne'),
                title: t('files.backOne'),
                onClick: onBack,
              }, h(Icon, { name: 'i-chevron-left', size: 16 }))
              : null,
            h(Icon, { name: 'i-file', size: 15 }),
            h('span', { className: 'sm-preview-title' },
              h('span', { className: 'sm-preview-name' }, name),
              h('span', { className: 'sm-preview-path sm-num', title: preview.path }, shownPath)),
            h('button', {
              ref: closeRef,
              type: 'button',
              className: 'sm-btn sm-btn-secondary sm-btn-sm',
              onClick: onClose,
            }, h(Icon, { name: 'i-x', size: 14 }), t('files.close'))),
          h('div', { className: 'sm-preview-body', ref: bodyRef },
            file === undefined || file.kind === 'loading'
              ? h('p', { className: 'sm-body-note' }, t('files.loadingOne', { path: name }))
              : null,
            file?.kind === 'failed'
              ? h('p', { className: 'sm-body-note' }, t('files.readFailed', { reason: file.reason }))
              : null,
            ready
              ? (markdown
                ? h(MarkdownFile, { text: file.text, path: preview.path, onOpenFile: openLinkedFile })
                // Anything else is shown verbatim, and coloured when the host's highlighter is available:
                // the bytes are the point, the colours only make them readable.
                : h(HostFallback, {
                  resetKey: preview.path,
                  fallback: h(PlainCode, { code: file.text }),
                }, h(CodeBody, { code: file.text, lang: codeLanguageFor(preview.path) })))
              : null),
          h('div', { className: 'sm-preview-foot' },
            ready
              ? h('span', { className: 'sm-num' },
                t('files.sizeAndLines', { size: humanSize(file.bytes), lines: file.text.split('\n').length }))
              : null,
            ready && file.truncated ? h('span', null, t('files.truncated')) : null)))
    }

    /**
     * The panel's own confirmation dialog.
     *
     * Exists because `window.confirm` cannot be styled and does not belong to the surrounding UI:
     * on the desktop shell it renders as a browser warning, which made a deliberate, destructive
     * action look like something going wrong. This states what will happen, shows the concrete
     * target, and keeps Escape and the scrim as ways out — the same exits people already expect.
     *
     * @param {{request: object | null, onClose: Function}} props - Pending request and dismisser.
     * @returns {object | null} Element, or null when nothing is being asked.
     */
    function ConfirmDialog({ request, onClose }) {
      const confirmRef = React.useRef(null)
      React.useEffect(() => {
        if (request === null) return undefined
        // Focus the confirming action so the dialog is keyboard-operable without a tab hunt.
        confirmRef.current?.focus()
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [request, onClose])
      if (request === null) return null
      return h('div', { className: 'sm-confirm-layer' },
        h('div', {
          className: 'sm-confirm-scrim',
          role: 'presentation',
          onClick: onClose,
        }),
        h('div', {
          className: 'sm-confirm',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-label': request.title,
        },
          h('h2', { className: 'sm-confirm-title' }, request.title),
          h('p', { className: 'sm-confirm-body' }, request.body),
          request.detail === '' ? null : h('p', { className: 'sm-confirm-detail sm-num' }, request.detail),
          h('div', { className: 'sm-confirm-actions' },
            h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-secondary',
              onClick: onClose,
            }, t('action.cancel')),
            h('button', {
              ref: confirmRef,
              type: 'button',
              className: 'sm-btn ' + (request.danger === true ? 'sm-btn-danger' : 'sm-btn-primary'),
              onClick: () => {
                // Close first: the action can navigate or clear the subject it refers to.
                onClose()
                request.onConfirm()
              },
            }, request.confirmLabel))))
    }

    /**
     * The address a person can open for a skill.
     *
     * Upstream's `homepage` field points at the **API** host — `https://api.skillhub.cn/<ns>/<slug>` —
     * and that host answers a browser request with `405 Method Not Allowed`: it serves the JSON API,
     * not pages. Putting it in the 指标 tab gave a link that could not work.
     *
     * Measured behaviour of the alternatives for `<ns>/<slug>` = `indiv-ebandao/dev-expert`:
     *
     *   api.skillhub.cn/<ns>/<slug>          405, no body
     *   skillhub.cn/<ns>/<slug>              200, but the generic SPA shell (7 KB, no skill data)
     *   skillhub.cn/skills/<ns>/<slug>       200, 48 KB, `og:title` = the skill's own name
     *
     * So the public route is `/skills/` + namespace + slug, built from the identifiers rather than
     * from the field: `homepage` is only trusted for the case where it names some other host the
     * publisher chose, which must be left exactly as given.
     *
     * @param {unknown} homepage - Upstream's own value, if any.
     * @param {string} handle - Namespace/handle from the listing.
     * @param {string} slug - Skill slug.
     * @returns {string} A URL to open, or '' when there is nothing to point at.
     */
    function publicSkillUrl(homepage, handle, slug) {
      const raw = typeof homepage === 'string' ? homepage.trim() : ''
      const namespace = String(handle ?? '').trim()
      const name = String(slug ?? '').trim()
      // A URL on the API host is the upstream bug being corrected; anything else is a real choice.
      if (raw === '' || raw.includes('//api.skillhub.cn')) {
        if (namespace === '' || name === '') return ''
        return `https://skillhub.cn/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`
      }
      return raw
    }

    /**
     * The 「安全」 badge, shown only when the badge is something upstream actually said.
     *
     * The verdict comes from the Host, which requires **every** vendor to report `benign`. That
     * matters: vendors disagree in practice (`ima-skills` is benign from one and suspicious from the
     * other), so a badge drawn from "at least one said safe" would be a claim nobody made. Nothing is
     * rendered for any other verdict — no grey "unknown" chip either, because an absence says
     * "not scanned" honestly and a chip would imply the panel had an opinion.
     *
     * @param {{verdict: string, compact: boolean}} props - Verdict and whether to show the word.
     * @returns {object | null} Element, or null when there is no 安全 to report.
     */
    function SafetyBadge({ verdict, compact }) {
      if (verdict !== 'safe') return null
      return h('span', {
        className: 'sm-safety' + (compact ? ' sm-safety-compact' : ''),
        title: t('safety.badgeTitle'),
      },
        h(Icon, { name: 'i-shield-check', size: compact ? 13 : 15 }),
        compact ? null : t('safety.badge'))
    }

    /**
     * Display names for the security vendors, by the code upstream uses.
     *
     * Measured, not guessed: **every** one of 240 skills sampled across 12 pages reports exactly these
     * two codes — `keen` and `sanbu` — so the set really is fixed, and a lookup is honest rather than
     * a hopeful guess at a shape that keeps changing. The names were confirmed from the vendors' own
     * reports: `keen`'s link lands on 科恩实验室's threat-intelligence site (tix.qq.com), and `sanbu`'s
     * report HTML carries 云鼎实验室 in its own markup.
     *
     * An unrecognised code is still rendered, under the code itself — a future vendor must show up
     * rather than be dropped, because dropping it would narrow the scan and silently strengthen the
     * 安全 badge.
     * @see scripts/dev/security-vendors.mjs
     */
    const VENDOR_NAMES = { keen: 'misc.vendorKeen', sanbu: 'misc.vendorSanbu' }

    /**
     * The name to show for a vendor code.
     *
     * The table holds dictionary keys and the translation happens here. An earlier revision stored the keys in
     * the table and returned them untranslated, which printed `misc.vendorKeen` on screen in every language —
     * the table's values are keys, so they must be resolved at the point of use.
     *
     * @param {unknown} vendor - Upstream's code.
     * @returns {string} Localised vendor name, or the code as given when it is unrecognised.
     */
    function vendorLabel(vendor) {
      const code = String(vendor ?? '')
      const key = VENDOR_NAMES[code]
      return key === undefined ? code : t(key)
    }

    /**
     * The counter strip in the drawer header: downloads, favorites, score, version.
     *
     * Above the tab strip rather than inside a tab. It began as the drawer's footer, below the tab body,
     * where it read as a trailing summary of a page already scrolled; inside 概览 it scrolled away with
     * that tab. In the header it is simply present, whichever tab is open.
     *
     * @param {object} skill - Skill record.
     * @returns {object} Element.
     */
    function StatStrip({ skill }) {
      return h('div', { className: 'sm-stat-strip' },
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, compact(skill.installs)),
          h('span', null, t('metrics.downloads'))),
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, compact(skill.stars)),
          h('span', null, t('card.saved'))),
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, formatScore(skill.score)),
          h('span', null, t('metrics.score'))),
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, skill.version || '—'),
          h('span', null, t('card.version'))))
    }

    /**
     * Human-readable byte count for imported packages.
     * @param {number} bytes - File size.
     * @returns {string} Label.
     */
    function humanSize(bytes) {
      const n = Number(bytes)
      if (!Number.isFinite(n) || n <= 0) return t('files.unknownSize')
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1024 / 1024).toFixed(1) + ' MB'
    }

    /**
     * The sidebar entry glyph, drawn at the size the sidebar asks for.
     *
     * A bolt rather than the app-switcher grid it used to be: that grid says "some panel", which every
     * other entry could also say, while a bolt says what this one holds — skills. It matches the mark in
     * `icon.svg`, so the plugin list and the sidebar entry read as the same thing.
     *
     * @param {object} props - `size` from the sidebar.
     * @returns {object} Element.
     */
    function PanelIcon({ size }) {
      return h(Icon, { name: 'i-skill', size: size ?? 18 })
    }

    return {
      name: NS,
      // `locale` is optional in practice: `apply` guards its absence, and the panel then renders the
      // shipped Chinese text. Declaring it makes the service available when the build provides one.
      inject: ['slots', 'locale'],
      /**
       * Exposed for the test harness only: the relative-time formatter.
       *
       * It is the function whose "0 means 1970" behaviour produced "安装于 57 年前", and the
       * rule it now follows — an unusable timestamp yields no label rather than a wrong one —
       * is worth asserting directly instead of inferring from a rendered row.
       *
       * @param {number} timestamp - Epoch milliseconds.
       * @returns {string} Relative label, or '' when unknown.
       */
      relativeTimeForTest: (timestamp) => relativeTime(timestamp),
      /**
       * Exposed for the test harness only: the translator.
       *
       * Asserted under the real Cordis runtime with a locale service present, because the interesting
       * behaviour — using the injected service, and falling back to the shipped dictionary when the
       * service answers with the key — cannot be observed from the rendered output of a stub harness.
       *
       * @param {string} key - Dictionary key.
       * @param {object} [params] - Placeholder values.
       * @returns {string} Translated text.
       */
      tForTest: (key, params) => t(key, params),
      /**
       * Exposed for the test harness only: the fallback renderer's table rules.
       *
       * Skill documents carry GFM tables, and the panel's own renderer is what draws them when the host's
       * renderer is not in the build. The three line predicates are pure, so they are asserted directly
       * against real lines from a skill document rather than inferred from a rendered `<table>`.
       *
       * @param {string} line - One markdown line.
       * @returns {{delimiter: boolean, cells: string[], align: Array}} Parsed shape of that line.
       */
      markdownTableForTest: (line) => ({
        delimiter: isTableDelimiter(line),
        cells: tableCells(line),
        align: tableAlignments(line),
      }),
      /**
       * Exposed for the test harness only: render markdown with the panel's own renderer.
       *
       * The harness stubs the host renderer, so the fallback is otherwise unreachable there — and it is
       * the renderer that has to draw tables and follow file links when the host's is not in the build.
       *
       * @param {string} source - Markdown text.
       * @param {(href: string) => void} [onOpenFile] - Handler for links to neighbouring files.
       * @returns {object} Element.
       */
      MarkdownForTest: (source, onOpenFile) => Markdown({ source, onOpenFile }),
      /**
       * Exposed for the test harness only: resolve a markdown link against the file that carries it.
       *
       * @param {string} baseFile - Path of the carrying file.
       * @param {string} href - Link target.
       * @returns {string|undefined} Bundle-relative path, or undefined when the link leaves the bundle.
       */
      resolveBundlePathForTest: (baseFile, href) => resolveBundlePath(baseFile, href),
      /**
       * Contribute the panel and its sidebar entry.
       * @param {object} ctx - Client plugin context.
       * @returns {void}
       */
      apply(ctx) {
        ctx.effect(() => insertStylesheet(CSS), '@montersy123/dsh-skill-market: stylesheet')

        /**
         * Read the stored document as soon as the client activates, not when the panel mounts.
         *
         * The panel is opened from the sidebar long after boot in practice, so starting here makes
         * the document available before the first render — which is what lets `readState()` stay
         * synchronous. The promise is also what the panel's reconciliation waits on, and it never
         * rejects: a Host that cannot answer leaves a working panel with no persistence rather
         * than a plugin that fails to activate.
         */
        void panelStateReady()

        /**
         * Adopt the DSH locale service, if this build has one.
         *
         * Guarded rather than assumed: the panel must still render when the client locale package is
         * absent (a harness, or a leaner Host build), and it degrades to the shipped Chinese text
         * instead of failing to mount. `bind` resolves against the service's snapshot when *called*,
         * so one binding keeps working across a language switch; `subscribe` is only needed to keep
         * `clientActive` — which decides the dictionary used when the service has no entry — in step.
         */
        if (ctx.locale !== undefined && ctx.locale !== null) {
          /**
           * Register the dictionaries with the service.
           *
           * This is what the shipped panels do, and it is not merely a fallback for `bind`: registering
           * advances the locale snapshot's monotonic revision, and that revision is what the slot system's
           * injected `t` seat and the sidebar's panel list observe. Without a registration the service knows
           * nothing about this namespace, so a language switch has nothing to announce and the sidebar entry
           * — whose `label` is a function collected at registration — is never re-evaluated.
           *
           * Registered as an owned effect so unloading the plugin also withdraws the dictionaries.
           */
          try {
            ctx.effect(
              () => ctx.locale.register(CLIENT_NS, { zh: ZH, en: EN }),
              '@montersy123/dsh-skill-market: locale dictionaries',
            )
          } catch {
            /* a service without `register` still works through `bind` and the shipped tables */
          }
          clientLocale = ctx.locale.bind(CLIENT_NS)
          const syncActive = (snapshot) => {
            const active = String(snapshot?.active ?? '')
            clientActive = active.toLowerCase().startsWith('en') ? 'en' : 'zh'
          }
          try {
            syncActive(ctx.locale.getSnapshot?.())
            const unsubscribe = ctx.locale.subscribe?.(() => { syncActive(ctx.locale.getSnapshot?.()) })
            if (typeof unsubscribe === 'function') {
              ctx.effect(() => unsubscribe, '@montersy123/dsh-skill-market: locale subscription')
            }
          } catch {
            /* an unexpected service shape must not stop the panel from mounting */
          }
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, SkillMarketPanel))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: () => t('panel.title'),
          locale: NS,
        }, PanelIcon))
      },
    }
}


window.__ModuleLoader__.load({
  id: "@local/dsh-perfect-ui",
  factory(require) {
    'use strict';
    var React = require('react');
    var h = React.createElement;

    /* ============ A. 主题层：语义令牌覆盖表 ============ */
    var PU_SOURCE = "dsh-perfect-ui";
    var PU_TOKENS = {
  "--dsw-alias-bg-base": {
    "light": "#ffffff",
    "dark": "#0f1519"
  },
  "--dsw-alias-bg-layer-1": {
    "light": "#ffffff",
    "dark": "#161d24"
  },
  "--dsw-alias-bg-layer-2": {
    "light": "#f4faf7",
    "dark": "#1b242c"
  },
  "--dsw-alias-bg-overlay": {
    "light": "#ffffff",
    "dark": "#1a232b"
  },
  "--dsw-alias-bg-module-platform": {
    "light": "#d9f0e7",
    "dark": "#123026"
  },
  "--dsw-alias-bg-document-selection": {
    "light": "rgba(32,154,114,.4)",
    "dark": "rgba(47,191,143,.4)"
  },
  "--dsw-alias-bg-document-preview": {
    "light": "#d5e9e3",
    "dark": "#131a20"
  },
  "--dsw-alias-border-l1": {
    "light": "#dcebe6",
    "dark": "#22303a"
  },
  "--dsw-alias-border-l2": {
    "light": "#c5dcd5",
    "dark": "#2b3b47"
  },
  "--dsw-alias-border-l3": {
    "light": "#b8d4cb",
    "dark": "#354856"
  },
  "--dsw-alias-border-l4": {
    "light": "#a9cdc2",
    "dark": "#3f5464"
  },
  "--dsw-alias-label-primary": {
    "light": "#1f2329",
    "dark": "#e8eef2"
  },
  "--dsw-alias-label-secondary": {
    "light": "#5c6b68",
    "dark": "#9dabb4"
  },
  "--dsw-alias-label-document-preview": {
    "light": "#41524e",
    "dark": "#8fa0a8"
  },
  "--dsw-alias-label-shimmer": {
    "light": "rgba(31,35,41,.3)",
    "dark": "rgba(255,255,255,.45)"
  },
  "--dsw-alias-label-deep-diving": {
    "light": "#2f5fd0",
    "dark": "#7aaaff"
  },
  "--dsw-alias-label-deep-diving-shimmer": {
    "light": "#93c5fd",
    "dark": "#b7c8fe"
  },
  "--dsw-alias-brand-primary": {
    "light": "#209a72",
    "dark": "#2fbf8f"
  },
  "--dsw-alias-state-business-primary": {
    "light": "#209a72",
    "dark": "#2fbf8f"
  },
  "--dsw-alias-state-success-primary": {
    "light": "#209a72",
    "dark": "#3ecf9a"
  },
  "--dsw-alias-state-warn-primary": {
    "light": "#c9760a",
    "dark": "#e0a34a"
  },
  "--dsw-alias-state-error-primary": {
    "light": "#d94a4a",
    "dark": "#ff6b6b"
  },
  "--dsw-alias-state-idle-primary": {
    "light": "#93a2ac",
    "dark": "#6f8090"
  },
  "--dsw-alias-interactive-bg-hover": {
    "light": "#d1e5df",
    "dark": "#1d2a33"
  },
  "--dsw-specific-sidebar-fill": {
    "light": "#e2f0ec",
    "dark": "#0f1519"
  },
  "--dsw-menu-surface-fill": {
    "light": "rgba(255,255,255,.86)",
    "dark": "rgba(26,35,43,.86)"
  },
  "--dsw-alias-menu-group-header-fill": {
    "light": "rgba(244,250,247,.94)",
    "dark": "rgba(27,36,44,.94)"
  },
  "--dsw-alias-menu-icon": {
    "light": "#3c4b47",
    "dark": "#adb2b8"
  },
  "--dsw-alias-toast-bg": {
    "light": "#ffffff",
    "dark": "#1a232b"
  },
  "--dsw-alias-toast-label": {
    "light": "#1f2329",
    "dark": "#e8eef2"
  },
  "--dsw-alias-switch-thumb": {
    "light": "#ffffff",
    "dark": "#cfd3d6"
  },
  "--dsw-alias-tooltip-bg": {
    "light": "#1f2b33",
    "dark": "#1f2b33"
  },
  "--dsw-alias-tooltip-key-bg": {
    "light": "#3a4a55",
    "dark": "#3a4a55"
  },
  "--dsw-alias-markdown-code-block": {
    "light": "#f7fbf9",
    "dark": "#131a20"
  },
  "--dsw-alias-settings-card-fill": {
    "light": "#f4faf7",
    "dark": "#1b242c"
  },
  "--dsw-alias-settings-card-stroke": {
    "light": "#dcebe6",
    "dark": "#2b3b47"
  },
  "--dsw-alias-scrollbar-bg-l1": {
    "light": "#c5dcd5",
    "dark": "#2b3b47"
  },
  "--dsw-alias-scrollbar-hover-l1": {
    "light": "#a9cdc2",
    "dark": "#3f5464"
  },
  "--dsh-scrollbar-width": {
    "light": "7px",
    "dark": "7px"
  },
  "--dsw-alias-onboarding-accent": {
    "light": "#209a72",
    "dark": "#2fbf8f"
  },
  "--dsw-alias-onboarding-card-fill": {
    "light": "rgba(255,255,255,.8)",
    "dark": "rgba(22,29,36,.8)"
  },
  "--dsw-alias-onboarding-secondary-fill": {
    "light": "#ffffff",
    "dark": "#243039"
  },
  "--dsw-alias-onboarding-checkbox-border": {
    "light": "rgba(31,35,41,.2)",
    "dark": "#2b3b47"
  },
  "--dsw-elevation-stroke-color": {
    "light": "#c5dcd5",
    "dark": "#2b3b47"
  },
  "--dsw-radius-xs": {
    "light": "4px",
    "dark": "4px"
  },
  "--dsw-radius-sm": {
    "light": "8px",
    "dark": "8px"
  },
  "--dsw-radius-md": {
    "light": "12px",
    "dark": "12px"
  },
  "--dsw-radius-lg": {
    "light": "14px",
    "dark": "14px"
  },
  "--dsw-radius-xl": {
    "light": "16px",
    "dark": "16px"
  },
  "--dsw-radius-panel": {
    "light": "20px",
    "dark": "20px"
  }
};
    var PU_SHEET = "html body{--dsw-alias-bg-base:#ffffff !important;--dsw-alias-bg-layer-1:#ffffff !important;--dsw-alias-bg-layer-2:#f4faf7 !important;--dsw-alias-bg-overlay:#ffffff !important;--dsw-alias-bg-module-platform:#d9f0e7 !important;--dsw-alias-bg-document-selection:rgba(32,154,114,.4) !important;--dsw-alias-bg-document-preview:#d5e9e3 !important;--dsw-alias-border-l1:#dcebe6 !important;--dsw-alias-border-l2:#c5dcd5 !important;--dsw-alias-border-l3:#b8d4cb !important;--dsw-alias-border-l4:#a9cdc2 !important;--dsw-alias-label-primary:#1f2329 !important;--dsw-alias-label-secondary:#5c6b68 !important;--dsw-alias-label-document-preview:#41524e !important;--dsw-alias-label-shimmer:rgba(31,35,41,.3) !important;--dsw-alias-label-deep-diving:#2f5fd0 !important;--dsw-alias-label-deep-diving-shimmer:#93c5fd !important;--dsw-alias-brand-primary:#209a72 !important;--dsw-alias-state-business-primary:#209a72 !important;--dsw-alias-state-success-primary:#209a72 !important;--dsw-alias-state-warn-primary:#c9760a !important;--dsw-alias-state-error-primary:#d94a4a !important;--dsw-alias-state-idle-primary:#93a2ac !important;--dsw-alias-interactive-bg-hover:#d1e5df !important;--dsw-specific-sidebar-fill:#e2f0ec !important;--dsw-menu-surface-fill:rgba(255,255,255,.86) !important;--dsw-alias-menu-group-header-fill:rgba(244,250,247,.94) !important;--dsw-alias-menu-icon:#3c4b47 !important;--dsw-alias-toast-bg:#ffffff !important;--dsw-alias-toast-label:#1f2329 !important;--dsw-alias-switch-thumb:#ffffff !important;--dsw-alias-tooltip-bg:#1f2b33 !important;--dsw-alias-tooltip-key-bg:#3a4a55 !important;--dsw-alias-markdown-code-block:#f7fbf9 !important;--dsw-alias-settings-card-fill:#f4faf7 !important;--dsw-alias-settings-card-stroke:#dcebe6 !important;--dsw-alias-scrollbar-bg-l1:#c5dcd5 !important;--dsw-alias-scrollbar-hover-l1:#a9cdc2 !important;--dsh-scrollbar-width:7px !important;--dsw-alias-onboarding-accent:#209a72 !important;--dsw-alias-onboarding-card-fill:rgba(255,255,255,.8) !important;--dsw-alias-onboarding-secondary-fill:#ffffff !important;--dsw-alias-onboarding-checkbox-border:rgba(31,35,41,.2) !important;--dsw-elevation-stroke-color:#c5dcd5 !important;--dsw-radius-xs:4px !important;--dsw-radius-sm:8px !important;--dsw-radius-md:12px !important;--dsw-radius-lg:14px !important;--dsw-radius-xl:16px !important;--dsw-radius-panel:20px !important;}\nhtml body[data-ds-dark-theme]{--dsw-alias-bg-base:#0f1519 !important;--dsw-alias-bg-layer-1:#161d24 !important;--dsw-alias-bg-layer-2:#1b242c !important;--dsw-alias-bg-overlay:#1a232b !important;--dsw-alias-bg-module-platform:#123026 !important;--dsw-alias-bg-document-selection:rgba(47,191,143,.4) !important;--dsw-alias-bg-document-preview:#131a20 !important;--dsw-alias-border-l1:#22303a !important;--dsw-alias-border-l2:#2b3b47 !important;--dsw-alias-border-l3:#354856 !important;--dsw-alias-border-l4:#3f5464 !important;--dsw-alias-label-primary:#e8eef2 !important;--dsw-alias-label-secondary:#9dabb4 !important;--dsw-alias-label-document-preview:#8fa0a8 !important;--dsw-alias-label-shimmer:rgba(255,255,255,.45) !important;--dsw-alias-label-deep-diving:#7aaaff !important;--dsw-alias-label-deep-diving-shimmer:#b7c8fe !important;--dsw-alias-brand-primary:#2fbf8f !important;--dsw-alias-state-business-primary:#2fbf8f !important;--dsw-alias-state-success-primary:#3ecf9a !important;--dsw-alias-state-warn-primary:#e0a34a !important;--dsw-alias-state-error-primary:#ff6b6b !important;--dsw-alias-state-idle-primary:#6f8090 !important;--dsw-alias-interactive-bg-hover:#1d2a33 !important;--dsw-specific-sidebar-fill:#0f1519 !important;--dsw-menu-surface-fill:rgba(26,35,43,.86) !important;--dsw-alias-menu-group-header-fill:rgba(27,36,44,.94) !important;--dsw-alias-menu-icon:#adb2b8 !important;--dsw-alias-toast-bg:#1a232b !important;--dsw-alias-toast-label:#e8eef2 !important;--dsw-alias-switch-thumb:#cfd3d6 !important;--dsw-alias-tooltip-bg:#1f2b33 !important;--dsw-alias-tooltip-key-bg:#3a4a55 !important;--dsw-alias-markdown-code-block:#131a20 !important;--dsw-alias-settings-card-fill:#1b242c !important;--dsw-alias-settings-card-stroke:#2b3b47 !important;--dsw-alias-scrollbar-bg-l1:#2b3b47 !important;--dsw-alias-scrollbar-hover-l1:#3f5464 !important;--dsh-scrollbar-width:7px !important;--dsw-alias-onboarding-accent:#2fbf8f !important;--dsw-alias-onboarding-card-fill:rgba(22,29,36,.8) !important;--dsw-alias-onboarding-secondary-fill:#243039 !important;--dsw-alias-onboarding-checkbox-border:#2b3b47 !important;--dsw-elevation-stroke-color:#2b3b47 !important;--dsw-radius-xs:4px !important;--dsw-radius-sm:8px !important;--dsw-radius-md:12px !important;--dsw-radius-lg:14px !important;--dsw-radius-xl:16px !important;--dsw-radius-panel:20px !important;}";
    var PU_PLUGIN_ID = "@local/dsh-perfect-ui";
    /* 构建版本戳。2.4.0 与 2.4.1 的诊断文字逐字相同，无法区分
       「修复无效」与「页面仍跑旧代际」。版本显示在卡片底部一次排除。 */
    var PU_VERSION = "2.68.62";

    /* ============ C. 技能市场 Client 模块（复刻，见文件顶层） ============ */
    var PU_SM = PU_skillMarketFactory(require);

    /* ============ E. 设置页（功能开关 + 背景颜色） ============ */
    /* dsh-perfect-ui — 设置页（橘小黑工作台）：功能开关 + 背景颜色    
        
       座位：settings.section（list, replaceRisk=none）—— 官方给"整页设置"的扩展点，    
            宿主自己的 General / Models / Plugins 也走这里，所以视觉与宿主一致。    
        
       ---- 开关的实现方式（查证后决定）----    
       不用 setPluginEnabled：那是 profile 级、作用于所有会话，且需要重启才生效。    
       这里用**本包内的响应式偏好**：apply 时先读偏好，再按开关决定是否调用各功能的    
       install；偏好变化时重新组合这些 effect。效果即时、只影响本插件自己。    
       持久化走 localStorage（宿主 ui-settings 同款做法；客户端半边没有存储服务，    
       ctx 白名单只有 theme/slots/remote/locale/sessions/layout/timer/workspaces 等）。    
        
       ---- 技能市场开关的边界（诚实标注）----    
       客户端注册（main 面板 + sidebar.panellist 图标）关掉后**立即消失**。    
       Host 半边的 /skill-market/api 路由与已安装技能**仍在运行** —— 第三方复刻代码    
       的 apply 不做侵入式改动（保留与上游 diff 的能力），所以网络代理不会随开关停止。    
       页面上如实写明这一点，不假装全关。    
        
       ---- 背景颜色 ----    
       写进第二层 overrideTokens(source + '/custom')，宿主 composeActive 按注册顺序    
       合并，后层覆盖前层 → 基础薄荷绿主题不动，自定义只叠在上面；清空即回落主题值。    
       深色/浅色分别可配。    
    */    
        
    function PU_settings(React, h) {    
      'use strict';    
        
      var LS_KEY = 'dsh-perfect-ui.prefs.v1';    
      var BG_KEYS = [    
        { id: '--dsw-alias-bg-base', label: '应用底色', hint: '最外层背景' },    
        { id: '--dsw-alias-bg-layer-1', label: '卡片层', hint: '对话框、卡片' },    
        { id: '--dsw-alias-bg-layer-2', label: '次级层', hint: '分区、设置卡片' },    
        { id: '--dsw-alias-bg-overlay', label: '浮层底色', hint: '弹出面板' },    
      ];    
        
      var DEFAULTS = {    
        balance: true, actions: true, deleteSession: true, skillMarket: true, modelStyle: true,    
        /* 隐藏侧栏「更多」按钮。默认 false = 显示（不改用户现有界面）。 */    
        hideSidebarMore: false,    
        bg: { light: {}, dark: {} },    
      };    
        
      /* 拖动色盘时的本地预览值（不持久化、不进 store）。    
         键是 "<令牌id>::<mode>"，例如 "--dsw-alias-bg-base::light"。    
         拖动期间只写这里，不写 store —— 因此不重写 CSS、不触发全页重排。 */    
      var bgDraft = {};    
      /* 去抖用的两个表（同样是模块级、无 hook）：    
           bgSubmitAt   —— 上次落库时间戳，用于 400ms 节流    
           bgSubmitLater—— 尾部落库定时器，保证停手后最终值不丢 */    
      var bgSubmitAt = {};    
      var bgSubmitLater = {};    
        
      /* 清空所有本地预览与待提交状态。    
         ⚠ 重置/恢复默认时**必须**调用它：那两个按钮只改 store，    
         而输入框显示的是 bgDraft[key] || store 值 —— draft 有残留时，    
         store 已经回到主题默认，色块却还停在用户拖过的颜色，    
         表现为「界面颜色恢复了、颜色预览没变」（用户实测反馈）。    
         同时要取消尚未执行的尾部落库定时器，否则 400ms 后会把旧值又写回 store。 */    
      function clearBgDrafts() {    
        Object.keys(bgDraft).forEach(function (k) { delete bgDraft[k] });    
        Object.keys(bgSubmitAt).forEach(function (k) { delete bgSubmitAt[k] });    
        Object.keys(bgSubmitLater).forEach(function (k) {    
          try { clearTimeout(bgSubmitLater[k]) } catch (e) { /* 已执行 */ }    
          delete bgSubmitLater[k];    
        });    
      }    
        
      /* localStorage 在本半边可能被沙箱拒绝，一律容错 */    
      function readPrefs() {    
        try {    
          var raw = window.localStorage.getItem(LS_KEY);    
          if (!raw) return Object.assign({}, DEFAULTS, { bg: { light: {}, dark: {} } });    
          var p = JSON.parse(raw);    
          return {    
            balance: p.balance !== false,    
            actions: p.actions !== false,    
            deleteSession: p.deleteSession !== false,    
            skillMarket: p.skillMarket !== false,    
            modelStyle: p.modelStyle !== false,    
            /* 默认 false（不隐藏）；只有显式 true 才隐藏 */    
            hideSidebarMore: p.hideSidebarMore === true,    
            bg: {    
              light: (p.bg && p.bg.light) || {},    
              dark: (p.bg && p.bg.dark) || {},    
            },    
          };    
        } catch (e) {    
          return Object.assign({}, DEFAULTS, { bg: { light: {}, dark: {} } });    
        }    
      }    
        
      function writePrefs(p) {    
        try { window.localStorage.setItem(LS_KEY, JSON.stringify(p)); return true; }    
        catch (e) { return false; }    
      }    
        
      /* 原先这里有一段 `listeners` + `subscribe()` + `window.addEventListener('storage')`    
         的跨标签页同步逻辑，已整体删除。理由（三条都成立才删）：    
           ① 全仓零调用 —— 没有任何地方调用那个 subscribe()，listeners 永远是空数组；    
           ② 桌面端单窗口，storage 事件只在**其它**窗口写同一 key 时触发，本页永远收不到    
              （原注释自己也写着「桌面端只有一个页面」）；    
           ③ 它是全仓唯一一处「只增不减」的 GUI 监听器泄漏：window.addEventListener    
              从不移除，而 PU_settings(React,h) 每次 apply 都新建闭包 →    
              插件每禁用/启用一轮就累积一个 window 监听，旧闭包连同旧 store 无法回收。    
         真正的状态同步走下面的 store.subscribe（闭包稳定引用，见 store.js）。 */    
        
      /* ---------------- 单例偏好存储 ----------------    
         apply 与设置页共用同一份内存状态：apply 用它决定挂载哪些功能，    
         设置页改它并触发 apply 重新组合。 */    
      var store = {    
        value: readPrefs(),    
        rev: 0,    
        subs: [],    
        set: function (patch) {    
          this.value = Object.assign({}, this.value, patch);    
          this.rev += 1;    
          writePrefs(this.value);    
          /* 先快照再遍历：订阅者若在回调里退订（filter 会重分配 subs 数组），    
             直接读 this.subs.length 会漏掉后续订阅者。 */    
          var list = this.subs.slice();    
          for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { /* 忽略 */ } }    
        },    
        setBg: function (mode, id, hex) {    
          var bg = { light: Object.assign({}, this.value.bg.light), dark: Object.assign({}, this.value.bg.dark) };    
          if (hex) bg[mode][id] = hex; else delete bg[mode][id];    
          this.set({ bg: bg });    
        },    
        subscribe: function (fn) {    
          var self = this;    
          self.subs.push(fn);    
          return function () { self.subs = self.subs.filter(function (f) { return f !== fn; }); };    
        },    
      };    
      /* ---------------- 侧栏「更多」显隐同步 ----------------    
         把 store.value.hideSidebarMore 写成 <html data-pus-hide-more="1">，    
         由 MODEL_CSS/CSS 里的属性选择器决定是否隐藏那个按钮。    
         用属性而非直接改 DOM：宿主会重渲染侧栏，改过的节点会被重建，    
         而属性挂在 documentElement 上，重渲染不影响。 */    
      function syncSidebarMore() {    
        try {    
          if (typeof document === 'undefined') return;    
          var root = document.documentElement;    
          if (!root) return;    
          if (store.value.hideSidebarMore === true) {    
            root.setAttribute('data-pus-hide-more', '1');    
          } else {    
            root.removeAttribute('data-pus-hide-more');    
          }    
        } catch (e) { /* 静默：属性写失败只是显隐不生效，不影响其它功能 */ }    
      }    
        
        /* 用 rev + useSyncExternalStore 的写法保证重渲染可靠。    
         ⚠ subscribe/getSnapshot 必须是**稳定引用**（模块级函数），不能每渲染新建箭头函数 ——    
         否则 useSyncExternalStore 每次渲染都会退订再重订一轮，白白重分配 subs 数组。 */    
      /* 立即同步一次：首屏就按已保存的偏好隐藏，避免闪一下再消失。 */    
      syncSidebarMore();    
      /* 订阅：用户拨开关后即时生效（store.set 会同步遍历订阅者）。 */    
      store.subscribe(syncSidebarMore);    
        
      function subPrefs(cb) { return store.subscribe(cb); }    
      function snapPrefs() { return store.rev; }    
      function usePrefs() {    
        if (typeof React.useSyncExternalStore === 'function') {    
          return React.useSyncExternalStore(subPrefs, snapPrefs, snapPrefs);    
        }    
        var s = React.useState(0);    
        React.useEffect(function () { return store.subscribe(function () { s[1](function (v) { return v + 1; }); }); }, []);    
        return s[0];    
      }    
        
      /* ---------------- 插件推荐 ----------------    
         数据来源改走 Host 路由 /api/dsh-perfect-ui-plugins（host-plugins.js）：    
           GET  /status?name=<pkg>   → 已装没装、当前版本、可用更新    
           POST /install  {name}     → 真正安装（内部调宿主 pluginManager.installBundle）    
        
         为什么不再用客户端 remote.pluginManager：    
           那个命名空间要求 inject 点号键 "remote.pluginManager"（插件市场自己就是这么声明的：    
           inject = ["slots","locale","remote","remote.pluginManager",...]）。本插件只 inject    
           'remote'，取到的 remote 里没有 pluginManager → 报「宿主没有提供 pluginManager」。    
           改成 Host 侧标准服务后，既不依赖客户端 inject 细节，也能拿到 already-installed    
           的准确语义（宿主原文：installBundle 对已装包会在 pnpm 跑之前就拒绝，返回    
           already-installed）。 */    
      var RECOMMEND = [    
        {    
          cat: 'MCP 工具',    
          items: [    
            {    
              name: 'dsh-mcp-connector',    
              title: 'MCP 连接器',    
              desc: '连接器目录、三通道连接（HTTP / OAuth / stdio）、凭证存储与工具动态发现。装好后在侧栏出现「MCP连接器」入口。',    
              tag: '推荐',    
            },    
          ],    
        },    
        {    
          cat: '上下文与记忆',    
          items: [    
            {    
              name: 'dsh-mnemon',    
              title: 'Mnemon 上下文记忆',    
              desc: '基于视图的可组合上下文管理：可插拔来源与策略、分层记忆，以及开箱即用的自进化技能。让长会话里的关键信息自动沉淀、按需召回。',    
              tag: '推荐',    
            },    
          ],    
        },    
        {    
          cat: '电脑操作',    
          items: [    
            {    
              name: '@copylee/dsh-computer-use',    
              title: 'Computer Use（电脑操控）',    
              desc: '让 AI 看屏幕、点鼠标、敲键盘来操控 Windows 桌面。操控期间屏幕有橙色光晕提示，按 Esc 可随时暂停/继续。',    
              tag: '推荐',    
              note: '要求 DSH ≥ 0.2.0-rc.2',    
            },    
            {    
              name: 'dsh-computer-use',    
              title: 'Computer Use（原生驱动）',    
              desc: '通过 cua-driver 原生驱动操控桌面：AX 树观测、虚拟鼠标键盘（不抢占真实鼠标）、应用枚举与启动，共 12 个模型友好工具。内置危险词审批、密码框保护、快照过期拒绝等安全护栏。',    
              tag: '备选',    
              note: '要求 DSH ≥ 0.1.2-rc.1 · node ≥ 22.18',    
            },    
          ],    
        },    
      ];    
        
      var PLUGIN_API = '/api/dsh-perfect-ui-plugins';    
      var PROMO_API = '/api/dsh-perfect-ui-promo';    
        
      /* ---------------- 广告（推广）----------------    
         每个推广位有 type 决定渲染方式：    
           'text'   —— 本地文案（title / subtitle / tag / body / items）    
           'github' —— 从 GitHub 仓库拉一个 HTML 文件并渲染（可带 sha/message/date 的更新信息）    
           'url'    —— 从白名单域名拉一个 HTML 并渲染    
         远程 HTML 一律走 Host 路由 /api/dsh-perfect-ui-promo 代理（客户端受同源策略    
         与 Cordis trap 限制，不能直接跨域取），拿回文本后放进 **sandbox iframe**    
         （无 allow-scripts），因此远程脚本无法接触宿主上下文。    
         hidden 状态存独立 localStorage key，不与 prefs 混。 */    
      var PROMOS = [    
        {    
          id: 'instant-supply',    
          type: 'github',    
          title: '回收 · 出售｜扫码安排',    
          tag: '推广',    
          /* 真实推广位。仓库是公开的、分支是 main。    
             ad.html 是专门为广告位做的版本：二维码已内联成 data URL    
             （sandbox iframe 里相对路径解析不到），脚本已移除。 */    
          owner: 'Tangerine-Living',    
          repo: 'AD',    
          path: 'dsh-perfect-ui/ad.html',    
          branch: 'main',    
          /* 最小高度兜底。实际高度由 flex 拉伸决定；    
             这个值只保证容器再小也不会塌成一条。    
             调低到 200，是为了减少「容器已给足空间、iframe 仍被托底撑高、    
             导致内部滚动」的情况。 */    
          /* 仅用于「不铺满模式（fill:false）」的固定高度。    
             铺满模式下高度完全由 flex 决定，这个值不参与。 */    
          height: 200,    
          showMeta: false,    
        },    
      ];    
        
      /* 远程内容的运行时状态（不进 localStorage）：loading / ok / error */    
      var promoRemote = {};    
        
      /* 推广不可关闭，因此不再有 hidden 存储与恢复机制。 */    
        
      /* Section 挂载时把重渲染函数注册进来（广告显隐要触发重渲染） */    
      var notifyPromoChanged = null;    
        
      /* ---------------- 远程推广内容加载 ----------------    
         统一走 Host 代理；返回 { ok, html, ... } 交给 sandbox iframe。    
         状态存 promoRemote（模块级），变化时 bump 触发重渲染。 */    
      function promoBump() {    
        if (typeof notifyPromoChanged === 'function') { try { notifyPromoChanged(); } catch (e) { /* 忽略 */ } }    
      }    
        
      function loadPromoRemote(item) {    
        var st = promoRemote[item.id];    
        if (st && (st.phase === 'loading' || st.phase === 'ok')) return;  /* 幂等：不重复拉 */    
        
        var qs = '';    
        if (item.type === 'github') {    
          if (!item.owner || !item.repo || !item.path) {    
            promoRemote[item.id] = { phase: 'error', msg: '配置缺少 owner / repo / path' };    
            promoBump(); return;    
          }    
          qs = '/github?owner=' + encodeURIComponent(item.owner)    
            + '&repo=' + encodeURIComponent(item.repo)    
            + '&path=' + encodeURIComponent(item.path)    
            + '&branch=' + encodeURIComponent(item.branch || 'main');    
        } else if (item.type === 'url') {    
          if (!item.url) {    
            promoRemote[item.id] = { phase: 'error', msg: '配置缺少 url' };    
            promoBump(); return;    
          }    
          qs = '/raw?url=' + encodeURIComponent(item.url);    
        } else {    
          return;  /* text 类型不需要远程 */    
        }    
        
        var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();    
        promoRemote[item.id] = { phase: 'loading', msg: '正在加载…' };    
        promoBump();    
        
        Promise.resolve().then(function () {    
          return fetch(PROMO_API + qs, { headers: { accept: 'application/json' } });    
        }).then(function (r) {    
          return r.text().then(function (txt) {    
            if (!txt || !txt.trim()) throw new Error('服务端返回空响应（HTTP ' + r.status + '）');    
            try { return JSON.parse(txt); }    
            catch (e) { throw new Error('响应不是 JSON（HTTP ' + r.status + '）'); }    
          });    
        }).then(function (d) {    
          var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();    
          var elapsedMs = Math.round(now - t0);    
          if (!d) { promoRemote[item.id] = { phase: 'error', msg: '空响应' }; promoBump(); return; }    
          if (!d.ok) {    
            promoRemote[item.id] = { phase: 'error', msg: (d.error || '加载失败') };    
            promoBump(); return;    
          }    
          promoRemote[item.id] = {    
            phase: 'ok',    
            html: d.html || '',    
            bytes: d.bytes || 0,    
            sha: d.sha || '',    
            message: d.message || '',    
            date: d.date || '',    
            contentType: d.contentType || '',    
            /* cached：Host 命中缓存时为 true（此时正文没重新下载）    
               bytes：缓存命中时仍是原文大小，用于展示    
               elapsedMs：本次请求耗时，排查「加载慢」用 */    
            cached: d.cached === true,    
            elapsedMs: elapsedMs,    
          };    
          promoBump();    
        }).catch(function (e) {    
          promoRemote[item.id] = { phase: 'error', msg: '加载异常：' + ((e && e.message) || String(e)) };    
          promoBump();    
        });    
      }    
        
      /* 单个推荐项的运行时状态（不进持久化 store） */    
      var recState = {};    
      var recSubs = [];    
      function recSet(name, patch) {    
        recState[name] = Object.assign({}, recState[name] || {}, patch);    
        var list = recSubs.slice();    
        for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { /* 忽略 */ } }    
      }    
      function recGet(name) { return recState[name] || {}; }    
        
      /* 同源 fetch + 容错解析（照 actions.js 已验证的写法） */    
      function pluginApi(pathname, opts) {    
        return Promise.resolve().then(function () {    
          return fetch(PLUGIN_API + pathname, opts);    
        }).then(function (r) {    
          return r.text().then(function (txt) {    
            if (!txt || !txt.trim()) throw new Error('服务端返回空响应（HTTP ' + r.status + '）');    
            try { return JSON.parse(txt); }    
            catch (e) { throw new Error('响应不是 JSON（HTTP ' + r.status + '）：' + txt.slice(0, 120)); }    
          });    
        });    
      }    
        
      function mapPhase(st) {    
        if (!st) return 'idle';    
        if (st.installed) return 'done';    
        return 'idle';    
      }    
        
      /* 查状态：进入设置页时对每个推荐项跑一次，让按钮直接显示「已安装 / 安装 / 更新」。    
         canUpdate 由 Host 按 DSH 官方口径算（listVersions 的 listed + dsh.bundle + 兼容 +    
         非废弃非预发布 + 宿主认为该包可走 registry 更新），前端不自己判断。 */    
      function probeRecommended(item) {    
        pluginApi('/status?name=' + encodeURIComponent(item.name)).then(function (d) {    
          if (d && d.ok && d.available) {    
            if (d.installed) {    
              var v = d.version || '?';    
              var blocked = d.blocked || [];    
              var canUpdate = d.canUpdate === true && !!d.latest;    
              var msg = '';    
              if (canUpdate) {    
                msg = '已安装 v' + v + '，可更新到 v' + d.latest;    
              } else if (blocked.length) {    
                /* 有更新的发布版但这台 DSH 装不了（官方插件详情里同样这么解释） */    
                msg = '已安装 v' + v + '；v' + blocked[0].version + ' ' + (blocked[0].reason || '不可安装');    
              } else if (d.listStatus === 'refused' && d.reason) {    
                msg = '已安装 v' + v + '（' + d.reason + '）';    
              } else {    
                msg = '已安装 v' + v + '（已是最新版本）';    
              }    
              recSet(item.name, {    
                phase: 'done',    
                err: false,    
                version: d.version || '',    
                latest: canUpdate ? d.latest : '',    
                canUpdate: canUpdate,    
                blocked: blocked,    
                msg: msg,    
              });    
            } else {    
              recSet(item.name, { phase: 'idle', err: false, version: '', latest: '', canUpdate: false, msg: '' });    
            }    
          } else {    
            recSet(item.name, {    
              phase: 'error',    
              msg: (d && d.error) ? d.error : '无法检查安装状态',    
            });    
          }    
        }).catch(function (e) {    
          recSet(item.name, { phase: 'error', msg: '检查失败：' + ((e && e.message) || String(e)) });    
        });    
      }    
        
      /* 安装：Host 路由内部先查状态，已装则直接回 already-installed（不让 pnpm 重跑）。 */    
      function installRecommended(item) {    
        recSet(item.name, { phase: 'install', busyLabel: '安装中…', msg: '正在安装…' });    
        pluginApi('/install', {    
          method: 'POST',    
          headers: { 'content-type': 'application/json' },    
          body: JSON.stringify({ name: item.name }),    
        }).then(function (d) {    
          if (!d) { recSet(item.name, { phase: 'error', msg: '空响应' }); return; }    
          if (!d.ok) {    
            recSet(item.name, { phase: 'error', msg: d.error || '安装失败' });    
            return;    
          }    
          if (d.alreadyInstalled) {    
            /* 已装：不要停在 already-installed 上，回退成正常已装态并刷新更新判断 */    
            probeRecommended(item);    
            return;    
          }    
          recSet(item.name, {    
            phase: 'done',    
            err: false,    
            version: d.version || '',    
            canUpdate: false,    
            msg: '安装完成' + (d.version ? ' v' + d.version : '') + '，重启 DSH 后生效',    
          });    
        }).catch(function (e) {    
          recSet(item.name, { phase: 'error', msg: '安装异常：' + ((e && e.message) || String(e)) });    
        });    
      }    
        
      /* 更新：走 Host 的 POST /update → 宿主官方 updateBundle(name, version)。    
         目标版本由 Host 自己按官方口径算，前端只发 name。 */    
      function updateRecommended(item) {    
        recSet(item.name, { phase: 'install', busyLabel: '更新中…', msg: '正在更新…' });    
        pluginApi('/update', {    
          method: 'POST',    
          headers: { 'content-type': 'application/json' },    
          body: JSON.stringify({ name: item.name }),    
        }).then(function (d) {    
          if (!d) { recSet(item.name, { phase: 'error', msg: '空响应' }); return; }    
          if (!d.ok) {    
            recSet(item.name, { phase: 'done', err: true, msg: d.error || '更新失败' });    
            return;    
          }    
          recSet(item.name, {    
            phase: 'done',    
            err: false,    
            version: d.to || '',    
            canUpdate: false,    
            latest: '',    
            msg: (d.message || '更新完成') + '，重启 DSH 后生效',    
          });    
          probeRecommended(item);    
        }).catch(function (e) {    
          recSet(item.name, { phase: 'done', err: true, msg: '更新异常：' + ((e && e.message) || String(e)) });    
        });    
      }    
        
    /* ---------------- 检测本插件自身更新 ----------------    
         只关心 @local/dsh-perfect-ui 自己（= 这个界面所属的插件），不是推荐列表里的三方插件。    
         已装版本由 Host 读本插件目录的 package.json（正在跑的那一份），    
         最新版本由仓库 tag 得出（git ls-remote --tags，不依赖 GitHub API 的限流）。    
         安装形态决定能否一键更新：    
           registry / git → 宿主 updateBundle 可用，面板给「更新」按钮    
           link           → 本地 link 安装，只能 git pull 后重新构建（面板说明原因，不装作能更新）    
         两处入口共用同一个端点：设置·工作台 / 技能市场顶栏。 */    
      var ALL_UPD = '__self_update__';    
      /* 检测结果的时效：5 分钟内重复打开设置页不再重新联网（Git 那边要跑 ls-remote，    
         重跑一次几秒；设置页每次打开都重跑会显得慢）。 */    
      var ALL_UPD_TTL = 5 * 60 * 1000;    
      var allUpdAt = 0;    
        
      function checkSelfUpdate(force) {    
        var st = recGet(ALL_UPD);    
        allUpdAt = Date.now();    
        recSet(ALL_UPD, { phase: 'loading', error: '', info: st.info || null, busy: false, note: '', noteErr: false });    
        pluginApi(force ? '/self?force=1' : '/self').then(function (d) {    
          if (!d || !d.ok) {    
            recSet(ALL_UPD, { phase: 'error', error: (d && d.error) || '检测失败', info: st.info || null });    
            return;    
          }    
          recSet(ALL_UPD, { phase: 'done', error: '', info: d, busy: false, note: '', noteErr: false });    
        }).catch(function (e) {    
          recSet(ALL_UPD, { phase: 'error', error: '检测失败：' + ((e && e.message) || String(e)), info: st.info || null });    
        });    
      }    
        
      /* 自动检测：设置页一打开就跑，不需要点按钮。    
         正在跑（loading）或上次结果还新鲜（5 分钟内）就跳过，避免重复联网。 */    
      function autoCheckSelfUpdate() {    
        var st = recGet(ALL_UPD);    
        if (st.phase === 'loading') return;    
        if (st.phase === 'done' && Date.now() - allUpdAt < ALL_UPD_TTL) return;    
        checkSelfUpdate(false);    
      }    
        
      /* 更新本插件：registry 与 Git 安装都由宿主 updateBundle 推（后者由 Host 现算    
         最新 tag 的完整 commit 当 spec，客户端只发 name）；link 安装给出可执行的做法，    
         不假装能一键升级。 */    
      function updateSelf() {    
        var st = recGet(ALL_UPD);    
        var info = st.info || {};    
        var mode = info.updateMode || '';    
        if (mode !== 'registry' && mode !== 'git') return;    
        recSet(ALL_UPD, { phase: 'done', error: '', info: info, busy: true, note: '正在更新…', noteErr: false });    
        pluginApi('/update', {    
          method: 'POST',    
          headers: { 'content-type': 'application/json' },    
          body: JSON.stringify({ name: info.name }),    
        }).then(function (d) {    
          if (!d || !d.ok) {    
            recSet(ALL_UPD, { phase: 'done', error: '', info: info, busy: false, note: (d && d.error) || '更新失败', noteErr: true });    
            return;    
          }    
          recSet(ALL_UPD, {    
            phase: 'done', error: '', info: info, busy: false,    
            note: (d.message || '更新完成') + '，重启 DSH 后生效', noteErr: false,    
          });    
          checkSelfUpdate(true);    
        }).catch(function (e) {    
          recSet(ALL_UPD, { phase: 'done', error: '', info: info, busy: false, note: '更新异常：' + ((e && e.message) || String(e)), noteErr: true });    
        });    
      }    
        
      /* 面板：**设置页一打开就自动检测**（见 autoCheckSelfUpdate），不需要点按钮；    
         按钮只用于「重新检测」。 */    
      function selfUpdatePanel() {    
        var st = recGet(ALL_UPD);    
        var phase = st.phase || 'idle';    
        var info = st.info || null;    
        var mode = info ? (info.updateMode || '') : '';    
        var canUpdate = !!(info && info.canUpdate);    
        var canInstall = canUpdate && (mode === 'registry' || mode === 'git');    
        var kindText = mode === 'registry' ? 'registry' : (mode === 'git' ? 'Git' : (mode === 'link' ? 'link' : '本地'));    
        var summary = '';    
        if (phase === 'error') {    
          summary = st.error || '检测失败';    
        } else if (!info) {    
          summary = phase === 'loading' ? '正在检测本插件的最新版本…' : '正在自动检测本插件的最新版本…';    
        } else if (phase === 'loading') {    
          summary = (info.installed ? '当前 v' + info.installed + ' · ' : '') + '正在检测最新版本…';    
        } else if (info.error) {    
          summary = (info.installed ? '当前 v' + info.installed + ' · ' : '') + '无法读取远端：' + info.error;    
        } else if (canUpdate) {    
          summary = '当前 v' + info.installed + ' · 可更新到 v' + info.latest;    
          if (mode === 'link') summary += '（本地 link 安装：git pull 后重新构建即可）';    
          else if (mode === 'git') summary += '（Git 安装 · 钉 tag commit 原地更新）';    
        } else {    
          summary = '当前 v' + (info.installed || '?') + ' · 已是最新' + (info.latest ? '（远端 v' + info.latest + '）' : '');    
        }    
        
        var note = st.note || '';    
        var row = info ? h('div', { className: 'pus-upd-row' },    
          h('div', { className: 'pus-upd-rowmain' },    
            h('div', { className: 'pus-upd-name' }, info.name || '@local/dsh-perfect-ui',    
              h('span', { className: 'pus-upd-kind' }, kindText)),    
            h('div', { className: 'pus-upd-note' + (st.noteErr ? ' is-err' : '') },    
              note || (canUpdate    
                ? (mode === 'link'    
                  ? '仓库：' + (info.repoUrl || '') + ' · 本地 link 安装没有版本可升级'    
                  : (mode === 'git'    
                    ? '可更新到 v' + info.latest + '（Git 安装 · 钉 tag commit 原地更新）'    
                    : '可更新 v' + info.installed + ' → v' + info.latest))    
                : (info.error ? '检测失败，可点「重新检测」再试' : '无需更新')))),    
          canInstall    
            ? h('button', {    
                type: 'button',    
                className: 'pus-rec-btn is-update',    
                disabled: st.busy === true,    
                onClick: updateSelf,    
              }, st.busy === true ? '更新中…' : '更新')    
            : null) : null;    
        
        return h('div', { className: 'pus-upd' },    
          h('div', { className: 'pus-upd-head' },    
            h('div', { className: 'pus-upd-main' },    
              h('div', { className: 'pus-upd-title' }, '橘小黑工作台更新'),    
              h('div', { className: 'pus-upd-sub' + (phase === 'error' ? ' is-err' : '') }, summary)),    
            h('button', {    
              type: 'button',    
              className: 'pus-rec-btn',    
              disabled: phase === 'loading',    
              onClick: function () { checkSelfUpdate(true); },    
            }, phase === 'loading' ? '检测中…' : '重新检测')),    
          row ? h('div', { className: 'pus-upd-list' }, row) : null);    
      }    
        
        function Section() {    
        usePrefs();    
        var p = store.value;    
        var saved = React.useRef(null);    
        var note = saved.current || '';    
        /* TAB 状态。用本地 state（不进持久化 store）：每次打开设置页默认回到第一个 TAB。 */    
        var tabS = React.useState('switches');    
        var tab = tabS[0];    
        var setTab = tabS[1];    
        /* 推荐卡的异步状态变化需要触发重渲染（recState 是模块级，不走预持久化 store） */    
        var recTick = React.useState(0);    
        React.useEffect(function () {    
          var bump = function () { recTick[1](function (v) { return v + 1; }); };    
          recSubs.push(bump);    
          /* 广告的显隐变化也复用同一个 bump（不需要第二套订阅） */    
          notifyPromoChanged = bump;    
          /* 挂载时把所有推荐项的真实安装状态查一遍 —— 已装就显示版本、按钮变「重装/更新」，    
             这样不会再出现「点安装才报错」的情况。 */    
          RECOMMEND.forEach(function (cat) {    
            cat.items.forEach(function (item) { probeRecommended(item); });    
          });    
          /* 插件更新检测也自动跑（用户明确要求「自动检测，不要手动」）：    
             5 分钟内重复打开不重跑，正在跑也不会重复发请求。 */    
          autoCheckSelfUpdate();    
          return function () {    
            recSubs = recSubs.filter(function (f) { return f !== bump; });    
            notifyPromoChanged = null;    
          };    
        }, []);    
        
        function toggle(key, next) {    
          var patch = {}; patch[key] = next;    
          /* 先写提示再触发重渲染：store.set 会同步通知订阅者，    
             顺序反了本轮渲染读到的还是旧值（提示慢一拍才出现）。 */    
          saved.current = '已保存，立即生效';    
          store.set(patch);    
        }    
        
        function row(key, label, desc) {    
          return h('div', { className: 'pus-row' },    
            h('div', { className: 'pus-row-main' },    
              h('div', { className: 'pus-row-label' }, label),    
              h('div', { className: 'pus-row-desc' }, desc)),    
            h('button', {    
              type: 'button', role: 'switch', 'aria-checked': p[key] ? 'true' : 'false',    
              className: 'pus-switch' + (p[key] ? ' pus-switch-on' : ''),    
              onClick: function () { toggle(key, !p[key]); },    
            }, h('span', { className: 'pus-knob' })));    
        }    
        
        /* 颜色行。⚠ 关键：**松手才生效**。    
           React 的 onChange 实际绑定 DOM 的 input 事件，<input type=color> 在拖色盘    
           过程中会**连续**触发（实测每秒数十次）。每次写 store 都会重写 tokens.css，    
           引发全页样式重算 + 重排 —— 这就是「切换颜色很卡」的直接原因。    
        
           做法：    
             · onInput（拖动中）→ 只更新本地预览值，不碰 store，零副作用；    
             · onChange → 浏览器原生 change，**只在色盘关闭/松手时触发**一次 → 才写 store。    
        
           注意不能只写 onChange 而不写 onInput：那样拖动时色块（value）不会跟着变，    
           用户会以为色盘坏了。所以两者都要，一个管预览、一个管提交。 */    
        /* 颜色行。⚠ **松手才生效**，且**绝不能在这里用 hook**。    
           React 18 的 onChange 内部映射到原生 input 事件，<input type=color> 拖动时    
           会连续触发 input（每秒数十次）。每次写 store → 重写 tokens.css →    
           全页样式重算 + 重排，这就是「切换颜色很卡」的原因。    
           所以：onInput 只写本地 draft（预览），原生 change 才落库。    
        
           ⚠⚠ 上一版在这里用了 React.useRef/useEffect 挂原生监听，    
           导致整个界面白屏。原因：bgRow 只在「背景颜色」TAB 激活时被调用    
           （tabBg 是条件渲染的子树），切进/切出该 TAB 会让 hook 数量变化 N → N+8 → N，    
           React 检测到 hook 数量不一致 → 整棵组件树抛错崩溃。    
           **hook 不能出现在条件渲染的子树里。**    
        
           正确做法：不用 hook。用 **onChangeCapture 事件委托** ——    
           把原生 change 的处理集中到根节点上，靠事件冒泡拿到具体 input。    
           既没有 hook，也不依赖 ref，且只在松手时触发一次。 */    
        function bgRow(item) {    
          return h('div', { className: 'pus-bgrow' },    
            h('div', { className: 'pus-bglabel' },    
              h('span', null, item.label),    
              h('code', null, item.id.replace('--dsw-alias-', ''))),    
            ['light', 'dark'].map(function (mode) {    
              var key = item.id + '::' + mode;    
              var cur = (p.bg[mode] || {})[item.id];    
              var draft = bgDraft[key];    
              return h('label', { key: mode, className: 'pus-bgcell' },    
                h('span', { className: 'pus-bgmode' }, mode === 'light' ? '浅色' : '深色'),    
                h('input', {    
                  type: 'color', className: 'pus-color',    
                  /* 事件委托用的标识：值里带令牌 id 与模式，根节点按它落库 */    
                  'data-bg-token': item.id,    
                  'data-bg-mode': mode,    
                  /* 未设置时显示真实默认值（与 theme-tokens.js 保持一致，否则色块会骗人） */    
                  value: draft || cur || (mode === 'light' ? '#ffffff' : '#0f1519'),    
                  /* 拖动中：只写 draft 做预览，不碰 store（因此不重写 CSS、不重排） */    
                  onInput: function (e) { bgDraft[key] = e.target.value; },    
                }),    
                h('button', {    
                  type: 'button', className: 'pus-clear', disabled: !cur,    
                  title: cur ? '恢复主题默认' : '当前用主题默认值',    
                  onClick: function () {    
                    /* 清除这一条：既要删预览，也要取消还没执行的尾部落库，    
                       否则 400ms 后 setBg 会把刚清掉的颜色又写回去。 */    
                    delete bgDraft[key];    
                    delete bgSubmitAt[key];    
                    if (bgSubmitLater[key]) { try { clearTimeout(bgSubmitLater[key]) } catch (e) { /* 已执行 */ } delete bgSubmitLater[key]; }    
                    store.setBg(mode, item.id, '');    
                  },    
                }, '清除'));    
            }));    
        }    
        
        /* 推荐卡的渲染：状态机 idle → install（安装/更新）→ done / error。    
           已装时按钮是「更新」（有可安装的新版本）或「重装」，标题旁显示当前版本号。 */    
        function recCard(item) {    
          var st = recGet(item.name);    
          var phase = st.phase || 'idle';    
          var busy = phase === 'install';    
          var installed = phase === 'done';    
          var canUpdate = installed && st.canUpdate === true && !!st.latest;    
          var btnText = busy ? (st.busyLabel || '安装中…')    
            : (installed ? (canUpdate ? '更新' : '重装') : '安装');    
        
          return h('div', { className: 'pus-rec', key: item.name },    
            h('div', { className: 'pus-rec-main' },    
              h('div', { className: 'pus-rec-head' },    
                h('span', { className: 'pus-rec-title' }, item.title),    
                item.tag ? h('span', { className: 'pus-rec-tag' }, item.tag) : null,    
                installed    
                  ? h('span', { className: 'pus-rec-badge' }, '已安装' + (st.version ? ' v' + st.version : ''))    
                  : null),    
              h('code', { className: 'pus-rec-pkg' }, item.name),    
              h('div', { className: 'pus-rec-desc' }, item.desc),    
              /* note：兼容性等前置条件（例如引擎版本门槛），不装也能先看到 */    
              item.note ? h('div', { className: 'pus-rec-note' }, item.note) : null,    
              st.msg    
                ? h('div', { className: 'pus-rec-msg' + ((phase === 'error' || st.err) ? ' is-err' : '') }, st.msg)    
                : null),    
            h('button', {    
              type: 'button',    
              className: 'pus-rec-btn' + (installed ? ' is-done' : '') + (canUpdate ? ' is-update' : ''),    
              disabled: busy,    
              onClick: function () {    
                if (busy) return;    
                if (canUpdate) updateRecommended(item);    
                else installRecommended(item);    
              },    
            }, btnText));    
        }    
        
        /* ---------- TAB 内容 ---------- */    
        function tabSwitches() {    
          return h('div', { key: 't-switches' },    
            h('div', { className: 'pus-tip' }, '这些是本插件自带功能的开关，关掉即从界面移除，配置保留。'),    
            row('balance', '余额查询', '侧栏底部的余额按钮与浮层，数据来自真实账户接口。'),    
            row('actions', '运行 Action', '会话头部的一键命令按钮：保存常用命令并在当前工作区执行。'),    
            row('deleteSession', '删除会话', '会话右键菜单里的「删除会话」，以及右键直接打开会话菜单。'),    
            row('modelStyle', '模型修改样式', '把输入框的模型选择器改成两行（强度 + 模型名），并提供推理强度滑块。关掉即恢复宿主原生单行样式。'),    
            row('skillMarket', '技能市场', '侧栏的技能市场入口与面板（浏览 / 安装 SkillHub 技能）。'),    
            row('hideSidebarMore', '隐藏侧栏「更多」', '把侧栏面板列表里的「更多」按钮收起。收起后该面板入口不再显示，其它入口不受影响。'),    
            /* 这条说明只属于「插件开关」这个 TAB（讲开关的语义边界），    
               放在 TAB 面板内部，切到背景颜色/插件推荐时不显示。 */    
            h('div', { className: 'pus-note2' },    
              '说明：技能市场开关控制的是界面入口。它在本插件内的网络代理与已安装技能不受影响 ——',    
              ' 若要彻底停用，请在插件管理里停用整个插件。'));    
        }    
        
        function tabBg() {    
          return h('div', { key: 't-bg' },    
            h('div', { className: 'pus-tip' },    
              '自定义值叠加在本插件主题之上；留空即用主题默认值。只改背景，不动文字与品牌色。'),    
            BG_KEYS.map(bgRow),    
            /* 只保留「重置背景为默认」。    
               按用户要求：恢复全部默认（连各功能开关一起清）不需要 ——    
               这个 TAB 的职责就是调背景，跨作用域地清开关会让人意外。    
               重置时先清预览与待提交定时器，否则色块不会跟着回默认。 */    
            h('div', { className: 'pus-foot' },    
              h('button', {    
                type: 'button', className: 'pus-btn',    
                onClick: function () { clearBgDrafts(); store.set({ bg: { light: {}, dark: {} } }); },    
              }, '重置背景为默认')));    
        }    
        
        function tabPlugins() {    
          return h('div', { key: 't-plugins' },    
            selfUpdatePanel(),    
            h('div', { className: 'pus-tip' },    
              '配合本插件更好用的独立插件。点按钮会直接调宿主插件管理器安装，不用手动下载；已装的会显示版本。'),    
            RECOMMEND.map(function (cat) {    
              return h('div', { className: 'pus-cat', key: cat.cat },    
                h('div', { className: 'pus-cat-name' }, cat.cat),    
                cat.items.map(recCard));    
            }));    
        }    
        
        /* ---------- 广告（推广）TAB ----------    
           三种类型：text（本地文案）/ github（GitHub HTML）/ url（白名单 HTML）。    
           远程类型经 Host 代理拉取，放进 sandbox iframe（无 allow-scripts）渲染 ——    
           远程脚本无法接触宿主上下文。 */    
        function promoBodyOf(n) {    
          /* text 类型：本地文案 */    
          if (!n.type || n.type === 'text') {    
            return h('div', { key: 'body' },    
              n.subtitle ? h('div', { className: 'pus-promo-sub' }, n.subtitle) : null,    
              n.body ? h('div', { className: 'pus-promo-body' }, n.body) : null,    
              n.items && n.items.length    
                ? h('ul', { className: 'pus-promo-list' },    
                    n.items.map(function (it, k) { return h('li', { key: k }, it); }))    
                : null);    
          }    
        
          /* 远程类型：先看状态 */    
          var st = promoRemote[n.id] || { phase: 'idle' };    
          if (st.phase === 'idle') loadPromoRemote(n);    
          if (st.phase === 'loading' || st.phase === 'idle') {    
            return h('div', { key: 'body', className: 'pus-promo-remote-msg' }, '正在加载远程内容…');    
          }    
          if (st.phase === 'error') {    
            return h('div', { key: 'body', className: 'pus-promo-remote-err' }, st.msg || '加载失败');    
          }    
        
          /* ok：sandbox iframe 渲染。    
             ⚠ 安全要点：**不给 allow-scripts**，也不给 allow-same-origin ——    
             两个一起给等于没有沙箱。这样远程 HTML 里的脚本不会执行，    
             更不可能拿到宿主的 window / localStorage / Cordis 上下文。    
             srcdoc 直接注入文本，不写文件、不留盘。 */    
          var frame = h('iframe', {    
            key: 'frame',    
            className: 'pus-promo-frame',    
            title: n.title || '推广内容',    
            sandbox: 'allow-popups',   /* 只允许弹窗（点链接开新页），禁止脚本 */    
            referrerpolicy: 'no-referrer',    
            srcDoc: st.html || '',    
            /* 铺满模式：不写死高度，由外层 flex 分配剩余空间。    
               保留 n.height 作为**最小高度**兜底，避免内容太少时塌成一条。 */    
            /* ⚠ iframe 有规范默认值 height:150px，单靠 CSS flex 压不过它 ——    
               必须**行内显式 height:100%** 才能让内容真正铺满容器。 */    
            /* ⚠ 关键修正：铺满模式**不再**写 height:100%。    
               height:100% 会让 iframe 占满父级，而父级高度由 flex 撑开，    
               于是「内容 < 容器」时 iframe 仍等于容器高，一旦内容略超就出滚动条。    
               改为让 flex 决定实际高度，minHeight 只做兜底。 */    
            style: n.fill === false    
              ? { height: (n.height || 200) + 'px' }    
              /* 铺满模式不再设 minHeight：它是硬下限，会阻止 flex 收缩，    
                 空间不足时把父级顶破产生滚动条。高度完全交给 flex。 */    
              : { flex: '1 1 auto', minHeight: 0 },    
          });    
        
          var meta = (n.showMeta !== false && (st.sha || st.date)) ? h('div', { key: 'meta', className: 'pus-promo-meta' },    
            st.cached ? h('span', { className: 'pus-promo-cache' }, '缓存') : null,    
            st.elapsedMs !== undefined ? h('span', { className: 'pus-promo-sha' }, st.elapsedMs + 'ms') : null,    
            st.sha ? h('span', { className: 'pus-promo-sha' }, '提交 ' + st.sha.slice(0, 7)) : null,    
            st.date ? h('span', { className: 'pus-promo-sha' }, st.date.slice(0, 16).replace('T', ' ')) : null,    
            st.bytes ? h('span', { className: 'pus-promo-sha' }, Math.round(st.bytes / 1024) + ' KB') : null,    
            st.message ? h('span', { className: 'pus-promo-cmsg' }, st.message.split('\n')[0].slice(0, 80)) : null    
          ) : null;    
        
          /* ⚠ 这个包装 div 是 flex 链的关键一环：    
             没有它撑开，iframe 的 flex:1 找不到父容器，广告内容就不会铺满。 */    
          return h('div', {    
            key: 'body',    
            className: 'pus-promo-body-wrap'    
              + (n.fill === false ? '' : ' is-fill'),    
          }, frame, meta);    
        }    
        
        function tabPromos() {    
          /* 推广不可关闭：直接渲染 PROMOS 全部内容（无 hidden 过滤）。    
             铺满：外层 .pus-promos-fill 是 flex 列，卡片与 iframe 逐级 flex:1。 */    
          return h('div', { key: 't-promos', className: 'pus-promos-fill' },    
            /* 说明文字已按用户要求移除：这一行不是推广内容的一部分。 */    
            PROMOS.map(function (n) {    
              return h('div', {    
                key: n.id,    
                className: 'pus-promo'    
                  + (n.pinned ? ' is-pinned' : '')    
                  + (n.fill === false ? '' : ' is-fill'),    
              },    
                h('div', { className: 'pus-promo-main' + (n.fill === false ? '' : ' is-fill') },    
                  h('div', { className: 'pus-promo-head' },    
                    n.pinned ? h('span', { className: 'pus-promo-pin' }, '置顶') : null,    
                    h('span', { className: 'pus-promo-title' }, n.title),    
                    n.tag ? h('span', { className: 'pus-promo-tag' }, n.tag) : null,    
                    /* 类型徽标（GitHub / URL）按用户要求移除；× 关闭按钮也已移除。 */    
                    n.date ? h('span', { className: 'pus-promo-date' }, n.date) : null),    
                  promoBodyOf(n)));    
            }));    
        }    
        
        var TABS = [    
          { id: 'switches', label: '插件开关', render: tabSwitches },    
          { id: 'bg', label: '背景颜色', render: tabBg },    
          { id: 'plugins', label: '插件推荐', render: tabPlugins },    
          { id: 'promos', label: '广告', render: tabPromos },    
        ];    
        var act = TABS.filter(function (t) { return t.id === tab; })[0] || TABS[0];    
        
        return h('div', {    
          className: 'pus-page',    
          /* 广告 TAB 要铺满：去掉 760px 上限 + 高度撑满。    
             宿主 .options 是 grid item（minmax(0,1fr)）且有确定高度，    
             所以这里用 height:100% 是可靠的（flex:1 在块级上下文不生效）。 */    
          'data-wide': act.id === 'promos' ? '1' : '0',    
        },    
          note ? h('div', { className: 'pus-note' }, note) : null,    
        
          /* TAB 栏 */    
          h('div', { className: 'pus-tabs', role: 'tablist' },    
            TABS.map(function (t) {    
              return h('button', {    
                key: t.id, type: 'button', role: 'tab',    
                'aria-selected': t.id === act.id ? 'true' : 'false',    
                className: 'pus-tab' + (t.id === act.id ? ' is-on' : ''),    
                onClick: function () { setTab(t.id); },    
              }, t.label);    
            })),    
        
          /* TAB 面板。    
             ⚠ 这里挂 onChangeCapture 做**事件委托**：颜色输入的「松手提交」统一在    
             这一层处理，而不是在 bgRow 里用 hook 挂原生监听。    
             原因见 bgRow 的注释：bgRow 属于条件渲染子树，在里面用 hook 会因    
             切 TAB 时 hook 数量变化而让 React 崩掉整个界面。    
             这层（Section 根）hook 数量恒定，且事件冒泡能覆盖所有 TAB 内容。    
        
             ⚠ React 的 onChangeCapture 与 onChange 一样，在内部都走 input 事件，    
             拿不到原生 change（e.type 已被归一化）。所以这里不用「事件类型」区分，    
             改用**时间戳去抖**：拖动时 input 持续触发，每 400ms 才落库一次；    
             停手 400ms 后必然落库，保证最终值正确。    
             这样既不会崩（无 hook），也不会卡（拖动期间最多 2-3 次写库，    
             而不是每秒数十次）。 */    
          h('div', {    
            className: 'pus-panel', role: 'tabpanel', 'data-tab': act.id,    
            onChangeCapture: function (e) {    
              var t = e && e.target;    
              if (!t || t.type !== 'color') return;    
              var token = t.getAttribute && t.getAttribute('data-bg-token');    
              var mode = t.getAttribute && t.getAttribute('data-bg-mode');    
              if (!token || !mode) return;    
              var v = t.value;    
              var key = token + '::' + mode;    
              bgDraft[key] = v;                       /* 先记预览，色块跟着动 */    
              /* 去抖：同一令牌 400ms 内只提交一次 */    
              var now = Date.now();    
              var slot = bgSubmitAt[key];    
              if (slot && now - slot < 400) {    
                /* 拖动中：安排一次尾部落库，确保停手后最终值不丢 */    
                if (!bgSubmitLater[key]) {    
                  bgSubmitLater[key] = setTimeout(function () {    
                    delete bgSubmitLater[key];    
                    bgSubmitAt[key] = Date.now();    
                    store.setBg(mode, token, bgDraft[key] || v);    
                  }, 400);    
                }    
                return;    
              }    
              bgSubmitAt[key] = now;    
              store.setBg(mode, token, v);    
            },    
          }, act.render()));    
      }    
        
      var CSS = [    
        /* ---- 隐藏侧栏「更多」按钮（开关：hideSidebarMore）----    
           宿主结构（asar 内 dsh-client-ui-sidebar 确证）：    
             div.<hash>_moreAnchor    
               └─ button.panelRow[aria-label="更多"][aria-haspopup="menu"]    
                    └─ span.<hash>_panelGlyph + span.<hash>_panelTitle    
           用 [class*="moreAnchor"] 而非精确类名：宿主构建期哈希前缀    
           （wtg9ga_ / AnXs9G_ 之类）每次升级都可能变，子串匹配更耐久。    
           html[data-pus-hide-more] 由下方 syncMore() 按 store 写入。 */    
        'html[data-pus-hide-more] div[class*="moreAnchor"]{display:none !important}',    
        /* 兜底：万一 moreAnchor 类名结构变了，用语义属性再兜一层。    
           :has() 在 Chromium 105+ 可用；不支持时这条静默失效，不影响上一条。 */    
        'html[data-pus-hide-more] button[aria-haspopup="menu"]:has(> span[class*="panelGlyph"]):has(> span[class*="panelTitle"]){display:none !important}',    
        'html[data-pus-hide-more] div:has(> button[aria-label="更多"][aria-haspopup="menu"]){display:none !important}',    
        /* 下内边距改为 0（用户要求）。简写顺序为上/左右/下：4px 2px 0 */    
        '.pus-page{padding:4px 2px 0;max-width:760px}',    
        /* 宿主设置面板容器：**只**把下内边距设为 0（用户要求）。    
           ⚠ 刻意只写 padding-bottom 而非 padding ——    
             写 padding:0 会把左右 24px 一起去掉，导致账号与余额 / 通用设置 /    
             模型等所有宿主设置页贴边（上次已踩过这个坑）。    
           ⚠ AnXs9G_ 是宿主构建期哈希前缀，宿主升级换哈希后本条静默失效。 */    
        '.AnXs9G_options{padding-bottom:0 !important}',    
        /* 广告 TAB 允许铺满可用宽度，不再受 760px 限制 */    
        /* 铺满模式：左右边距归零（用户要求），只留上下少量呼吸空间 */    
        /* 高度自适应（用户要求）：不再 height:100% 撑满宿主容器。    
           页面高度 = TAB 栏 + 面板的实际高度，底部不再留空白。 */    
        '.pus-page[data-wide="1"]{max-width:none;display:flex;flex-direction:column}',    
        /* ---------- TAB 栏 ---------- */    
        '.pus-tabs{display:flex;gap:4px;margin:4px 0 14px;padding-bottom:2px;',    
        'border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}',    
        '.pus-tab{position:relative;padding:7px 14px;border:none;background:transparent;cursor:pointer;',    
        'font:inherit;font-size:12.5px;color:var(--dsw-alias-label-secondary,#5c6b68);',    
        'border-radius:8px 8px 0 0;transition:color .14s ease,background-color .14s ease}',    
        '.pus-tab:hover{background:rgba(0,0,0,.035);color:inherit}',    
        '.pus-tab.is-on{color:var(--dsw-alias-brand-primary,#209a72);font-weight:600}',    
        '.pus-tab.is-on::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:2px;',    
        'background:var(--dsw-alias-brand-primary,#209a72);border-radius:2px}',    
        'body[data-ds-dark-theme] .pus-tabs{border-bottom-color:rgba(255,255,255,.12)}',    
        'body[data-ds-dark-theme] .pus-tab:hover{background:rgba(255,255,255,.06)}',    
        /* 540px 是**上限**不是固定值：空间不足时自动缩小，避免撑出滚动条 */    
        '.pus-panel{padding-top:4px;max-height:540px}',    
        /* 铺满模式：面板给**确定高度** 540px。    
           为什么要确定值：页面已改 height:auto，若这里再用 flex 自适应，    
           整条链没有确定高度，iframe 的 flex:1 会塌成 0（白屏）。    
           540px 同时兼作上限，内容再高也不超过它。 */    
        '.pus-page[data-wide="1"] .pus-panel{height:540px;max-height:540px;flex:none;display:flex;flex-direction:column;overflow:hidden}',    
        '.pus-group{margin:18px 0 8px;font-size:11px;font-weight:600;letter-spacing:.04em;',    
        'text-transform:uppercase;color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-row{display:flex;align-items:center;gap:14px;padding:10px 12px;border-radius:12px;',    
        'background:var(--dsw-alias-bg-layer-2,#f4faf7)}',    
        '.pus-row+.pus-row{margin-top:6px}',    
        '.pus-row-main{flex:1;min-width:0}',    
        '.pus-row-label{font-size:12.5px;font-weight:500}',    
        '.pus-row-desc{margin-top:2px;font-size:11.5px;line-height:1.5;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-switch{flex:none;width:38px;height:22px;border-radius:999px;border:none;cursor:pointer;',    
        'background:rgba(0,0,0,.16);position:relative;padding:0;transition:background-color .16s ease}',    
        '.pus-switch-on{background:var(--dsw-alias-brand-primary,#209a72)}',    
        '.pus-knob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;',    
        'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .16s ease}',    
        '.pus-switch-on .pus-knob{transform:translateX(16px)}',    
        'body[data-ds-dark-theme] .pus-switch{background:rgba(255,255,255,.18)}',    
        'body[data-ds-dark-theme] .pus-switch-on{background:#3ddc97}',    
        '.pus-bgrow{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:12px;',    
        'background:var(--dsw-alias-bg-layer-2,#f4faf7)}',    
        '.pus-bgrow+.pus-bgrow{margin-top:6px}',    
        '.pus-bglabel{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',    
        '.pus-bglabel code{font-size:10.5px;color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-bgcell{display:flex;align-items:center;gap:6px}',    
        '.pus-bgmode{font-size:11px;color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-color{width:30px;height:24px;padding:0;border:1px solid rgba(0,0,0,.14);border-radius:6px;',    
        'background:transparent;cursor:pointer}',    
        'body[data-ds-dark-theme] .pus-color{border-color:rgba(255,255,255,.2)}',    
        '.pus-clear{height:22px;padding:0 8px;border-radius:6px;border:1px solid rgba(0,0,0,.12);',    
        'background:transparent;color:inherit;font-size:11px;cursor:pointer}',    
        '.pus-clear:hover{background:rgba(0,0,0,.05)}',    
        '.pus-clear:disabled{opacity:.45;cursor:default}',    
        'body[data-ds-dark-theme] .pus-clear{border-color:rgba(255,255,255,.18)}',    
        '.pus-tip{margin:6px 0 10px;font-size:11.5px;line-height:1.6;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-note{margin:8px 0;padding:7px 10px;border-radius:8px;font-size:11.5px;',    
        'background:rgba(32,154,114,.12);color:#1b8462}',    
        '.pus-note2{margin-top:16px;font-size:11px;line-height:1.6;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-flash{margin:8px 0;padding:7px 10px;border-radius:8px;font-size:11.5px;',    
        'background:rgba(198,40,40,.12);color:#c62828}',    
        /* ---------- 插件推荐 ---------- */    
        '.pus-cat{margin-bottom:10px}',    
        '.pus-cat-name{margin:0 0 6px;font-size:11.5px;font-weight:600;',    
        'color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        '.pus-rec{display:flex;align-items:flex-start;gap:12px;padding:11px 12px;border-radius:12px;',    
        'background:var(--dsw-alias-bg-layer-2,#f4faf7)}',    
        '.pus-rec+.pus-rec{margin-top:6px}',    
        '.pus-rec-main{flex:1;min-width:0}',    
        '.pus-rec-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',    
        '.pus-rec-title{font-size:12.5px;font-weight:600}',    
        '.pus-rec-tag{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;',    
        'background:rgba(32,154,114,.14);color:#1b8462}',    
        /* 「已安装 vX.Y.Z」徽标：灰底弱化，与「推荐」标签区分开 */    
        '.pus-rec-badge{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;',    
        'background:rgba(0,0,0,.07);color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        'body[data-ds-dark-theme] .pus-rec-badge{background:rgba(255,255,255,.12);color:#c9d6d2}',    
        '.pus-rec-ver{font-size:10.5px;color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-rec-pkg{margin-top:2px;font-size:10.5px;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-rec-desc{margin-top:4px;font-size:11.5px;line-height:1.55;',    
        'color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        '.pus-rec-msg{margin-top:5px;font-size:11px;line-height:1.5;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-rec-msg.is-err{color:#c62828}',    
        /* 前置条件提示（引擎版本等）：淡黄底，提醒但不喧宾夺主 */    
        '.pus-rec-note{margin-top:5px;padding:2px 7px;border-radius:5px;display:inline-block;',    
        'font-size:10.5px;line-height:1.5;background:rgba(232,131,12,.12);color:#a15c00}',    
        'body[data-ds-dark-theme] .pus-rec-note{background:rgba(232,131,12,.18);color:#f0a94a}',    
        '.pus-rec-btn{flex:none;align-self:center;height:28px;padding:0 14px;border-radius:8px;',    
        'border:1px solid var(--dsw-alias-brand-primary,#209a72);cursor:pointer;font-size:12px;font-weight:600;',    
        'background:var(--dsw-alias-brand-primary,#209a72);color:#fff}',    
        '.pus-rec-btn:hover{opacity:.9}',    
        '.pus-rec-btn:disabled{opacity:.55;cursor:default}',    
        '.pus-rec-btn.is-done{background:transparent;color:var(--dsw-alias-brand-primary,#209a72)}',    
        /* 可更新时按钮转成实心强调色，和「重装」的描边态区分开 */    
        '.pus-rec-btn.is-done.is-update{background:var(--dsw-alias-brand-primary,#209a72);color:#fff}',    
        /* ---------- 检测全部插件更新 ---------- */    
        '.pus-upd{margin:0 0 12px;padding:10px 12px;border-radius:12px;',    
        'background:var(--dsw-alias-bg-layer-2,#f4faf7);',    
        'border:1px solid rgba(32,154,114,.22)}',    
        '.pus-upd-head{display:flex;align-items:flex-start;gap:12px}',    
        '.pus-upd-main{flex:1;min-width:0}',    
        '.pus-upd-title{font-size:12.5px;font-weight:600}',    
        '.pus-upd-sub{margin-top:3px;font-size:11px;line-height:1.55;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-upd-sub.is-err{color:#c62828}',    
        '.pus-upd-list{margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,.07)}',    
        'body[data-ds-dark-theme] .pus-upd-list{border-top-color:rgba(255,255,255,.12)}',    
        '.pus-upd-row{display:flex;align-items:center;gap:10px}',    
        '.pus-upd-row+.pus-upd-row{margin-top:6px}',    
        '.pus-upd-row.is-clean{opacity:.72}',    
        '.pus-upd-rowmain{flex:1;min-width:0}',    
        '.pus-upd-name{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;',    
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',    
        '.pus-upd-kind{flex:none;padding:1px 5px;border-radius:4px;font-size:9.5px;font-weight:600;',    
        'background:rgba(0,0,0,.07);color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        'body[data-ds-dark-theme] .pus-upd-kind{background:rgba(255,255,255,.12);color:#c9d6d2}',    
        '.pus-upd-note{margin-top:2px;font-size:11px;line-height:1.5;',    
        'color:var(--dsw-alias-label-secondary,#8f959e);word-break:break-all}',    
        '.pus-upd-note.is-err{color:#c62828}',    
        /* ---------- 广告（推广）位 ---------- */    
        /* ---------- 广告 TAB 铺满 ----------    
           TAB 面板高度由宿主的 .pus-panel 决定；这里让整条链    
           （tabPromos → .pus-promos-fill → .pus-promo.is-fill → iframe）全部    
           flex:1 撑满，去掉说明文字与底部按钮腾出的空间也一并利用。 */    
        '.pus-promos-fill{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1 1 auto;height:100%}',    
        /* 说明文字占位是 flex:none，不参与拉伸 */    
        '.pus-promos-fill > .pus-tip{flex:none}',    
        /* ⚠ .pus-promo 基础规则是 align-items:flex-start（子元素贴顶不撑高）。    
           两条规则特异性相同，靠书写顺序取胜不够稳 —— 这里同时提升特异性    
           （.pus-promo.is-fill 已高于 .pus-promo）并显式写死 stretch。 */    
        /* 铺满模式卡片内边距为 0（用户要求）：让内容完全贴边。    
           ⚠ 特异性：.pus-promo.is-fill 高于 .pus-promo（后者 padding:13px），    
             且本条写在 .pus-promo 基础规则**之前**也能生效 ——    
             因为「两个类」比「一个类」特异性高，与顺序无关。 */    
        '.pus-promo.is-fill{flex:1 1 auto;min-height:0;align-items:stretch;padding:0}',    
        /* 双保险：直接命中卡片内的 main，不依赖父级 align-items 是否正确继承 */    
        '.pus-promo.is-fill > .pus-promo-main{display:flex;flex-direction:column;min-height:0;flex:1 1 auto;align-self:stretch}',    
        '.pus-promo.is-fill .pus-promo-main.is-fill{display:flex;flex-direction:column;min-height:0;flex:1}',    
        /* 铺满时 iframe 是主体：给它剩余空间、无外边距、圆角贴合卡片 */    
        /* 包装 div：flex 列，撑满 main，iframe 在其中拉伸 */    
        '.pus-promo-body-wrap.is-fill{display:flex;flex-direction:column;min-height:0;flex:1}',    
        /* meta 是固定高度，不能跟着拉伸 */    
        '.pus-promo-body-wrap.is-fill .pus-promo-meta{flex:none}',    
        /* 上下边距为 0（用户要求）：让 iframe 紧贴标题行与卡片边缘 */    
        '.pus-promo.is-fill .pus-promo-frame{margin:0;flex:1 1 auto;min-height:0;border-radius:10px}',    
        /* iframe 自身也要 100% 高，双保险（有的宿主给 iframe 默认 height:150px） */    
        /* min-height:0 关键：flex item 默认 min-height:auto，    
           会被 iframe 的规范默认 150px 顶住，导致永远长不到容器高度。 */    
        /* 不再写 height:100%：让 flex 决定高度，只在内容确实需要时撑开 */    
        /* 头部保留（用户明确要求标题可见），但它不参与拉伸 —— flex:none */    
        '.pus-promo.is-fill .pus-promo-head{flex:none}',    
        '.pus-promo{display:flex;align-items:flex-start;gap:10px;padding:13px;border-radius:12px;',    
        'background:linear-gradient(180deg,rgba(32,154,114,.055),rgba(32,154,114,.02));',    
        'border:1px solid rgba(32,154,114,.18)}',    
        '.pus-promo+.pus-promo{margin-top:8px}',    
        '.pus-promo.is-pinned{border-left:3px solid var(--dsw-alias-brand-primary,#209a72)}',    
        'body[data-ds-dark-theme] .pus-promo{background:rgba(61,220,151,.055);',    
        'border-color:rgba(61,220,151,.22)}',    
        '.pus-promo-main{flex:1;min-width:0}',    
        /* 垂直居中：align-items 让内部子项（标题/标签）在行内居中，    
           再给上下对称内边距，让整行在卡片里视觉居中而不是贴顶。 */    
        '.pus-promo-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0}',    
        '.pus-promo-pin{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;',    
        'background:var(--dsw-alias-brand-primary,#209a72);color:#fff}',    
        /* 标题左移 12px：卡片内边距为 0 后标题会贴边，加一点呼吸空间 */    
        '.pus-promo-title{font-size:13px;font-weight:600;margin-left:12px}',    
        '.pus-promo-tag{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;',    
        'background:rgba(32,154,114,.16);color:#1b8462}',    
        'body[data-ds-dark-theme] .pus-promo-tag{background:rgba(61,220,151,.18);color:#9ff0cd}',    
        '.pus-promo-date{margin-left:auto;font-size:10.5px;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-promo-sub{margin-top:4px;font-size:11.5px;font-weight:500;',    
        'color:var(--dsw-alias-brand-primary,#209a72)}',    
        '.pus-promo-body{margin-top:5px;font-size:11.5px;line-height:1.65;',    
        'color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        '.pus-promo-list{margin:6px 0 0;padding-left:18px;font-size:11.5px;line-height:1.7;',    
        'color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        '.pus-promo-list li{margin:0}',    
        /* ---------- 远程推广内容（GitHub / URL） ---------- */    
        '.pus-promo-type{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;',    
        'background:rgba(0,0,0,.07);color:var(--dsw-alias-label-secondary,#5c6b68)}',    
        'body[data-ds-dark-theme] .pus-promo-type{background:rgba(255,255,255,.12);color:#c9d6d2}',    
        '.pus-promo-remote-msg{margin-top:8px;padding:18px;text-align:center;border-radius:8px;',    
        'font-size:11.5px;color:var(--dsw-alias-label-secondary,#8f959e);',    
        'background:var(--dsw-alias-bg-layer-2,#f4faf7)}',    
        '.pus-promo-remote-err{margin-top:8px;padding:10px 12px;border-radius:8px;font-size:11.5px;',    
        'line-height:1.55;background:rgba(198,40,40,.10);color:#c62828}',    
        /* iframe：远程 HTML 的沙箱容器（禁用脚本，避免污染宿主） */    
        '.pus-promo-frame{display:block;width:100%;margin:0;border:1px solid rgba(0,0,0,.10);',    
        'border-radius:8px;background:#fff}',    
        'body[data-ds-dark-theme] .pus-promo-frame{border-color:rgba(255,255,255,.14)}',    
        '.pus-promo-cache{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;',    
        'background:rgba(32,154,114,.14);color:#1b8462}',    
        'body[data-ds-dark-theme] .pus-promo-cache{background:rgba(61,220,151,.18);color:#9ff0cd}',    
        '.pus-promo-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;',    
        'font-size:10.5px;color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-promo-cmsg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',    
        'background:transparent;color:var(--dsw-alias-label-secondary,#8f959e);',    
        'font-size:15px;line-height:1;cursor:pointer}',    
        '.pus-promo-foot{margin-top:14px}',    
        '.pus-empty{padding:28px 16px;text-align:center;border-radius:12px;',    
        'background:var(--dsw-alias-bg-layer-2,#f4faf7)}',    
        '.pus-empty-title{font-size:13px;font-weight:600}',    
        '.pus-empty-desc{margin:6px 0 14px;font-size:11.5px;line-height:1.6;',    
        'color:var(--dsw-alias-label-secondary,#8f959e)}',    
        '.pus-foot{margin-top:16px;display:flex;gap:8px}',    
        '.pus-btn{height:28px;padding:0 14px;border-radius:8px;border:1px solid rgba(0,0,0,.12);',    
        'background:transparent;color:inherit;font-size:12px;cursor:pointer}',    
        '.pus-btn:hover{background:rgba(0,0,0,.05)}',    
        'body[data-ds-dark-theme] .pus-btn{border-color:rgba(255,255,255,.18)}',    
      ].join('\n');    
        
      return {    
        store: store,    
        /* 设置页注册：官方整页座位 */    
        install: function (c) {    
          var offs = [];    
          /* ⚠ 首屏同步：必须在注入 <style> **之前**设置属性。    
             属性已在、样式一到即生效 → 用户看不到「更多」闪一下再消失。    
             syncSidebarMore 在工厂体内定义，此处已可访问。 */    
          try { syncSidebarMore(); } catch (e) { /* 静默 */ }    
          if (typeof document !== 'undefined') {    
            var id = PU_PLUGIN_ID + '/settings.css';    
            var tag = document.querySelector('style[data-plugin-css="' + id + '"]');    
            if (!tag) {    
              tag = document.createElement('style');    
              tag.dataset.plugin = PU_PLUGIN_ID;    
              tag.dataset.pluginCss = id;    
              tag.textContent = CSS;    
              document.head.appendChild(tag);    
            }    
            offs.push(function () { try { tag.remove(); } catch (e) { /* 已移除 */ } });    
          }    
          offs.push(c.slots.inject('settings.section', function () {    
            return c.slots.register(    
              { name: 'settings.section', id: 'dsh-perfect-ui.settings', order: 650,    
                label: function () { return '橘小黑工作台'; } },    
              Section);    
          }));    
          return function () {    
            recSubs = [];    
            for (var i = 0; i < offs.length; i++) { try { offs[i](); } catch (e) { /* 已撤销 */ } }    
          };    
        },    
      };    
    }    
    

    /* ---- CSS 单例容器 ----
       五个功能模块共用 style[data-plugin-css=".../controls.css"]。
       此前各模块「有则追加、无则新建」，而 features 是唯一在 disposer 里
       tag.remove() 的 —— 它一旦被卸载（开关重组 / 禁用启用），整个标签消失，
       其余模块的 effect 不会重跑，它们的 CSS 就永远回不来。
       现在标签由装配层独占（创建与移除都在同一个 effect），
       模块只调用 PU_ensureCss 幂等追加自己那一段。 */
    var PU_CSS_ID = PU_PLUGIN_ID + '/controls.css';
    var PU_CSS_SEEN = {};
    function PU_ensureCss(section, text) {
      if (typeof document === 'undefined') return;
      if (PU_CSS_SEEN[section]) return;
      var tag = document.querySelector('style[data-plugin-css="' + PU_CSS_ID + '"]');
      if (!tag) {
        tag = document.createElement('style');
        tag.dataset.plugin = PU_PLUGIN_ID;
        tag.dataset.pluginCss = PU_CSS_ID;
        tag.textContent = '';
        document.head.appendChild(tag);
      }
      tag.textContent = tag.textContent + '\n' + text;
      PU_CSS_SEEN[section] = true;
    }
    /* ============ S. 共享 store（内联 store.js） ============ */
    /* dsh-perfect-ui — 共享 store（消除四个模块各自手写的订阅/重渲染机制）
    
       背景：features.js / model.js / actions.js 各自维护了一份几乎逐字相同的
       「rev + listeners + useSyncExternalStore/useState 回退」。三处重复，
       每处都要单独保证：订阅正确注销、快照取原始值、退化路径一致。
       维护成本与出错面都翻倍（这轮就出现过 model 的 busy 字段写了没人读）。
    
       本文件把它们统一成 makeStore(initial)：
         · state    —— 可变的当前值（模块直接读 store.state.xxx）
         · set      —— 浅合并 + 通知（一次微任务内多次 set 只在最后一帧渲染）
         · subscribe—— 返回注销函数
         · useStore —— 组件里取快照；有 useSyncExternalStore 就用它，
                      没有则退回 useState（宿主 React 版本不确定，必须双路）
    
       放在装配层注入，三个模块都从它取，不再各写一套。
    */
    
    function PU_makeStore(React, initial) {
      'use strict';
    
      var state = Object.assign({}, initial);
      var rev = 0;
      var subs = [];
      /* 批量通知：同一帧内多次 set 只触发一次订阅回调链，
         因为订阅者里通常就是 setState —— 多次调用会多次入队。
         这里用微任务合并，React 自己的批处理也据此更省。 */
      var pending = false;
    
      function flush() {
        pending = false;
        var list = subs.slice();
        for (var i = 0; i < list.length; i++) {
          try { list[i](); } catch (e) { /* 单个订阅者失败不影响其它 */ }
        }
      }
    
      function set(patch) {
        if (!patch) return;
        Object.assign(state, patch);
        rev += 1;
        if (pending) return;
        pending = true;
        /* Promise.resolve().then 比 setTimeout(0) 更早，且不会因宏任务被节流 */
        Promise.resolve().then(flush);
      }
    
      /* 同步版：需要立即通知的场合（例如关闭面板时要马上复位 UI） */
      function setNow(patch) {
        if (!patch) return;
        Object.assign(state, patch);
        rev += 1;
        flush();
      }
    
      function subscribe(fn) {
        subs.push(fn);
        return function () { subs = subs.filter(function (f) { return f !== fn; }); };
      }
    
      function useStore() {
        if (typeof React.useSyncExternalStore === 'function') {
          return React.useSyncExternalStore(
            subscribe,
            function () { return rev; },
            function () { return rev; });
        }
        var pair = React.useState(0);
        React.useEffect(function () {
          return subscribe(function () { pair[1](function (v) { return v + 1; }); });
        }, []);
        return pair[0];
      }
    
      /* 卸载时清空订阅者，避免模块被禁用时残留闭包。
         ⚠ 只清订阅者，不重置 state —— 组件重新挂载后要拿到上一轮的
         数据（例如余额），清空 state 会让卡片闪一下"无数据"。
         也正因如此，本函数目前没有任何调用点（模块禁用时 React 会自行
         卸载组件并退订，无需外部介入）。保留是为了将来装配层需要强制
         回收闭包时有一个明确的入口 —— 若启用，调用方须确保此刻没有
         仍挂载的组件，否则那些组件的订阅会被静默丢弃而僵死。 */
      function reset() {
        subs = [];
        pending = false;
      }
    
      return {
        get: function () { return state; },
        set: set,
        setNow: setNow,
        subscribe: subscribe,
        useStore: useStore,
        reset: reset,
        rev: function () { return rev; },
      };
    }
    

    /* 三个模块各一份独立 store：它们的状态互不相干，共用实现但实例分离。 */
    var PU_store = PU_makeStore(React, { open: false, loading: false, data: null, error: null, signedOut: false, links: null, notice: '' });
    var PU_store2 = PU_makeStore(React, { open: false, btn: null, catalog: null, providerId: '', modelId: '', modelName: '', effortId: '', effortName: '', loading: false, error: '' });
    /* ============ P. 峰谷时段（内联 peak.js） ============ */
    /* dsh-perfect-ui — DeepSeek 峰谷时段计算（纯本地，无网络依赖）
    
       ---- 规则来源（官方文档确证，非猜测）----
       https://api-docs.deepseek.com/quick_start/pricing
       原文：Off-peak rates are half of the peak rates. Peak hours are
             01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday,
             excluding Chinese public holidays. All other hours are off-peak,
             including weekends and Chinese public holidays in full.
    
       换算成北京时间（UTC+8，全年无夏令时）：
         01:00-04:00 UTC -> 09:00-12:00 CST
         06:00-10:00 UTC -> 14:00-18:00 CST
       即峰时 = 工作日 09:00-12:00 与 14:00-18:00，其余全为闲时。
    
       ---- 为什么内置节假日表而不是联网取 ----
       官方规则明确「排除中国法定节假日」，若只按周末判断，在春节/国庆等
       长假期间会把整天算成峰时 —— 那是错的。但客户端插件不应在渲染路径里
       发起网络请求（拖慢、失败、隐私），所以把国家公布的放假安排内置成
       一张小表，每年更新一次即可。表覆盖 2025–2026（已公布），
       超出范围时按「仅周末+时段」降级，并在界面上注明依据。
    
       ---- 数据来源 ----
       国务院办公厅放假通知（gov.cn），经 china-holiday-calender 汇总核对。
       2025 与 2026 两张表由该 ICS 日历逐条比对生成。
    */
    
    function PU_peak(/* 无状态，纯函数集合 */) {
      'use strict';
    
      /* 法定节假日（放假当天，全天按闲时计）。
         只列「不工作的日子」；调休上班日另列 compensated。 */
      var HOLIDAYS = {
        /* 2025 */
        '2025-01-01': '元旦',
        '2025-01-28': '春节', '2025-01-29': '春节', '2025-01-30': '春节', '2025-01-31': '春节',
        '2025-02-01': '春节', '2025-02-02': '春节', '2025-02-03': '春节', '2025-02-04': '春节',
        '2025-04-04': '清明', '2025-04-05': '清明', '2025-04-06': '清明',
        '2025-05-01': '劳动节', '2025-05-02': '劳动节', '2025-05-03': '劳动节',
        '2025-05-04': '劳动节', '2025-05-05': '劳动节',
        '2025-06-02': '端午',
        '2025-10-01': '国庆', '2025-10-02': '国庆', '2025-10-03': '国庆', '2025-10-04': '国庆',
        '2025-10-05': '国庆', '2025-10-06': '国庆', '2025-10-07': '国庆', '2025-10-08': '国庆',
        /* 2026 */
        '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
        '2026-02-15': '春节', '2026-02-16': '春节', '2026-02-17': '春节', '2026-02-18': '春节',
        '2026-02-19': '春节', '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节',
        '2026-02-23': '春节',
        '2026-04-04': '清明', '2026-04-05': '清明', '2026-04-06': '清明',
        '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节',
        '2026-05-04': '劳动节', '2026-05-05': '劳动节',
        '2026-06-19': '端午', '2026-06-20': '端午', '2026-06-21': '端午',
        '2026-09-25': '中秋', '2026-09-26': '中秋', '2026-09-27': '中秋',
        '2026-10-01': '国庆', '2026-10-02': '国庆', '2026-10-03': '国庆', '2026-10-04': '国庆',
        '2026-10-05': '国庆', '2026-10-06': '国庆', '2026-10-07': '国庆',
      };
    
      /* 调休上班日（原本是周末但要点上班 → 峰时规则照常生效） */
      var COMPENSATED = {
        '2025-01-26': 1, '2025-02-08': 1, '2025-04-27': 1, '2025-05-11': 1, '2025-09-29': 1, '2025-10-12': 1,
        '2026-01-04': 1, '2026-02-14': 1, '2026-02-28': 1, '2026-05-09': 1, '2026-09-20': 1, '2026-10-10': 1,
      };
    
      /* 峰时段（北京时间，单位：分钟从 0 点起） */
      var PEAK_WINDOWS = [
        [9 * 60, 12 * 60],    /* 09:00-12:00 CST */
        [14 * 60, 18 * 60],   /* 14:00-18:00 CST */
      ];
    
      function pad(n) { return n < 10 ? '0' + n : String(n); }
      function dateKey(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      }
    
      /* 该日期是否属于「工作日」（峰时规则只在工作日生效） */
      function isWorkday(d) {
        var key = dateKey(d);
        if (COMPENSATED[key]) return true;
        if (HOLIDAYS[key]) return false;
        var wd = d.getDay();            /* 0=周日, 6=周六 */
        return wd >= 1 && wd <= 5;
      }
    
      /* 该时刻是否在峰时 */
      function isPeakAt(d) {
        if (!isWorkday(d)) return false;
        var mins = d.getHours() * 60 + d.getMinutes();
        for (var i = 0; i < PEAK_WINDOWS.length; i++) {
          if (mins >= PEAK_WINDOWS[i][0] && mins < PEAK_WINDOWS[i][1]) return true;
        }
        return false;
      }
    
      /* 从 from 起找下一个「状态翻转」的时刻（分钟精度）。
         返回 { at: Date, toPeak: bool }，找不到返回 null。
    
         两处关键点：
         ① 上限必须是「最长假期」而不是 8 天 —— 春节连续闲时可超过 8 天
            （如 2025-01-27 18:00 → 2025-02-05 09:00 间隔 12420 分钟 > 11520），
            原 8 天上限会让 nextAt 返回 null，界面上「剩余 x 时 x 分」和
            「xx 转峰时」整行信息消失。放宽到 20 天。
         ② 跳跃式扫描：峰时窗口固定在 [540,720] 和 [840,1080] 两个区间，
            所以翻转只可能发生在这些边界（540/720/840/1080）或跨日（00:00）。
            非工作日直接跳到次日 00:00；工作日内把当前分钟跳到「下一个候选边界」。
            这样无论多长的假期，循环次数都是个位数量级，不再逐分钟扫。 */
      var CANDIDATE_BOUNDARIES = [0, 540, 720, 840, 1080, 1440];  /* 分钟，1440 = 次日 00:00 */
      function nextBoundary(from) {
        var cur = new Date(from.getTime());
        var wasPeak = isPeakAt(from);
        var guard = 40;   /* 跳跃式扫描下 40 次足够跨越任何假期，纯粹防死循环 */
    
        while (guard-- > 0) {
          /* 统一按「当前日期 + 下一个候选边界」推进，天然跳过无关分钟。 */
          var mins = cur.getHours() * 60 + cur.getMinutes();
          var nextMin = 1440;
          for (var i = 0; i < CANDIDATE_BOUNDARIES.length; i++) {
            if (CANDIDATE_BOUNDARIES[i] > mins) { nextMin = CANDIDATE_BOUNDARIES[i]; break; }
          }
          var probe = new Date(cur.getTime());
          probe.setHours(0, nextMin, 0, 0);   /* nextMin=1440 会自动进位到次日 00:00 */
          /* 非工作日：峰时窗口不跨午夜，当天不可能翻转，直接跳到次日 00:00 之后。 */
          if (!isWorkday(probe) || nextMin === 1440) {
            var dayStart = new Date(cur.getTime());
            dayStart.setHours(24, 0, 0, 0);
            probe = dayStart;
            if (isPeakAt(probe) !== wasPeak) return { at: new Date(probe.getTime()), toPeak: isPeakAt(probe) };
            cur = new Date(probe.getTime());
            cur.setMinutes(cur.getMinutes() + 1);   /* 越过午夜整点，避免原地打转 */
            continue;
          }
          if (isPeakAt(probe) !== wasPeak) return { at: new Date(probe.getTime()), toPeak: isPeakAt(probe) };
          cur = new Date(probe.getTime());
        }
        return null;
      }
    
      /* 面向界面的摘要：
           { peak: bool, label: '闲时'|'峰时',
             nextAt: Date|null, nextToPeak: bool,
             remainMs: number, reason: string }
         reason 说明判定依据（节假日 / 周末 / 时段 / 超出表范围降级）。 */
      function status(now) {
        var d = now || new Date();
        var key = dateKey(d);
        var peak = isPeakAt(d);
        var nb = nextBoundary(d);
        var reason = '';
        if (HOLIDAYS[key]) reason = HOLIDAYS[key] + '假期';
        else if (COMPENSATED[key]) reason = '调休上班';
        else if (isWorkday(d)) reason = '工作日';
        else reason = d.getDay() === 0 ? '周日' : '周六';
    
        /* 表覆盖范围检查：超出则如实标注 */
        var y = d.getFullYear();
        if (y < 2025 || y > 2026) reason += '（节假日表未覆盖本年度，仅按周末判断）';
    
        return {
          peak: peak,
          label: peak ? '峰时' : '闲时',
          nextAt: nb ? nb.at : null,
          nextToPeak: nb ? nb.toPeak : false,
          reason: reason,
        };
      }
    
      /* 把毫秒差格式化成「x 小时 y 分」，不足 1 分钟显示「不足 1 分」 */
      function humanRemain(ms) {
        if (ms <= 0) return '不足 1 分';
        var totalMin = Math.floor(ms / 60000);
        if (totalMin < 1) return '不足 1 分';
        var h = Math.floor(totalMin / 60);
        var m = totalMin % 60;
        if (h <= 0) return m + ' 分';
        if (m === 0) return h + ' 小时';
        return h + ' 小时 ' + m + ' 分';
      }
    
      return {
        isWorkday: isWorkday,
        isPeakAt: isPeakAt,
        nextBoundary: nextBoundary,
        status: status,
        humanRemain: humanRemain,
        PEAK_WINDOWS: PEAK_WINDOWS,
      };
    }
    
    var PU_PEAK = PU_peak();
    /* ============ B. 功能层：真实余额（内联 features.js） ============ */
    /* features.js — 真实功能半边（由 build.js 内联进 dist/client.js 的 factory 作用域）
       ---------------------------------------------------------------------------
       只补「宿主没有、插件能真实提供」的能力，全部走已验证的 Client 服务面：
    
         remote.account.getBalance(client) / getState()   ← 账户余额真实数据
         ctx.slots.register('sidebar.footer.action', …)   ← 侧栏底部真实按钮位
         ctx.slots.register('shell.overlay', …)           ← 框架级浮层（不被列裁切）
    
       刻意不做（避免再走套壳老路）：
         · 不重画会话列表 / 输入框 / 工具流 —— 宿主已有真实组件与真实数据流；
         · 不注册 main、conversation.input.model 等 replaceRisk=shadows-shipped-ui
           的槽位 —— 那会遮蔽宿主原生 UI，用户会同时看到两套界面。
       样式只消费 --dsw-alias-* 令牌，因此自动跟随本主题与 Appearance 深浅色。
    */
    
    function PU_features(React, h) {
      'use strict';
    
      /* --------------------------- 小型外部存储 ---------------------------
         用量代理（v2.11.0）已撤除：平台网页用量接口所需的凭据插件层拿不到
         （40002 / 40003 两轮实测），因此这里不再有 usage* 字段。 */
      /* 状态走装配层注入的共享 store（store.js）：订阅、批通知、
         useSyncExternalStore 与其 useState 回退都在那里统一实现。 */
      var store = PU_store;
      var state = store.get();
      function set(patch) { store.set(patch); }
      function setNow(patch) { store.setNow(patch); }
      function subscribe(fn) { return store.subscribe(fn); }
      function useStore() { return store.useStore(); }
    
      /* --------------------------- 服务取用 ---------------------------
         拒绝原文是：cannot get property "remote.account" without inject
         注意被点名的键是 **带点的 remote.account**，不是 remote。
         上一版（2.4.1）在插件对象里声明了 inject:['theme','slots','remote','locale']，
         重启后拒绝文字逐字不变 —— 说明门面的判据不是那个数组，或者它要的是点号键。
         因此这里不再猜单一路径，而是把候选路径全部试一遍，
         并把每条路径的结果如实显示在卡片上，用事实收敛而不是再赌一次。 */
      function svc(ctx, name) {
        try {
          if (ctx && typeof ctx.get === 'function') {
            var v = ctx.get(name);
            if (v !== undefined && v !== null) return v;
          }
        } catch (e) { /* 交由调用方记录 */ }
        try { return (ctx && ctx[name]) || undefined; } catch (e) { return undefined; }
      }
    
      function errText(e) {
        if (!e) return '未知错误';
        if (typeof e === 'string') return e;
        return (e.message || String(e)) + (e.code ? ' [' + e.code + ']' : '');
      }
    
      var diag = { paths: '', methods: 'n/a' };
    
      /* 候选路径：每条返回 account 对象或抛出原因 */
      var STRATEGIES = [
        { name: 'get(remote.account)', run: function (c) { return svc(c, 'remote.account'); } },
        { name: 'get(remote).account', run: function (c) { var r = svc(c, 'remote'); return r && r.account; } },
        { name: 'ctx.inject([remote])', run: function (c) {
            if (!c || typeof c.inject !== 'function') return undefined;
            var out;
            c.inject(['remote'], function (s) { out = s && s.remote && s.remote.account; });
            return out;
          } },
        { name: 'ctx.inject([remote.account])', run: function (c) {
            if (!c || typeof c.inject !== 'function') return undefined;
            var out;
            c.inject(['remote.account'], function (s) { out = (s && (s['remote.account'] || (s.remote && s.remote.account))) || undefined; });
            return out;
          } },
      ];
    
      function probe(c) {
        var log = [];
        for (var i = 0; i < STRATEGIES.length; i++) {
          var s = STRATEGIES[i];
          try {
            var acc = s.run(c);
            if (acc && (typeof acc.getBalance === 'function' || typeof acc.getState === 'function')) {
              diag.paths = log.concat(s.name + '=HIT').join(' | ');
              
              diag.methods = ['getBalance', 'getState'].filter(function (k) { return typeof acc[k] === 'function'; }).join('+');
              return acc;
            }
            log.push(s.name + '=' + (acc ? 'no-methods' : 'empty'));
          } catch (e) {
            log.push(s.name + '=threw');
          }
        }
        diag.paths = log.join(' | ');
        
        diag.methods = 'n/a';
        return null;
      }
    
      /* AccountClientMetadata —— 权威形状取自生成的 wire schema
         （dsh-api-account-controller/lib/typert.remote-client.js:36-40）：
            z.object({
              version:               z.string(),
              locale:                z.string(),   // 仅主语言子标签决定 Platform wire locale
              timezoneOffsetSeconds: z.number(),   // 相对 UTC 秒数，向东为正
            })
         上一版发的 { clientVersion, language, utcOffsetSeconds } 三个字段名全错，
         于是 Gateway 报 wire field "client" failed boundary validation。 */
      function clientMetadata(ctx) {
        var lang = 'zh-CN';
        try {
          var loc = svc(ctx, 'locale');
          if (loc && typeof loc.getLocale === 'function') {
            var snap = loc.getLocale();
            if (snap) lang = snap.id || snap.locale || snap.language || lang;
          }
        } catch (e) { /* 语言取不到不影响请求 */ }
        var version = 'n/a';
        try { if (typeof PU_VERSION === 'string' && PU_VERSION) version = PU_VERSION; } catch (e) {}
        return {
          version: version,
          locale: lang,
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        };
      }
    
      // Remote 一元调用统一返回 RemoteResult：{ ok:true, value } | { ok:false, error }
      // 必须带超时：carrier 未就绪时调用可能永不 settle（上一版界面卡死的根因）。
      var ACCOUNT_TIMEOUT_MS = 8000;
      function unwrap(promise) {
        return Promise.resolve()
          .then(function () {
            var timer = 0;
            /* 超时定时器必须在正常返回时清掉 —— 否则每次调用都会让一个
               持有 promise/ctx/account 的闭包多活 8 秒（P2 修复）。 */
            var timeout = new Promise(function (_, rej) {
              timer = setTimeout(function () {
                rej(new Error('账户服务未在 ' + (ACCOUNT_TIMEOUT_MS / 1000) + ' 秒内响应'));
              }, ACCOUNT_TIMEOUT_MS);
            });
            return Promise.race([
              Promise.resolve(promise),
              timeout,
            ]).then(
              function (v) { if (timer) { clearTimeout(timer); timer = 0; } return v; },
              function (e) { if (timer) { clearTimeout(timer); timer = 0; } throw e; });
          })
          .then(function (res) {
            if (res && typeof res === 'object' && 'ok' in res) {
              if (res.ok) return { ok: true, value: res.value };
              var e = res.error;
              return { ok: false, error: (e && (e.message || e.code)) || '账户服务返回失败' };
            }
            return { ok: true, value: res };
          })
          .catch(function (e) { return { ok: false, error: (e && e.message) || String(e) }; });
      }
    
      /* 读取账户数据。权威端点契约（typert.remote-client.js）：
           getState()                 → { status: signed-out|credential-stored,
                                          links:{usageUrl,topUpUrl}, attempt }   （无参数）
           getBalance(client)         → null | {status:'ready',value[],bonusWallets[]}
                                        | {status:'failed'}
         所以顺序是：先 getState 判定是否登录并取回官方链接，再 getBalance 取钱包。
         getBalance 返回 null 表示「账户授权缺失或已变更」，与 status:'failed'
         （平台查询失败）是两种不同情况，界面必须分开说。
         README 原文：「失败且调用方应重试的情况以抛出的 Remote error 形式到达」
         —— 全程 try/catch，否则异常逃出事件处理器，界面停在初始空状态。 */
      function loadAccount(ctx) {
        var account = probe(ctx);
        set({ loading: true, error: null });
    
        if (!account) {
          set({ loading: false, data: null, error: '取不到账户端点。已试路径 → ' + diag.paths });
          return;
        }
    
        var stateP = (typeof account.getState === 'function')
          ? unwrap(account.getState()) : Promise.resolve({ ok: false });
    
        stateP.then(function (rs) {
          var view = rs.ok ? rs.value : null;
          if (view && view.status === 'signed-out') {
            set({ loading: false, data: null, signedOut: true, links: view.links || null,
              error: '尚未登录 DeepSeek 账户，因此没有余额可读。' });
            return;
          }
          if (typeof account.getBalance !== 'function') {
            set({ loading: false, data: null, links: (view && view.links) || null,
              error: '该装配的 remote.account 没有 getBalance（实际方法：' + diag.methods + '）' });
            return;
          }
          return unwrap(account.getBalance(clientMetadata(ctx))).then(function (rb) {
            if (!rb.ok) {
              set({ loading: false, data: null, signedOut: false,
                links: (view && view.links) || null,
                error: '余额查询调用失败：' + rb.error });
              return;
            }
            if (rb.value == null) {
              set({ loading: false, data: null, signedOut: false, links: (view && view.links) || null,
                error: '账户授权缺失或已变更（getBalance 返回 null）。请点刷新重试。' });
              return;
            }
            set({ loading: false, data: rb.value, error: null, signedOut: false, links: (view && view.links) || null });
          });
        }).catch(function (e) {
          set({ loading: false, data: null, error: '未预期的异常：' + errText(e) });
        });
      }
    
      /* ------------------------------ 用量 ------------------------------
         v2.11.0 曾在此调用本插件 Host 半边的 /api/dsh-perfect-ui.usage 代理，
         两轮实测（40002 Missing Token / 40003 invalid token）证明插件层拿不到
         平台网页用量接口所需的凭据，Host 代理已撤除（见 index.js 的结论记录）。
         因此这里不再发任何用量请求：四宫格回落到入口形态，
         点击打开宿主 getState().links.usageUrl（平台用量页，支持按日期筛选），
         并在提示行指向宿主自己的「设置 → 账户 → 查询用量」原生视图。 */
    
      /* 打开外部链接。
         桌面端（Electron）里 window.open 不保证落到系统浏览器：宿主自己的做法是
         「opens in the system browser」，即走 preload 暴露的原生桥。
         因此优先探测 dshDesktop 的打开器，再退回 window.open；两者都不可用时
         把地址显示出来让用户手动复制，而不是静默失败。 */
      function openExternal(url) {
        if (!url) return false;
        try {
          var d = window.dshDesktop;
          if (d) {
            var fn = d.openExternal || d.openUrl || d.openLink;
            if (typeof fn === 'function') { fn.call(d, url); return true; }
          }
        } catch (e) { /* 继续退回 */ }
        try {
          /* ⚠ windowFeatures 里含 `noopener` 时，按 HTML 规范 window.open
              **必然返回 null**（新上下文无 opener 引用）。所以不能靠返回值判断
             成败 —— 上一版 `if (w) return true;` 会让「页面其实已经打开」
             却仍然弹出「无法打开外部链接」的假失败提示。
             这里改为「调用不抛异常即视为成功」。noreferrer 保留（安全更好）。 */
          window.open(url, '_blank', 'noopener,noreferrer');
          return true;
        } catch (e) { /* 继续退回 */ }
        return false;
      }
    
      function openExternalOrShow(url) {
        if (!url) { flash('链接未取到，请先点刷新'); return; }
        if (!openExternal(url)) flash('无法打开链接，请在原生 Settings → Account 中打开');
      }
    
      /* 瞬时提示：卡片内一行小字，4 秒后自动消失。
         features.js 不依赖已删除的 content.js，因此自带这个最小实现。
         ⚠ 定时器必须存句柄并在新提示/卸载时清除（P2 修复）：
         原先每次 flash 都新建一个匿名 setTimeout ——
         ① 同一文案连点两次，第一条会在 4 秒时把新提示一起清掉；
         ② 卡片关闭或插件卸载后仍会触发一次 set + 全 store 广播。 */
      var FLASH_MS = 4000;
      var flashTimer = 0;
      function clearFlash() {
        if (flashTimer) { clearTimeout(flashTimer); flashTimer = 0; }
      }
      function flash(text) {
        clearFlash();
        set({ notice: text });
        flashTimer = setTimeout(function () {
          flashTimer = 0;
          if (state.notice === text) set({ notice: '' });
        }, FLASH_MS);
      }
    
      /* --------------------------- 数值归一化 ---------------------------
         权威形状（dsh-deepseek-account README:55）：
           「A ready AccountDetails.balance keeps recharge wallets in **value** and
            bonus wallets in **bonusWallets**; both arrays preserve **decimal strings**
            and currency. Query failure supplies neither amount.」
         上一版按标量 available / balance / amount 探测，数组形状全部落空，
         所以卡片中间是空的（用户截图）。现在按真实形状求和，并保留钱包明细。 */
      function toNum(raw) {
        if (raw == null) return null;
        if (typeof raw === 'number') return isNaN(raw) ? null : raw;
        var s = String(raw).replace(/[,\s]/g, '');
        if (!s) return null;
        var n = Number(s);
        return isNaN(n) ? null : n;
      }
    
      // 单个钱包条目：金额字段按 schema 是 balance（十进制字符串）
      function walletAmount(item) {
        if (item == null) return null;
        if (typeof item === 'string' || typeof item === 'number') return toNum(item);
        return toNum(item.balance) ?? toNum(item.amount) ?? toNum(item.value)
          ?? toNum(item.money) ?? toNum(item.total) ?? toNum(item.cents);
      }
      function walletCurrency(item) {
        if (!item || typeof item !== 'object') return null;
        return item.currency || item.currencyCode || item.unit || null;
      }
    
      // 数组求和 + 保留明细；宿主可能给数组、单个对象，或查询失败时干脆不给
      function sumWallets(list) {
        var out = { total: null, items: [], currency: null };
        if (!list) return out;
        var arr = Array.isArray(list) ? list : [list];
        arr.forEach(function (it) {
          var n = walletAmount(it);
          if (n == null) return;
          out.total = (out.total == null ? 0 : out.total) + n;
          if (!out.currency) out.currency = walletCurrency(it);
          out.items.push({ label: (it && (it.name || it.type || it.walletId || it.id)) || null, amount: n });
        });
        return out;
      }
    
      /* Platform Web 货币格式（settings-account README:39）：
         两位小数 + 千分位；正的不足一分显示 <0.01；负数取整到最小显示幅度 0.01。 */
      function platformMoney(n) {
        if (n == null || isNaN(n)) return null;
        if (n > 0 && n < 0.01) return '<0.01';
        if (n < 0 && n > -0.01) return '-0.01';
        var fixed = Math.abs(n).toFixed(2);
        var parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return (n < 0 ? '-' : '') + parts.join('.');
      }
    
      /* getBalance 的权威结果形状（typert.remote-client.js:42-54）：
           null
         | { status:'ready',
             value:       [{ currency:'CNY'|'USD', balance: <decimal string> }],
             bonusWallets:[{ currency:'CNY'|'USD', balance: <decimal string> }] }
         | { status:'failed' }
         注意与 README 的措辞差别：value / bonusWallets 在**顶层**，
         金额字段叫 **balance**（十进制字符串），不是嵌套的 balance 对象。
         失败分支两个数组都不给 —— 必须如实显示，不能显示 ¥0.00。 */
      function readBalance(data) {
        var v = data;
        if (!v || typeof v !== 'object') return null;
        if (v.status === 'failed') return { ok: false, failed: true, rawKeys: 'status=failed' };
    
        // 兼容：顶层即结果，或被包在 balance / value 里
        var bag = (v.value || v.bonusWallets) ? v
          : (v.balance && (v.balance.value || v.balance.bonusWallets)) ? v.balance
          : null;
        if (!bag) return { ok: false, failed: false, rawKeys: Object.keys(v).slice(0, 8).join(', ') };
    
        var topup = sumWallets(bag.value);
        var gift = sumWallets(bag.bonusWallets);
        var currency = topup.currency || gift.currency || 'CNY';
        var hasAny = topup.total != null || gift.total != null;
        return {
          ok: hasAny,
          failed: false,
          total: hasAny ? (topup.total || 0) + (gift.total || 0) : null,
          topup: topup.total,
          gift: gift.total,
          topupItems: topup.items,
          giftItems: gift.items,
          currency: currency,
          account: v.email || v.account || v.contact
            || (v.profile && (v.profile.contact || v.profile.name || v.profile.id)) || null,
          rawKeys: Object.keys(bag).slice(0, 8).join(', '),
        };
      }
    
      /* ----------------------------- 样式 -----------------------------
         由 install() 注入成常驻 <style data-plugin-css>（不再放在 Card 里）：
         上一版卡片关闭时 Card 返回 null → 触发器没有任何样式，渲染成浏览器默认
         白底方框并被 foot 行推到最右端（用户截图）。尺寸 / 圆角 / 颜色全部取自
         宿主令牌 → 看起来就是宿主自己的控件。 */
      var CSS = [
        /* 触发器：内联、无自绘底色。 */
        '.puq-trigger{display:inline-flex;align-items:center;justify-content:center;',
        'width:24px;height:24px;flex:0 0 auto;border-radius:var(--dsw-radius-sm);',
        'color:var(--dsw-alias-brand-primary);background:transparent;cursor:pointer;',
        'padding:0;border:0;transition:background var(--dsw-transition-duration,.2s) ease}',
        '.puq-trigger:hover,.puq-trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)}',
        '.puq-trigger svg{width:16px;height:16px}',
    
        /* 位置由 Trigger 的运行时测量决定（见 place()），CSS 只保留外观。
           用户截图证实 sidebar.footer.action 被宿主渲染成**独立一行**，位于账户行
           （头像 + 名称）上方，而不是文档所述「beside Settings」；
           因此上一版「把账户行限宽 130px」无效 —— :has 匹配到的是按钮自己那一行，
           账户行是它的兄弟，根本没被选中。纯 CSS 无法可靠跨越这个结构，
           故改为量取相邻行的实际矩形再定位，不再猜几何。 */
        '.puq-trigger{display:inline-flex;align-items:center;justify-content:center;',
        'width:24px;height:24px;border-radius:var(--dsw-radius-sm);',
        'color:var(--dsw-alias-brand-primary);background:transparent;cursor:pointer;',
        'padding:0;border:0;z-index:1000;',
        'transition:background var(--dsw-transition-duration,.2s) ease}',
        '.puq-trigger:hover,.puq-trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)}',
        '.puq-trigger svg{width:16px;height:16px}',
        /* 按钮被成功定位后脱离原行；原行只剩这一个子节点，随之塌陷。 */
        '.puq-trigger.puq-placed{position:fixed}',
        /* 宽度回到 290px：两列四宫格已删除，340px 是当时为它扩的。 */
        '.puq-card{position:fixed;left:12px;bottom:52px;width:290px;z-index:2147483001;',
        'background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);',
        'border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-shadow-lv3);',
        'color:var(--dsw-alias-label-primary);font-size:13px;overflow:hidden}',
        '.puq-hd{display:flex;align-items:center;gap:8px;padding:12px 14px 10px;',
        'border-bottom:1px solid var(--dsw-alias-border-l1);font-weight:600}',
        '.puq-hd svg{width:15px;height:15px;color:var(--dsw-alias-brand-primary)}',
        '.puq-total{margin:12px 14px 0;padding:12px 14px;border-radius:var(--dsw-radius-sm);',
        'background:var(--dsw-alias-bg-module-platform)}',
        '.puq-total .k{font-size:11.5px;color:var(--dsw-alias-label-secondary)}',
        '.puq-total .row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:2px}',
        '.puq-total .v{font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-.5px;',
        'font-variant-numeric:tabular-nums;color:var(--dsw-alias-brand-primary)}',
        '.puq-total .v small{font-size:15px;font-weight:600;margin-right:1px}',
        /* “含 赠送余额 ¥0.00”：前缀是普通文字，数值走白底 chip */
        '.puq-total .incl{font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.puq-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 7px;',
        'border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);',
        'font-size:12px;color:var(--dsw-alias-label-primary);',
        'box-shadow:0 0 0 1px var(--dsw-alias-border-l1)}',
        '.puq-chip b{font-weight:600}',
        '.puq-chip .n{font-variant-numeric:tabular-nums;font-weight:650}',
        /* ---- 峰谷时段行 ----
           与总额块同宽；用左侧竖条区分两种状态（闲时绿、峰时橙）。
           颜色全部走宿主令牌，深浅色自动跟随。 */
        /* 峰谷行：无边框、无底色，只做信息行。
           左右外边距取 18px（总额块是 14px），所以这行比总额块略窄，不再显得突出；
           左边界与总额块的内文起始位置对齐。 */
        '.puq-peak{margin:8px 18px 12px;padding:0}',
        '.puq-peak-l1{display:flex;align-items:center;gap:8px}',
        '.puq-peak-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-brand-primary,#209a72)}',
        '.puq-peak.is-peak .puq-peak-dot{background:#e8830c}',
        '.puq-peak-lab{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.puq-peak-rem{margin-left:auto;font-size:11.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
        '.puq-peak-l2{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
        '.puq-peak-next{font-variant-numeric:tabular-nums}',
        '.puq-peak-why{margin-left:auto;opacity:.85}',
        /* 用量四宫格的样式已随该区块一同删除（插件层拿不到平台用量凭据，
           见 index.js 的 40002 / 40003 实测结论）。 */
        '.puq-hint{padding:0 14px 12px;font-size:11px;line-height:1.5;',
        'color:var(--dsw-alias-label-secondary)}',
        /* 错误块：它可能成为卡片的最后一块（查询失败时），所以自带下内边距 12px，
           与 .puq-peak 的下边距一致，保证任何状态下卡片底部都有呼吸边距。 */
        '.puq-err{padding:12px 14px 12px;font-size:12px;',
        'color:var(--dsw-alias-state-error-primary)}',
        /* 头部右侧的充值/刷新按钮：margin-left:auto 推到最右。
           高度固定 22px，无论显示「充值」还是「刷新」都不改变头部高度。 */
        '.puq-hd-btn{margin-left:auto;height:22px;padding:0 10px;flex:none;',
        'border-radius:var(--dsw-radius-sm);cursor:pointer;font:inherit;font-size:11.5px;',
        'border:1px solid transparent;background:var(--dsw-alias-brand-primary);',
        'color:var(--dsw-alias-bg-layer-1);font-weight:600}',
        '.puq-hd-btn:hover{opacity:.88}',
        '.puq-hd-btn:disabled{opacity:.55;cursor:default}',
      ].join('\n');
    
      var ICON_BARS = h('svg', {
        viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.8, strokeLinecap: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M4.2 12.4V7.6M8 12.4V4.4M11.8 12.4V9.4' }));
    
      /* ------------------- 组件（闭包捕获 ctx，不用任何全局） -------------------
         ctx 由 install(ctx) 赋值；组件定义在外层，因此读取的是同一个闭包变量。 */
      var ctx = null;
    
      /* --------------------- 触发器定位（运行时测量） ---------------------
         用户截图证实：sidebar.footer.action 被宿主渲染成**独立一行**，位于账户行
         （头像 + 名称）上方，而不是文档所述「beside Settings」。
         所以上一版「把账户行限宽 130px」完全无效：:has 匹配到的是按钮自己那一行，
         账户行是它的兄弟节点，从未被选中。
         我不再猜宿主 DOM 的层级与行高，改为量取真实矩形：
           1. 找到按钮所在行（本插件那一行）；
           2. 在它的兄弟里取「最靠下」的那一行 = 账户行（截图里头像在按钮下方）；
           3. getBoundingClientRect 量出该行右端，把按钮 fixed 贴过去；
           4. 立即自检：按钮矩形必须落在目标行内，否则整体撤销、回到原状。
         ⚠ 只改本插件自己节点的样式，绝不移动或改写宿主任何 DOM —— 此前接管 root
           让 26 个插件连锁 pending 的教训：插件不碰不属于它的布局。 */
      var placeInfo = { ok: false, detail: '' };
      /* 被压短的宿主行及其原始 max-width，用于撤销。
         ⚠ 这里确实写了一个宿主节点的内联样式（用户明确要求「挤压头像行长度」）。
         边界：只写 max-width 一个属性、只写一个节点、卸载时精确还原原值；
         不移动节点、不改 class、不删任何宿主 DOM。 */
      var squeezed = null;
    
      function clearPlace(el) {
        if (squeezed && squeezed.el) {
          try { squeezed.el.style.maxWidth = squeezed.prev; } catch (e) { /* 节点已移除 */ }
        }
        squeezed = null;
        if (!el) return;
        el.classList.remove('puq-placed');
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
      }
    
      /* 从按钮向上走到「有多个子行的容器」，返回 [容器, 本插件所在行]。 */
      function findRow(el) {
        var node = el;
        for (var depth = 0; depth < 6 && node.parentElement; depth++) {
          var parent = node.parentElement;
          if (parent.children.length >= 2) return [parent, node];
          node = parent;
        }
        return [null, null];
      }
    
      function place(el) {
        if (!el) return;
        try {
          var found = findRow(el);
          var box = found[0], row = found[1];
          if (!box || !row) { clearPlace(el); placeInfo = { ok: false, detail: '未找到多子级容器' }; return; }
    
          var kids = Array.prototype.slice.call(box.children);
          var myIdx = kids.indexOf(row);
          // 目标 = 兄弟行中最靠下的那个（截图里账户行在按钮行下方）
          var target = null, targetBottom = -Infinity;
          for (var i = 0; i < kids.length; i++) {
            if (i === myIdx) continue;
            var r = kids[i].getBoundingClientRect();
            if (r.height > 0 && r.bottom > targetBottom) { targetBottom = r.bottom; target = kids[i]; }
          }
          if (!target) { clearPlace(el); placeInfo = { ok: false, detail: '没有兄弟行' }; return; }
    
          /* 用户要求：按钮不要落在头像行**内部**，而是把该行压短，按钮占腾出的空间。
             原因：头像行横跨整行宽度，它的点击热区延伸到按钮四周，
             点余额卡片外面就会命中该行的账户菜单（设置/意见反馈/退出登录）。
             压短后行的盒子止于按钮左侧，热区随之缩小，两者互不重叠。
    
             ⚠ 顺序至关重要：必须**先完全复位**（撤销上一轮的 max-width 与 fixed），
             再量基准几何。place() 会被定时器与 resize 反复调用，若沿用上一轮的
             已压短状态来量：
               · 行宽会逐轮再减一次按钮宽度 → 棘轮，最终压到 96px；
               · 按钮锚点 tr.right 已左移，自检必然失败并整体撤销。
             复位后每次量到的都是宿主的自然布局，计算才是幂等的。 */
          clearPlace(el);
    
          var tr = target.getBoundingClientRect();
          var natural = tr.width;
          /* 按钮此时仍在自己那一行（已复位），宽度不受压短影响 */
          var er = el.getBoundingClientRect();
          if (!tr.width || !tr.height || !er.width || !er.height) {
            placeInfo = { ok: false, detail: '矩形为空' }; return;
          }
    
          var keep = Math.max(96, natural - er.width - 12);
          if (natural - keep < er.width) {
            placeInfo = { ok: false, detail: '行宽不足，无法腾位' }; return;
          }
    
          /* 首次接触该宿主节点时记下它的原始 max-width，撤销时精确还原。
             只写这一个属性、只写这一个节点；不移动、不改 class、不删宿主 DOM。 */
          if (!squeezed || squeezed.el !== target) {
            squeezed = { el: target, prev: target.style.maxWidth };
          }
          target.style.maxWidth = Math.round(keep) + 'px';
    
          /* 压短后重量行矩形：它的右端就是按钮应当贴靠的位置。 */
          var ar = target.getBoundingClientRect();
          el.classList.add('puq-placed');
          el.style.position = 'fixed';
          el.style.left = Math.round(ar.right + 4) + 'px';
          el.style.top = Math.round(ar.top + (ar.height - er.height) / 2) + 'px';
    
          /* ⚠ 按钮脱离文档流后，它原来那一行会塌陷，账户行随之上移。
             若沿用塌陷前量的 ar 做自检，会「自检通过但视觉错位」。
             因此放置后重新量目标行，并按实测差值迭代校正（最多 3 次收敛）。 */
          var ar2 = target.getBoundingClientRect();
          for (var pass = 0; pass < 3; pass++) {
            var wantTop = Math.round(ar2.top + (ar2.height - er.height) / 2);
            var wantLeft = Math.round(ar2.right + 4);
            var curTop = parseFloat(el.style.top) || 0;
            var curLeft = parseFloat(el.style.left) || 0;
            if (Math.abs(wantTop - curTop) <= 1 && Math.abs(wantLeft - curLeft) <= 1) break;
            el.style.top = wantTop + 'px';
            el.style.left = wantLeft + 'px';
            ar2 = target.getBoundingClientRect();
          }
    
          /* 自检（全部以**放置后**的实测矩形为准）：
             · 行确实变窄 → 热区已缩小；
             · 按钮在行的右侧且不相交 → 不再落在行内部；
             · 按钮纵向与行对齐 → 贴到了正确那一行的高度。
             任一不满足就整体撤销，回到上一版可用状态。 */
          var nr = el.getBoundingClientRect();
          var narrowed = ar2.width < natural - 1;
          var disjoint = nr.left >= ar2.right - 1;
          var aligned = nr.top >= ar2.top - 2 && nr.bottom <= ar2.bottom + 2;
          if (narrowed && disjoint && aligned) { placeInfo = { ok: true, detail: '' }; return; }
          clearPlace(el);
          placeInfo = { ok: false, detail: '自检失败：行 ' + Math.round(natural) + '→' + Math.round(ar2.width) +
            'px, 按钮左 ' + Math.round(nr.left) + '/行右 ' + Math.round(ar2.right) +
            ', 纵向' + (aligned ? 'ok' : 'off') };
        } catch (e) {
          clearPlace(el);
          placeInfo = { ok: false, detail: '异常 ' + errText(e) };
        }
      }
    
      function Trigger() {
        useStore();
        /* 纯图标、无自绘底色。悬浮提示按用户要求为「查询用量」。
           摆位由 place() 在运行时测量决定；失败时按钮留在原行，不影响任何功能。 */
        var ref = React.useRef(null);
        React.useEffect(function () {
          var el = ref.current;
          if (!el) return undefined;
          // 侧栏折叠/展开、登录态变化都会重排，故多次延迟测量
          var timers = [0, 150, 500, 1500].map(function (ms) {
            return setTimeout(function () { place(el); }, ms);
          });
    
          /* 事件驱动的重摆位，用 requestAnimationFrame 合并（P1 性能修复）。
             place() 内部有 6~7 次强制同步布局（逐兄弟 getBoundingClientRect、
             写宿主 maxWidth 后立刻读、最多 3 轮「写 top/left → 读」校正）。
             拖动窗口时 resize 每秒可触发 60~120 次 → 每秒数百次强制布局，
             且改的是宿主侧栏节点。用 rAF 合并后每帧最多跑一次。 */
          var rafId = 0;
          function schedulePlace() {
            if (rafId) return;
            rafId = requestAnimationFrame(function () {
              rafId = 0;
              place(el);
            });
          }
    
          window.addEventListener('resize', schedulePlace);
    
          /* ResizeObserver（P2 修复）：侧栏折叠/展开、字体缩放不一定触发
             window.resize —— 原实现只在那 4 个固定延迟里测量，1.5 秒后发生的
             变化会让按钮停在旧位置。这里监听宿主容器尺寸，变化即重摆。 */
          var ro = null;
          if (typeof ResizeObserver === 'function' && el.parentElement) {
            try {
              ro = new ResizeObserver(schedulePlace);
              ro.observe(el.parentElement);
            } catch (e) { ro = null; }
          }
    
          return function () {
            timers.forEach(clearTimeout);
            window.removeEventListener('resize', schedulePlace);
            if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
            if (ro) { try { ro.disconnect(); } catch (e) { /* 已断开 */ } ro = null; }
            clearPlace(el);
          };
        }, []);
        return h('button', {
          ref: ref,
          type: 'button',
          className: 'puq-trigger',
          title: '查询用量',
          'aria-label': '查询用量',
          'aria-expanded': String(state.open),
          onClick: function (e) {
            e.stopPropagation();
            if (state.open) { set({ open: false }); return; }
            set({ open: true });
            loadAccount(ctx);
          },
        }, ICON_BARS);
      }
    
      /* 把 Date 格式化成「11/06 9:00」（月/日 + 时:分，本地时区，不涉及 UTC 换算）。
         用户要求：用月/日而不是周几；小时不补零（9:00 而非 09:00）。
         月日补零保持 11/06 这种固定宽度，避免整点时标签宽度跳动。 */
      function fmtClock(d) {
        var hh = d.getHours();
        var mm = d.getMinutes();
        var mo = d.getMonth() + 1;
        var dd = d.getDate();
        return (mo < 10 ? '0' + mo : mo) + '/' + (dd < 10 ? '0' + dd : dd)
          + ' ' + hh + ':' + (mm < 10 ? '0' + mm : mm);
      }
      function Card() {
        useStore();
        /* 峰谷时段：纯本地计算（见 peak.js）。
           刷新精度只需到「分钟」—— peak.js 的 humanRemain 就是按分钟取整的
           （Math.floor(ms/60000)），所以每秒重渲染 60 次里有 59 次是纯浪费。
           这里改为「对齐到下一个分钟边界」的单次定时器，链条自然续接：
           每分钟只重渲染 1 次，且跨整点（09:00 / 12:00 峰谷翻转）时必然命中。 */
        var tickS = React.useState(0);
        var setTick = tickS[1];
        React.useEffect(function () {
          if (!state.open) return undefined;
          var timer = null;
          var stopped = false;
          function schedule() {
            if (stopped) return;
            var now = Date.now();
            /* 留 30ms 余量，避免定时器早于边界触发后仍是旧的分钟。 */
            var delay = 60000 - (now % 60000) + 30;
            timer = setTimeout(function () {
              if (stopped) return;
              setTick(function (v) { return v + 1; });
              schedule();
            }, delay);
          }
          schedule();
          return function () {
            stopped = true;
            if (timer) { clearTimeout(timer); timer = null; }
          };
        }, [state.open]);
        var ref = React.useRef(null);
        var open = state.open;
    
        // 点击空白处 / Esc 关闭：不加全屏遮罩，避免阻断宿主交互
        React.useEffect(function () {
          if (!open) return undefined;
          function onDown(e) {
            /* 触发器自己管开关，必须在此排除（P0 修复）。
               事件顺序：pointerdown 在 document **捕获阶段**先于 React 的 onClick
               （挂在 root、冒泡阶段）触发。若这里不排除触发器，点它时先被判为
               「点在外面」→ set open:false，随后 onClick 读到的 state.open 已是 false
               → 走「打开」分支 → 卡片收起又立刻重开，并多发一次余额请求。
               e.stopPropagation() 在 onClick 里拦不住捕获阶段。 */
            var t = e.target;
            if (t && t.closest && t.closest('.puq-trigger')) return;
            if (ref.current && !ref.current.contains(t)) set({ open: false });
          }
          function onKey(e) { if (e.key === 'Escape') set({ open: false }); }
          document.addEventListener('pointerdown', onDown, true);
          document.addEventListener('keydown', onKey);
          return function () {
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('keydown', onKey);
          };
        }, [open]);
    
        if (!open) return null;
        var b = readBalance(state.data);
        var sym = b && b.currency && b.currency !== 'CNY' ? b.currency : '¥';
    
        /* 版式（按用户最新要求调整）：
             头部  = 柱状图图标 + 「账户余额」+ 右侧「请求数据中…」（无 ×：点弹窗外部已可关闭）
             总额块 = 浅绿底，「可用总额」+ 大号 ¥x.xx + 同行「含 赠送余额 chip」
             底部   = 右对齐单个「充值」主按钮（用量四宫格与诊断文字均已删除）
           ⚠ 加载状态必须放在头部：头部始终存在，卡片高度不随之变化。
           上一版把「正在向账户服务请求数据…」单独占一行，请求开始与结束时
           该行出现/消失 → 弹窗高度跳动（用户截图）。 */
        var kids = [];
    
        /* 头部：图标 + 「账户余额」+ 右侧充值按钮。
           原先右侧是「请求数据中…」占位文字，按用户要求删除；
           充值按钮从底部移到这个位置（更顺手，也省掉底部一行）。
           按钮高度固定 22px，保证有无链接时头部高度不变。 */
        var topUp = state.links && state.links.topUpUrl;
        kids.push(h('div', { className: 'puq-hd', key: 'hd' },
          ICON_BARS,
          h('span', null, '账户余额'),
          h('button', {
            className: 'puq-hd-btn',
            type: 'button',
            disabled: state.loading ? true : undefined,
            title: topUp ? '前往充值' : '刷新余额',
            onClick: function () {
              if (topUp) openExternalOrShow(topUp);
              else loadAccount(ctx);
            },
          }, topUp ? '充值' : (state.signedOut ? '登录' : '刷新'))));
    
        if (b && b.ok) {
          kids.push(h('div', { className: 'puq-total', key: 'total' },
            h('div', { className: 'k' }, '可用总额'),
            h('div', { className: 'row' },
              h('span', { className: 'v' }, h('small', null, sym), platformMoney(b.total)),
              h('span', { className: 'incl' }, '含'),
              h('span', { className: 'puq-chip' },
                h('b', null, '赠送余额'),
                h('span', { className: 'n' }, sym + ' ' + (platformMoney(b.gift) || '0.00'))))));
        }
    
        /* 峰谷时段行（闲时 / 峰时 + 剩余时间 + 依据）。
           规则来自官方计费文档：峰时 = 工作日 09:00-12:00 与 14:00-18:00（北京时间），
           周末与中国法定节假日全天闲时。全部本地计算，不联网。
           叠在余额之上而不是替换它 —— 余额与时段是两个独立事实。 */
        var pk = PU_PEAK.status(new Date());
        var pkRemain = pk.nextAt ? PU_PEAK.humanRemain(pk.nextAt.getTime() - Date.now()) : '';
        kids.push(h('div', { className: 'puq-peak' + (pk.peak ? ' is-peak' : ''), key: 'peak' },
          h('div', { className: 'puq-peak-l1' },
            h('span', { className: 'puq-peak-dot' }),
            h('span', { className: 'puq-peak-lab' }, pk.label),
            pkRemain ? h('span', { className: 'puq-peak-rem' }, '剩余 ' + pkRemain) : null),
          h('div', { className: 'puq-peak-l2' },
            pk.nextAt ? h('span', { className: 'puq-peak-next' },
              fmtClock(pk.nextAt) + ' 转' + (pk.nextToPeak ? '峰时' : '闲时')) : null,
            h('span', { className: 'puq-peak-why' }, pk.reason))));
    
        /* 用量四宫格已按用户要求删除。留档：平台网页用量接口所需的凭据插件层
           拿不到（40002 Missing Token / 40003 invalid token 两轮实测，见 index.js），
           宿主「设置 → 账户 → 查询用量」的原生 Platform 视图才是可用路径。 */
    
        /* 加载状态不再单独占行（原先头部有个「请求数据中…」占位，已按用户要求删除；
           请求进行中改为禁用头部按钮的视觉反馈）。错误信息仍单独成行 —— 它只在失败时
           出现且必须完整可读，不能挤进头部。 */
        if (state.error) {
          kids.push(h('div', { className: 'puq-err', key: 'err' }, state.error));
        } else if (b && b.failed) {
          kids.push(h('div', { className: 'puq-err', key: 'f' }, '平台余额查询失败（status=failed），点「充值」旁的刷新重试。'));
        }
    
        /* 充值与刷新已在头部（puq-hd-btn）；底部行已删除。 */
        // 瞬时提示（打开失败 / 链接未取到）放在最末，避免顶掉主要数据
        if (state.notice) {
          kids.push(h('div', { className: 'puq-hint', key: 'flash' }, state.notice));
        }
    
        /* 定位失败时如实说明原因（成功时不显示任何文字，不污染界面）。
           这是为了下一轮能凭事实收敛，而不是再猜一次宿主的 DOM 结构。
           桌面版没有右键检查，界面自报是唯一的取证通道。 */
        if (placeInfo.ok === false) {
          kids.push(h('div', { className: 'puq-hint', key: 'place' },
            '按钮未能移到头像行：' + placeInfo.detail + '（功能不受影响，仍在原行）'));
        }
    
        /* 电源与模型块的探针取证**不再**显示在余额卡片里：
           用户明确要求这张卡只有余额本身，任何诊断文字都算污染。
           探针失败改为静默降级（电源退到右上角、模型块保持宿主原样，
           两者功能均不受影响），需要排查时由我加临时日志，不占用户界面。 */
    
        return h('div', { className: 'puq-root' },
          h('section', { ref: ref, className: 'puq-card', role: 'dialog',
            'aria-label': '账户余额', 'data-build': PU_VERSION }, kids));
      }
    
      /* ------------------------------ 注册 ------------------------------ */
      return function install(c) {
        ctx = c;   // 写入外层闭包变量，供 Trigger / Card 使用（不要写成 install(ctx)，
                   // 那会让形参遮蔽外层变量、组件里读到的一直是 null）
        var offs = [];
    
        /* 控件样式常驻注入。
           上一版把 <style> 放在 Card 组件里，而卡片关闭时 Card 返回 null →
           触发器没有任何样式，渲染成浏览器默认白底方框，并被宿主 foot 行推到
           最右端（用户截图正是这个形态）。样式必须与触发器同生命周期。
           注入方式抄宿主静态包自己的做法（ui-theme installThemeStyles）：
           自建 <style> + data-plugin-css 标记 + 注入前摘同 id 旧标签，
           避免开着页面换版本时两代叠加。 */
        if (typeof document !== 'undefined') {
          /* 样式归装配层所有（build.js 的 controls css container effect）。
             这里只幂等追加自己那一段。原地删除/重建标签会抹掉其它模块的 CSS ——
             这正是「模型选择器样式消失」的根因：features 重挂时删了共用标签，
             而 model/power/actions/session 的 effect 没有重跑，样式再也回不来。 */
          PU_ensureCss('features', CSS);
        }
    
        // 侧栏底部真实动作位（additive，replaceRisk=none）
        offs.push(ctx.slots.inject('sidebar.footer.action', function () {
          return ctx.slots.register(
            { name: 'sidebar.footer.action', id: 'dsh-perfect-ui.balance', order: 5, label: function () { return '账户余额'; } },
            Trigger);
        }));
        // 框架级浮层：位于所有列之上且在滚动容器之外 → 不会被侧栏 overflow 截断
        offs.push(ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register({ name: 'shell.overlay', id: 'dsh-perfect-ui.balance-card', order: 900 }, Card);
        }));
        // 返回清理：ctx.slots.inject 自身返回 disposer，必须交还给外层 ctx.effect
        return function () {
          /* ① 先停掉瞬时提示的定时器，避免卸载后还触发 set + 全 store 广播。
             ② 复位 store（与 actions.js 的 disposer 对齐，P2 修复）：
                否则关掉「余额查询」再打开时，若 open 曾为 true，
                卡片会以打开态立刻出现并显示上次的陈旧数据/错误。
                用 setNow（同步）而不是 set（微任务），避免在卸载后再通知订阅者。 */
          clearFlash();
          try {
            setNow({ open: false, notice: '', error: null, loading: false });
          } catch (e) { /* store 已不可用 */ }
          offs.forEach(function (off) { try { off(); } catch (e) {} });
        };
      };
    }
    

    /* ============ B2. 电源菜单（内联 power.js，复刻 dsh-power-menu 机制） ============ */
    /* dsh-perfect-ui — 电源菜单（Client 半边）
       机制复刻 dsh-power-menu（MIT, Copyright (c) 2026 xichen-62）：
       触发按钮 + 两项菜单（关闭DSH / 重启DSH）+ 执行遮罩 + 键盘导航。
    
       摆位方式（按用户要求，与余额按钮同一套：不猜、测量、失败自报）：
         v2.18.0 猜的 [data-window-control] / .caption-buttons 经 app.asar
         二进制检索证实**根本不存在**（0 命中），所以按钮没出现。
         现在改为几何扫描：
           1. 门控 html[data-windows-titlebar]（ui-layout README:41 确证的标记）；
           2. 在窗口顶部窄带（top<44）收集 20–80px 宽、18–46px 高、
              右端贴窗边（right ≥ W-140）的元素；
           3. 同矩形去重取最深节点；按 left 排序后找「间距 ≤6px 的连续簇」，
              取最右且成员 ≥2 的簇 = 窗口控制按钮组（最小化/最大化/关闭）；
           4. 簇内最左者 = 最小化按钮，电源图标贴到它左侧。
         扫描失败时**仍然渲染**，退到右上角（caption 下方），并把扫描事实
         写进 PU_powerInfo.via —— 装配层据此选择摆位通道并终止重扫描。
         （曾有一版把它显示到余额卡片上用于取证，那段显示已按用户要求移除。）
       路由走本插件自己的 /api/dsh-perfect-ui-power/*。
       本函数由 build.js 内联进 dist/client.js，在 factory 作用域内执行。 */
    
    /* 扫描结果对外可见（factory 作用域 var 提升，features.js 先内联也能读）。 */
    var PU_powerInfo = { via: 'none' };
    
    function PU_power(React, h) {
      'use strict';
    
      var POWER_BASE = '/api/dsh-perfect-ui-power';
    
      var ICON_POWER = h('svg', {
        viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M12 3.2v8.4' }), h('path', { d: 'M6.15 6.55a8 8 0 1 0 11.7 0' }));
    
      var ICON_RESTART = h('svg', {
        viewBox: '0 0 24 24', width: 21, height: 21, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
         h('path', { d: 'M3 3v5h5' }));
    
      var ICON_POWER_LG = h('svg', {
        viewBox: '0 0 24 24', width: 21, height: 21, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M12 3.2v8.4' }), h('path', { d: 'M6.15 6.55a8 8 0 1 0 11.7 0' }));
    
      /* ---------------- 定位：caption 行 ----------------
         用户标注位置 = caption 行（— □ ✕ 那一行）、最小化按钮左侧。
         实测截图证明窗口按钮是 Electron titleBarOverlay 的**原生绘制**，
         不在 DOM 里 —— 上一版几何扫描必然落空（候选全是会话头部第二行的
         按钮，簇判定后仍退到 fallback）。
         现在改用宿主确证发布的变量（ui-layout README:43）：
           --dsh-frame-top-clearance = caption 高度（写在根元素上）
         横向按 Windows 标准 overlay 宽度估算：3 个 46px 按钮 = 138px，
         电源按钮落在 138px 区的左侧（left = W - 138 - 28 - 4）。
         两种通道都保留：先试 DOM 扫描（若宿主某天改为自绘 caption 按钮），
         再用变量估算；取证 detail 记录实际用了哪条。 */
    
      /* depthOf：同矩形去重时取 DOM 更深的节点（真正的按钮，而非包住它的容器）。 */
      function depthOf(el) { var d = 0; while (el.parentElement) { d += 1; el = el.parentElement; } return d; }
    
      /* 读 caption 高度。
         README:43 只说「publishes --dsh-frame-top-clearance … on the root element」，
         而 "root element" 在本宿主里有两种读法：html，或挂载点 #root。
         因此依次探测三个候选宿主；都读不到时退回 Electron 默认 caption 高度 32，
         并把这一事实写进取证文字（而不是静默用错值）。 */
      var CLEARANCE_FALLBACK = 32;
      function captionClearance() {
        var hosts = [document.documentElement, document.getElementById('root'), document.body];
        for (var i = 0; i < hosts.length; i++) {
          var el = hosts[i];
          if (!el) continue;
          try {
            var n = parseFloat(getComputedStyle(el).getPropertyValue('--dsh-frame-top-clearance'));
            if (Number.isFinite(n) && n >= 24 && n <= 64) return n;
          } catch (e) { /* 继续下一个宿主 */ }
        }
        return 0;
      }
    
      /* collectProbeRoots：把窗口按钮的搜索范围从「整页」收窄到 caption 行右端窄带。
         做法：沿窄带取若干探测点的 elementFromPoint，收集这些元素及其共同祖先，
         只在这些子树里遍历。若探测点都被遮挡或返回 null，退回 [document.body]
         让调用方走全页扫描（保证功能不因收窄而失效）。 */
      function collectProbeRoots(W, band) {
        var roots = [];
        if (typeof document.elementFromPoint !== 'function') return [document.body];
        var top = Math.max(1, Math.min(band / 2, band - 2));
        /* 窗口按钮在右端，取右侧 200px 范围内几个点 */
        var xs = [W - 12, W - 34, W - 56, W - 80, W - 110, W - 150, W - 200];
        for (var i = 0; i < xs.length; i++) {
          var x = xs[i];
          if (x < 0 || x > W - 1) continue;
          var hit = null;
          try { hit = document.elementFromPoint(x, top); } catch (e) { hit = null; }
          if (!hit) continue;
          /* 命中点可能只是深层文本节点容器 —— 上溯几层，把包裹它的行/簇收进来即可 */
          var node = hit;
          for (var up = 0; up < 2 && node.parentElement; up++) node = node.parentElement;
          if (roots.indexOf(node) === -1) roots.push(node);
        }
        /* 一个点都没命中：退回全页（保证仍有结论，而不是静默失败） */
        return roots.length ? roots : [document.body];
      }
    
      function scanMinimize() {
        var info = { ok: false, via: 'none', detail: '' };
        try {
          var marked = document.documentElement.hasAttribute('data-windows-titlebar');
          var clearance = captionClearance();
          if (!marked) {
            PU_powerInfo = info;
            return null;
          }
          /* 读不到变量时不放弃：退回 Electron 默认 caption 高度，并在取证里标明，
             这里只保留内部标记，不再对外显示。 */
          var estimated = clearance === 0;
          var band = estimated ? CLEARANCE_FALLBACK : clearance;
          // 通道 1：DOM 里的窗口按钮簇（caption 行窄带内）
          var W = window.innerWidth;
          /* ---- 收窄搜索范围（性能关键）----
             原来 `document.querySelectorAll('body *')` 遍历整页每一个元素，
             再对逐个调 getBoundingClientRect —— 那是强制同步布局，
             对整页每个元素都调用是不可接受的开销（会卡整个窗口）。
             窗口按钮必定落在 caption 行右端那一条窄带里，所以先用
             elementFromPoint 在窄带内取几个探测点，把可能的子树收集起来，
             只在这些子树里遍历；探测失败（例如被 overlay 挡住）才退回全页扫描。 */
          var roots = collectProbeRoots(W, band);
          var nodes = [];
          for (var ri = 0; ri < roots.length; ri++) {
            var root = roots[ri];
            if (root === document.body || root === document.documentElement) {
              nodes.push(root);  // 退回全页时自己展开
              continue;
            }
            var sub = root.querySelectorAll ? root.querySelectorAll('*') : [root];
            for (var si = 0; si < sub.length; si++) nodes.push(sub[si]);
            nodes.push(root);
          }
          if (nodes.length === 0) nodes = Array.prototype.slice.call(document.querySelectorAll('body *'));
    
          var byRect = new Map();
          var cand = 0;
          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!el || !el.tagName) {
              /* 全页回退时拿到的是元素；roots 里可能有 body，统一过滤 */
              continue;
            }
            if (el.classList && el.classList.contains('puw-trigger')) continue;
            /* 粗筛只用纯属性读取（不触发布局）：tag / role / class。
               注意 offsetParent、offsetWidth、offsetHeight 都会**强制同步布局**，
               不能当「零成本粗筛」用 —— 上一版注释在此处是错的。 */
            var tag = el.tagName;
            var role = el.getAttribute ? el.getAttribute('role') : null;
            var aria = el.getAttribute ? el.getAttribute('aria-label') : null;
            var isBtnLike = tag === 'BUTTON' || role === 'button' || role === 'menuitem'
              || (aria && /最小化|关闭|minimize|close|maximize|restore/i.test(aria))
              || (el.classList && (el.classList.contains('titleBar') || el.classList.contains('caption')));
            /* 不再放行裸 DIV —— 宿主绝大多数元素都是 DIV，放行等于没筛。 */
            if (!isBtnLike) continue;
            var r = el.getBoundingClientRect();
            if (r.top < -2 || r.top > band) continue;
            if (r.width < 30 || r.width > 60) continue;
            if (r.height < band - 4) continue;
            if (r.right < W - 160) continue;
            cand += 1;
            var key = Math.round(r.left) + ':' + Math.round(r.top) + ':' + Math.round(r.width);
            var prev = byRect.get(key);
            if (!prev || depthOf(el) > depthOf(prev.el)) byRect.set(key, { el: el, r: r });
            if (cand > 400) break;
          }
          var list = Array.prototype.slice.call(byRect.values())
            .sort(function (a, b) { return a.r.left - b.r.left; });
          if (list.length >= 2) {
            var groups = [[list[0]]];
            for (var g = 1; g < list.length; g++) {
              var last = groups[groups.length - 1];
              var gap = list[g].r.left - (last[last.length - 1].r.left + last[last.length - 1].r.width);
              if (gap <= 6) last.push(list[g]); else groups.push([list[g]]);
            }
            var best = null;
            for (var q = 0; q < groups.length; q++) {
              if (groups[q].length < 2) continue;
              if (!best || groups[q][groups[q].length - 1].r.right > best[best.length - 1].r.right) best = groups[q];
            }
            if (best) {
              info.ok = true; info.via = 'dom';
              PU_powerInfo = info;
              return best[0].el;
            }
          }
          // 通道 2：原生 overlay 不在 DOM —— 用 caption 高度 + 标准宽度估算
          info.ok = true; info.via = 'clearance';
          // 取证文字：只保留内部标记，不显示到界面（用户要求卡片不含诊断文字）。
          info.detail = 'caption=' + band + (estimated ? '(估算)' : '')
            + ', DOM 窗口候选 ' + list.length + '（窗口按钮为原生 overlay，不在 DOM）';
          PU_powerInfo = info;
          return null; // 交给 place() 走估算
        } catch (e) {
          PU_powerInfo = info;
          return null;
        }
      }
    
      /* ---------------- 组件 ---------------- */
      function PowerSlot() {
        var tick = React.useState(0);
        var setTick = tick[1];
        var anchorRef = React.useRef(null);
        /* 让 PowerButton 能在锚点失效时回调本组件重扫（跨组件单向通知）。 */
        var lostRef = React.useRef(null);
    
        function rescan() {
          var el = anchorRef.current;
          if (el && document.contains(el)) return;
          anchorRef.current = scanMinimize();
          setTick(function (v) { return v + 1; });
        }
    
        React.useEffect(function () {
          rescan();
          /* 锚点会在宿主重建 caption 行时失效。旧版只在 24 次 500ms 内重扫，
             之后 interval 自停（via !== 'none'），于是 caption 重建后按钮跳到
             fallback 位（top:52px/right:8px），且只有用户拖动窗口(resize)才自愈。
             现在由 PowerButton 在 place() 里发现锚点游离时回调 onAnchorLost，
             重新打开一轮有限重扫，让按钮能自行归位。 */
          var tries = 0;
          var iv = null;
    
          function startProbeWindow() {
            tries = 0;
            if (iv) return;
            iv = setInterval(function () {
              tries += 1;
              if (PU_powerInfo.via !== 'none' || tries >= 24) { clearInterval(iv); iv = null; return; }
              rescan();
            }, 500);
          }
    
          startProbeWindow();
          function onResize() { anchorRef.current = null; startProbeWindow(); rescan(); }
          window.addEventListener('resize', onResize);
    
          /* 供 PowerButton 调用：锚点失效 → 清空并重扫，同时重开探测窗口。 */
          lostRef.current = function () {
            anchorRef.current = null;
            startProbeWindow();
            rescan();
          };
    
          return function () {
            if (iv) { clearInterval(iv); iv = null; }
            lostRef.current = null;
            window.removeEventListener('resize', onResize);
          };
        }, []);
    
        // 扫描失败也渲染（退到右上角），保证功能可用且取证可见
        return h(PowerButton, { anchor: anchorRef.current, onAnchorLost: function () { if (lostRef.current) lostRef.current(); } });
      }
    
      function PowerButton(props) {
        var openS = React.useState(false); var open = openS[0]; var setOpen = openS[1];
        var anchorS = React.useState(null); var anchor = anchorS[0]; var setAnchor = anchorS[1];
        var phaseS = React.useState(null);  var phase = phaseS[0];  var setPhase = phaseS[1];
        var errS = React.useState(null);    var err = errS[0];      var setErr = errS[1];
        var trigRef = React.useRef(null);
        var menuRef = React.useRef(null);
        var itemRefs = React.useRef([]);
        var phaseRef = React.useRef(null);
        /* 摆位稳定性计数：必须跨 effect 重跑延续（见 tick() 里的说明），
           所以放 ref 而不是 effect 内的闭包变量。 */
        var stableRef = React.useRef(0);
    
        /* 摆位：
           通道 1（DOM 锚点）→ 贴最小化按钮左侧；
           通道 2（原生 overlay，无 DOM）→ 按 caption 高度与标准 overlay 宽度估算：
             top  = 0，height = caption 高          与窗口按钮同一块矩形规格
             left = W - 138(3×46 按钮) - 46(本按钮宽)
           两条都不成 → 右上角 fallback（小尺寸，不冒充 caption 按钮）。
           caption 通道下按钮规格对齐原生窗口按钮（用户要求「跟右侧三个按钮
           一样大的触发范围」）：46 宽 × caption 高、hover 充满整块、无圆角。 */
        var CAPTION_BUTTON_W = 46;
        var OVERLAY_W = 138;
    
        var place = React.useCallback(function () {
          var el = trigRef.current;
          if (!el) return;
          /* 锚点曾经存在、但现在已不在文档里 → 宿主重建了 caption 行。
             通知 PowerSlot 重新扫描，否则按钮会一直停在 fallback 位
             （top:52px / right:8px），只有用户拖动窗口才会自愈。 */
          if (props.anchor && !document.contains(props.anchor) && props.onAnchorLost) {
            props.onAnchorLost();
          }
          var min = props.anchor && document.contains(props.anchor) ? props.anchor.getBoundingClientRect() : null;
          var clearance = captionClearance() || CLEARANCE_FALLBACK;
          if (min && min.width) {
            el.classList.add('puw-cap');
            el.style.right = 'auto';
            el.style.height = Math.round(min.height) + 'px';
            el.style.top = Math.round(min.top) + 'px';
            el.style.left = Math.round(min.left - CAPTION_BUTTON_W) + 'px';
            if (open) setAnchor({ top: Math.round(min.bottom + 6), right: Math.max(8, Math.round(window.innerWidth - min.right - 24)) });
          } else if (PU_powerInfo.via === 'clearance') {
            el.classList.add('puw-cap');
            el.style.right = 'auto';
            el.style.height = Math.round(clearance) + 'px';
            el.style.top = '0px';
            el.style.left = Math.round(window.innerWidth - OVERLAY_W - CAPTION_BUTTON_W) + 'px';
            if (open) setAnchor({ top: Math.round(clearance + 6), right: OVERLAY_W });
          } else {
            el.classList.remove('puw-cap');
            el.style.height = '';
            el.style.top = '52px';
            el.style.right = '8px';
            el.style.left = 'auto';
            if (open) setAnchor({ top: 84, right: 8 });
          }
        }, [open, props.anchor]);
    
        React.useEffect(function () {
          place();
    
          /* ---- 摆位驱动（性能关键）----
             place() 里有 getBoundingClientRect()，那是强制同步布局。
             原来每 400ms 跑一次 = 常驻 2.5 次/秒 重排，代价明显。
             现在：
               · 窗口尺寸变化 -> ResizeObserver（事件驱动，精确且零轮询）；
               · 宿主布局变化（caption 行出现/换位）-> 监听根元素结构变化；
               · 兜底定时器 2000ms，且**连续 3 次几何无变化就自行停止**。 */
          var lastGeo = '';
          var iv = null;
    
          function measure() {
            var el = trigRef.current;
            if (!el) return '';
            return [el.style.left, el.style.top, el.style.height, el.style.right].join('|');
          }
    
          function tick() {
            place();
            var geo = measure();
            if (geo === lastGeo) {
              /* stable 存进 ref 而不是闭包变量：place 的 deps 含 props.anchor，
                 锚点一变 place 就重建、本 effect 随之重跑，闭包里的 stable 会归零 ——
                 那样「几何稳定就停轮询」就永远不成立，2000ms 定时器会常驻。
                 用 ref 让计数跨 effect 重跑延续，真正能停下来。 */
              stableRef.current += 1;
              /* 几何稳定了就停轮询；之后只靠 resize / ResizeObserver 驱动。
                 若宿主后来重建布局，结构观察器会把它重新叫起来。 */
              if (stableRef.current >= 3 && iv) { clearInterval(iv); iv = null; }
            } else {
              lastGeo = geo;
              stableRef.current = 0;
            }
          }
    
          var ro = null;
          if (typeof ResizeObserver === 'function') {
            try {
              ro = new ResizeObserver(function () { stableRef.current = 0; tick(); });
              /* 只观察 documentElement 一处。之前同时 observe(body) —— 但 body 尺寸
                 完全由 documentElement 决定，任何一次窗口变化都会触发两次 tick()
                 （每次 tick 含多次强制同步布局的 getBoundingClientRect）。 */
              ro.observe(document.documentElement);
            } catch (e) { ro = null; }
          }
    
          /* 结构变化（caption 行被重建）时重新开始观察一轮 */
          var mo = null;
          if (typeof MutationObserver === 'function' && document.body) {
            mo = new MutationObserver(function () {
              stableRef.current = 0;
              if (!iv) iv = setInterval(tick, 2000);
            });
            mo.observe(document.body, { childList: true });
          }
    
          iv = setInterval(tick, 2000);
          window.addEventListener('resize', tick);
    
          return function () {
            if (iv) { clearInterval(iv); iv = null; }
            if (ro) { try { ro.disconnect(); } catch (e) { } ro = null; }
            if (mo) { try { mo.disconnect(); } catch (e) { } mo = null; }
            window.removeEventListener('resize', tick);
          };
        }, [place]);
    
        React.useEffect(function () {
          if (!open) return undefined;
          function onDown(e) {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            if (trigRef.current && trigRef.current.contains(e.target)) return;
            setOpen(false);
          }
          function onKey(e) {
            if (e.key === 'Escape') { setOpen(false); if (trigRef.current) trigRef.current.focus(); }
          }
          document.addEventListener('pointerdown', onDown, true);
          document.addEventListener('keydown', onKey, true);
          var first = itemRefs.current[0];
          if (first) first.focus();
          return function () {
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('keydown', onKey, true);
          };
        }, [open]);
    
        function onMenuKey(e) {
          var items = itemRefs.current.filter(Boolean);
          if (items.length === 0) return;
          var idx = items.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1 + items.length) % items.length].focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
          else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
          else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
          else if (e.key === 'Tab') { setOpen(false); }
        }
    
        function run(mode) {
          if (phaseRef.current !== null) return;
          phaseRef.current = mode;
          setOpen(false);
          setErr(null);
          setPhase(mode);
          var req;
          try {
            req = fetch(POWER_BASE + '/' + mode, {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' }, body: '{}',
            }).then(function (response) {
              return response.json().catch(function () { return {}; }).then(function (payload) {
                if (!response.ok || payload.ok === false) {
                  throw new Error((payload && payload.error) || ('HTTP ' + response.status));
                }
              });
            });
          } catch (e) { req = Promise.reject(e); }
          req.catch(function (e) {
            phaseRef.current = null;
            setPhase(null);
            setErr('操作未执行：' + (e && e.message ? e.message : String(e)));
            setTimeout(function () { setErr(null); }, 7000);
          });
        }
    
        var trigger = h('button', {
          ref: trigRef,
          type: 'button',
          className: 'puw-trigger',
          title: '电源',
          'aria-label': '电源菜单',
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: function () { setErr(null); setOpen(function (v) { return !v; }); },
        }, ICON_POWER);
    
        var menu = open && anchor && h('div', {
          ref: menuRef, className: 'puw-menu', role: 'menu',
          'aria-label': '电源菜单', style: anchor, onKeyDown: onMenuKey,
        },
          h('button', {
            type: 'button', role: 'menuitem', tabIndex: -1, className: 'puw-item',
            ref: function (el) { itemRefs.current[0] = el; },
            onClick: function () { run('shutdown'); },
          }, h('span', { className: 'puw-icon' }, ICON_POWER_LG), h('span', { className: 'puw-label' }, '关闭DSH')),
          h('button', {
            type: 'button', role: 'menuitem', tabIndex: -1, className: 'puw-item',
            ref: function (el) { itemRefs.current[1] = el; },
            onClick: function () { run('restart'); },
          }, h('span', { className: 'puw-icon' }, ICON_RESTART), h('span', { className: 'puw-label' }, '重启DSH')));
    
        var overlay = phase !== null && h('div', { className: 'puw-overlay' },
          h('div', { className: 'puw-toast', role: 'status', 'aria-live': 'assertive' },
            h('span', { className: 'puw-spinner' }),
            h('span', null, phase === 'restart' ? '正在重启DSH…' : '正在关闭DSH…')));
    
        var errToast = err !== null && h('div', { className: 'puw-error', role: 'alert' }, err);
    
        return h(React.Fragment, null, trigger, menu, overlay, errToast);
      }
    
      /* 电源样式并入常驻 controls.css（install 注入后追加，卸载随同一 <style> 移除）。 */
      var POWER_CSS = [
        '.puw-trigger{position:fixed;z-index:2147482900;display:flex;align-items:center;',
        'justify-content:center;width:24px;height:24px;padding:0;border:none;border-radius:6px;',
        'background:transparent;color:var(--dsw-alias-label-secondary,#5f5f66);cursor:pointer;',
        '-webkit-app-region:no-drag;',
        'transition:background .14s ease,color .14s ease}',
        '.puw-trigger:hover,.puw-trigger[aria-expanded="true"]{background:rgba(0,0,0,.08);',
        'color:var(--dsw-alias-label-primary,#1b1b20)}',
        '.puw-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-focus,#4d6bfe);outline-offset:1px}',
        /* caption 规格：与原生窗口按钮同尺寸同手感（用户要求）。
           46 宽 × caption 高（place() 写内联高度）、无圆角、hover 充满整块。
           ui-sidebar README:50 原文：caption 图标按钮是「centered 16px glyphs
           in 28px controls」的紧凑规格 —— 原生 — □ ✕ 实际占 46px 宽热区，
           这里对齐热区而非视觉框。 */
        '.puw-cap{width:46px;border-radius:0;}',
        '.puw-cap svg{width:16px;height:16px}',
        '.puw-menu{position:fixed;z-index:2147483000;box-sizing:border-box;min-width:172px;padding:6px;',
        'border-radius:13px;background:var(--dsw-alias-bg-layer-1,#fff);',
        'border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));',
        'box-shadow:0 14px 36px rgba(0,0,0,.18),0 3px 10px rgba(0,0,0,.08);',
        '-webkit-app-region:no-drag}',
        '.puw-item{display:flex;align-items:center;gap:14px;width:100%;height:44px;padding:0 14px;',
        'border:none;border-radius:9px;background:transparent;',
        'color:var(--dsw-alias-label-primary,#1b1b20);font-family:inherit;font-size:15px;line-height:1;',
        'text-align:left;cursor:pointer;outline:none}',
        '.puw-item:hover,.puw-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
        '.puw-item:active{background:rgba(0,0,0,.1)}',
        '.puw-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;',
        'flex:none;color:var(--dsw-alias-label-secondary,#5f5f66)}',
        '.puw-item:hover .puw-icon,.puw-item:focus-visible .puw-icon{color:var(--dsw-alias-label-primary,#1b1b20)}',
        '.puw-label{flex:1;white-space:nowrap}',
        '.puw-overlay{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;',
        'justify-content:center;background:rgba(10,10,14,.22);backdrop-filter:blur(1.5px)}',
        '.puw-toast{display:flex;align-items:center;gap:12px;padding:16px 22px;border-radius:13px;',
        'background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1b1b20);',
        'font-size:14px;box-shadow:0 16px 44px rgba(0,0,0,.24)}',
        '.puw-spinner{width:16px;height:16px;flex:none;border:2px solid currentColor;',
        'border-right-color:transparent;border-radius:50%;animation:puw-spin .8s linear infinite}',
        '.puw-error{position:fixed;top:44px;left:50%;transform:translateX(-50%);z-index:2147483002;',
        'max-width:min(520px,calc(100vw - 32px));box-sizing:border-box;padding:10px 14px;border-radius:10px;',
        'background:var(--dsw-alias-state-error-primary,#c62828);color:#fff;font-size:13px;line-height:1.45;',
        'box-shadow:0 10px 28px rgba(0,0,0,.24)}',
        '@keyframes puw-spin{to{transform:rotate(360deg)}}',
      ].join('\n');
    
      return function installPower(c) {
        if (typeof document !== 'undefined') {
          /* 样式由装配层统一拥有，这里只幂等追加。 */
          PU_ensureCss('power', POWER_CSS);
        }
        return c.slots.inject('shell.overlay', function () {
          return c.slots.register(
            { name: 'shell.overlay', id: 'dsh-perfect-ui.power', order: 910,
              label: function () { return '电源菜单'; } },
            PowerSlot);
        });
      };
    }
    

    /* ============ B3. 模型触发块两行化（内联 model.js） ============ */
    /* dsh-perfect-ui — 模型两行块 + 推理强度滑块面板（Client 半边）
       按用户图2 完整实现：
         · 触发块两行：强度（绿，上）/ 模型名 · 渠道（下）—— v2.22 已生效（用户图1）；
         · 点击触发块 → 打开本插件自己的面板（不再开宿主的「模型/推理等级」列表）：
             第一行  当前强度名（绿）
             第二行  模型名 · 渠道 ›（点击 → 切到模型列表视图，换模型）
             第三行  滑块：一档一个推理强度（目录里的 efforts），拖动/点击即选中
         · 选强度/选模型都走宿主正门 remote.session.selectModel
           （wire schema 确证：{sessionId, provider, model, reasoningEffort?}
            → {selected{provider,model,reasoningEffort}}）；
           面板打开时读 remote.session.modelCatalog()
           （确证：{default, routableProviders,
            groups[{id,name,models[{id,name,reasoning:{efforts[{id,name}],
            defaultEffort}}]}]}）。
    
       边界与安全：
         · 不替换任何 shadows-shipped-ui 座位。探针注册在 conversation.input.right
           （list, replaceRisk=none），面板注册在 shell.overlay（同为 none），
           与余额卡片/电源菜单同一套浮层模式；
         · 拦截宿主触发按钮的点击用**捕获监听 + stopPropagation**：React 的委托
           监听挂在容器根，捕获阶段在元素上停止即不会打开宿主菜单。
           ⚠ 代价如实声明：宿主菜单被接管后，其搜索、pending spinner、无障碍
           名等由本面板自行承担，覆盖度不及宿主原版；任何前置条件不满足
           （拿不到会话/目录/按钮）→ **不拦截**，宿主菜单照常可用；
         · 只加类名与监听器，不移动/删除/重写宿主节点；卸载全部撤销。 */
    
    
    function PU_model(React, h) {
      'use strict';
    
      /* 强度档位的文字白名单。
         用户实测（截图）：这台的推理等级显示为「开启」而不是 低/中/高，
         旧白名单没有「开启」→ 探针判定失败 → 既不两行化也不接管点击，
         表现就是"点了还是宿主菜单、滑块不出现"。已补全开关类词。 */
      /* 强度档位文字白名单。
         ⚠ 白名单**永远不可能穷举**宿主的命名（用户环境实测出现过 "Light"，
           旧表没有 → 探针判定失败 → 点击仍走宿主菜单、面板打不开）。
         所以：白名单只作**优先命中**，最终靠 isEffortText 里的兜底判据。 */
      var EFFORT_WORDS = ['低', '中', '高', '最高', '最大', '较高', '较低',
        '轻', '轻量', '标准', '均衡', '深度', '深入', '极深',
        '开启', '关闭', '开', '关', '自动', '禁用', '启用', '无', '不思考', '思考',
        'minimal', 'low', 'medium', 'high', 'max', 'xhigh',
        'light', 'lighter', 'standard', 'balanced', 'deep', 'deeper', 'deepest',
        'thinking', 'reasoning', 'think', 'nothink',
        'on', 'off', 'auto', 'none', 'enabled', 'disabled'];
    
      function isEffortText(t) {
        if (!t) return false;
        var s = t.trim();
        if (!s || s.length > 14) return false;
    
        /* ① 白名单直接命中（含小写归一） */
        if (EFFORT_WORDS.indexOf(s) !== -1) return true;
        var low = s.toLowerCase();
        if (EFFORT_WORDS.indexOf(low) !== -1) return true;
    
        /* ② 兜底：白名单穷举不完宿主的命名。
             强度标签的特征是「短、无数字、无货币/倍率符号」。
             ⚠ 必须排除价格串（x0.12→x0.06）与模型名（含 - 或 . 的长串），
               否则会把模型名误判成强度，导致 cap/name 都错位。 */
        if (s.indexOf('x') !== -1 && /x\d/.test(low)) return false;   /* x0.12 之类 */
        if (/\d/.test(s)) return false;                                /* 含数字 */
        if (s.indexOf('→') !== -1 || s.indexOf('·') !== -1) return false;
        if (s.length > 10) return false;                                /* 太长像模型名 */
        return true;
      }
    
      /* ---------------- 共享状态（探针 ↔ 面板） ----------------
         loading 只表示"目录还没拿到"（首次打开且无缓存）。
         它绝不能被"选择正在提交"复用 —— 复用就会在拖滑块时把标题变成
         "读取中…"（用户当场指出的问题）。提交进度不需要状态位：
         拖到哪档就立即显示哪档（乐观更新），宿主回执若纠正再覆盖。 */
      /* 共享 store（store.js）：与 features/actions 同一套订阅与批通知。 */
      var mstore = PU_store2;
      var mstate = mstore.get();
      function mset(patch) { mstore.set(patch); }
      /* msub 已删除：定义后全文件无任何调用点（死代码）。
         store 的订阅统一走 mstore.subscribe。 */
      function muse() { return mstore.useStore(); }
    
      /* ---------------- 当前会话（宿主确证模式） ----------------
         宿主标题组件用 retainedBy.mainView > 0 找当前会话（asar 检索确证原文：
         Object.values(state.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)）。 */
      function currentSessionId(c) {
        try {
          var snap = c.sessions && c.sessions.list && c.sessions.list.getSnapshot && c.sessions.list.getSnapshot();
          var byId = snap && snap.byId;
          if (!byId) return null;
          var ids = Object.keys(byId);
          for (var i = 0; i < ids.length; i++) {
            var s = byId[ids[i]];
            if (s && s.retainedBy && (s.retainedBy.mainView || 0) > 0) return s.id || ids[i];
          }
        } catch (e) { /* 错误显示在面板上 */ }
        return null;
      }
    
      /* ---------------- 目录匹配 ----------------
         触发块文字可能是「Qwen3.8-Flash · 免费」这类带渠道后缀的组合，
         而目录里 model.name 只有名字本体：先精确，再前缀。 */
      function matchModel(cat, nameText) {
        if (!cat || !cat.groups) return null;
        var gs = cat.groups;
        var best = null;
        for (var g = 0; g < gs.length; g++) {
          var ms = gs[g].models || [];
          for (var m = 0; m < ms.length; m++) {
            var nm = ms[m].name || '';
            if (nm === nameText) return { group: gs[g], model: ms[m] };
            if (!best && nm && nameText.indexOf(nm) === 0) best = { group: gs[g], model: ms[m] };
          }
        }
        return best;
      }
    
      /* 触发块上的强度字是宿主直出的 effort.name（app.asar 里 effortLabel
         表达式确证：.find(...)?.name ?? effectiveEffort），可能为英文。
         面板里我已显示中文，若按钮上仍是 "High"，同一件事两种写法很难看。
         所以对已标记为 .pum-cap 的节点做一次文本本地化；原生 React 下一帧
         可能覆盖，用 MutationObserver 持续纠正（只在我们自己的 cap 节点内改）。 */
      var zhObserver = null;
      /* cachedCaps：applyOnce 每次都调本函数，而 querySelectorAll('.pum-cap') 是全页查询。
         但 .pum-cap 只由我们自己标记，数量极少（通常 1-2 个），且生命周期跟随行。
         用一个小缓存记住上一次找到的节点，先校验它们仍在文档里且还带类名，
         命中就不再做全页查询；不命中（行被宿主重建）才回退全页扫一次。 */
      var cachedCaps = [];
      var capsValid = false;
      function localizeCaptions() {
        var caps;
        if (capsValid) {
          caps = cachedCaps;
          /* 复核缓存节点仍有效（行被重建时节点会被移除）。
             注意：空数组不能算有效缓存 —— 首次扫描可能发生在模型行渲染之前，
             此时 caps 为空，若继续信任就会出现「缓存永久卡在空数组、
             之后新出现的 .pum-cap 再也扫不到」的死锁。 */
          if (caps.length === 0) capsValid = false;
          for (var c = 0; c < caps.length; c++) {
            var cc = caps[c];
            if (!cc || !cc.classList.contains('pum-cap')) { capsValid = false; break; }
          }
        }
        if (!capsValid) {
          caps = Array.prototype.slice.call(document.querySelectorAll('.pum-cap'));
          cachedCaps = caps;
          /* 只缓存非空结果；空结果下次重新扫，避免死锁。 */
          capsValid = caps.length > 0;
        }
        for (var i = 0; i < caps.length; i++) {
          var el = caps[i];
          var t = (el.textContent || '').trim();
          if (!t) continue;
          var zh = EFFORT_ZH[t.toLowerCase()];
          if (!zh) continue;
          if (el.getAttribute('data-pum-zh') === zh) continue;   // 已改过
          el.setAttribute('data-pum-zh', zh);
          el.textContent = zh;
        }
      }
      /* zhObserverRow：记住观察器当前挂在哪个 row 上。
         之前只判 zhObserver 非 null 就 return，导致宿主重建行后观察器仍挂在
         已游离的旧 row 上永不触发，强度文本本地化退化成 4 秒一次的兜底扫描
         （用户会看到 "High" 停留数秒）。现在按「row 还是不是同一个、还活着」决定是否重挂。 */
      var zhObserverRow = null;
      /* anchor 用于把监听收窄到模型行；省略时退回全页一次（只在行尚未出现时发生）。 */
      function startCaptionLocalizer(anchor) {
        if (typeof MutationObserver !== 'function') { localizeCaptions(); return; }
        var row = anchor ? findRow(anchor) : null;
        /* 已经挂在同一个仍然存活的 row 上 → 只需补一次本地化，不必重建观察器。 */
        if (row && zhObserver && zhObserverRow === row && row.isConnected) {
          localizeCaptions();
          return;
        }
        /* 目标变了或旧目标已游离 → 断开重挂。 */
        if (zhObserver) {
          try { zhObserver.disconnect(); } catch (e) { /* 已断开 */ }
          zhObserver = null;
          zhObserverRow = null;
        }
        /* 行还没渲染出来：不创建空观察器，等 applyOnce 找到行后再调本函数。 */
        if (!row) { localizeCaptions(); return; }
        /* 只关心行内新增节点：那个节点带着宿主直出的强度文本进来，我们改一次即可。 */
        zhObserver = new MutationObserver(function () { localizeCaptions(); });
        zhObserver.observe(row, { childList: true, subtree: true });
        zhObserverRow = row;
        localizeCaptions();
      }
      function stopCaptionLocalizer() {
        cachedCaps = [];
        capsValid = false;
        zhObserverRow = null;
        if (zhObserver) { try { zhObserver.disconnect(); } catch (e) { /* 已断开 */ } zhObserver = null; }
        try {
          var caps = document.querySelectorAll('.pum-cap[data-pum-zh]');
          for (var i = 0; i < caps.length; i++) caps[i].removeAttribute('data-pum-zh');
        } catch (e) { /* 已卸载 */ }
      }
      var EFFORT_ZH = {
        minimal: '最低', minimum: '最低', min: '最低', lowest: '最低',
        low: '低', lower: '低',
        medium: '中', mid: '中', moderate: '中', normal: '中', default: '中',
        high: '高', higher: '高',
        maximum: '最高', max: '最高', highest: '最高',
        xhigh: '极高', extreme: '极高', ultra: '极高',
        on: '开启', off: '关闭', enabled: '开启', disabled: '关闭',
        auto: '自动', none: '无', nothink: '不思考',
      };
    
      function effortZh(e) {
        if (!e) return '';
        var raw = String(e.name || e.id || '').trim();
        var key = raw.toLowerCase();
        if (EFFORT_ZH.hasOwnProperty(key)) return EFFORT_ZH[key];
        /* name 里可能带后缀（如 "High (default)"）：取首个词再试一次 */
        var head = key.split(/[\s(（·-]/)[0];
        if (EFFORT_ZH.hasOwnProperty(head)) return EFFORT_ZH[head];
        return raw;   // 已是中文或不认识的词，原样返回
      }
    
      /* 要求 3：滑块不要「关闭思考」这一档。
         目录里的档位可能叫 off / none / 关闭 / disabled，统一剔除。
         ⚠ 用**整词相等**而不是子串包含：旧实现把 name+id 拼起来查 'off'，
            会把 "efficient"、"currentOff" 之类误判成关闭档而整条剔掉。 */
      var OFF_WORDS = ['off', 'none', 'disabled', 'nothink', 'no', 'no-thinking'];
      function isOffEffort(e) {
        var name = String(e.name || '').trim().toLowerCase();
        var id = String(e.id || '').trim().toLowerCase();
        if (name === '关闭' || id === '关闭') return true;
        if (name === '无' || id === '无') return true;
        if (name === '不思考' || id === '不思考') return true;
        if (name.indexOf('关闭') === 0 || id.indexOf('关闭') === 0) return true;
        return OFF_WORDS.indexOf(name) !== -1 || OFF_WORDS.indexOf(id) !== -1;
      }
    
      function visibleEfforts(model) {
        var es = (model && model.reasoning && model.reasoning.efforts) || [];
        return es.filter(function (e) { return !isOffEffort(e); });
      }
    
      function pickEffortFrom(model, effortText) {
        var es = visibleEfforts(model);
        if (!es.length) return null;
        /* 三个匹配面：原始 name、id、以及**译名**。
           触发块上显示的是中文（"高"），而目录里是 "High"，
           只比 name/id 会失配，导致每次都退回默认档 —— 用户会发现
           "明明是高，打开面板却跳到别的档"。 */
        for (var i = 0; i < es.length; i++) {
          if (es[i].name === effortText || es[i].id === effortText) return es[i];
          if (effortZh(es[i]) === effortText) return es[i];
        }
        var dflt = model.reasoning && model.reasoning.defaultEffort;
        for (var j = 0; j < es.length; j++) { if (es[j].id === dflt) return es[j]; }
        return es[es.length - 1];
      }
    
      /* ---------------- remote 取用 ----------------
         用户截图红字：cannot get property "remote.session" without inject
         与余额链路对比出的关键差异：
           · features.js 用 ctx.get('remote') → 拿到**原始服务** → .account 成功；
           · 本文件用 c.remote.session → c.remote 走的是**受限门面**，
             门面对点号键逐名核对声明，'remote' 在声明里但 'remote.session' 不在，
             于是抛错。
         修复 = 采用与余额同一已验证模式：ctx.get 优先，属性访问兜底。 */
      function svc(c, name) {
        try {
          if (c && typeof c.get === 'function') {
            var v = c.get(name);
            if (v !== undefined && v !== null) return v;
          }
        } catch (e) { /* 继续属性访问 */ }
        try { return (c && c[name]) || undefined; } catch (e) { return undefined; }
      }
    
      /* ⚠ remote.session 的取法以余额链路（已验证成功）为准：
           features.js: svc(ctx,'remote') → ctx.get('remote') → facade → .account ✓
         v2.23.0 用的是 c.remote.session（ctx 属性代理再点命名空间）→
           抛 cannot get property "remote.session" without inject（用户截图）。
         两条代理路径的检查粒度不同：ctx 属性代理按点号键核对声明，
         而 ctx.get('remote') 返回的对象直接点命名空间是通的。
         取用顺序：点号键 get（可能命中服务注册表）→ get('remote').session
         （余额证明的路径）→ 都不成则报可见错误。
         ⚠ 不把 'remote.session' 写进插件 inject：它不是 Cordis 服务键，
         硬依赖解析不到会让整包不活动，连配色一起消失。 */
      function sessionRemoteOf(c) {
        var ns = svc(c, 'remote.session');
        if (ns && typeof ns.modelCatalog === 'function') return ns;
        try {
          var remote = svc(c, 'remote');
          if (remote && remote.session) return remote.session;
        } catch (e) { /* 交给调用方报错 */ }
        return null;
      }
    
      /* ---------------- 应用选择（宿主正门） ----------------
         切换强度是**改一个已有预设值**，不是读数据：
           · 不用 loading —— 那会让标题变"读取中…"（用户当场指出）；
           · 不做防重入：selectModel 幂等，重复提交只是多一次请求；
             界面上强度名始终显示当前档位；
           · 拖到哪一档就立即显示哪一档（乐观更新），宿主回执若纠正再覆盖。 */
      function applySelection(c) {
        var sid = currentSessionId(c);
        if (!sid) { mset({ error: '未找到当前会话（mainView 保留为空）' }); return; }
        var body = { sessionId: sid, provider: mstate.providerId, model: mstate.modelId };
        if (mstate.effortId) body.reasoningEffort = mstate.effortId;
        var my = ++selToken;          // 快速连续拖动时只认最后一次的回执
        mset({ error: '' });
        var call;
        try {
          var session = sessionRemoteOf(c);
          if (!session || typeof session.selectModel !== 'function') {
            mset({ error: 'remote.session.selectModel 不可用' });
            return;
          }
          call = Promise.resolve(session.selectModel(body));
        } catch (e) {
          mset({ error: 'selectModel 抛出：' + (e && e.message ? e.message : String(e)) });
          return;
        }
        call.then(function (r) {
          if (my !== selToken) return;   // 已有更新的选择在途，丢弃这次回执
          if (!r || r.ok !== true) {
            mset({ error: '选择未生效：' + ((r && r.error && (r.error.message || r.error.code)) || '未知') });
            return;
          }
          var sel = r.value && r.value.selected;
          /* 只有宿主回执纠正档位时才更新；档位一致就什么都不用做。
             原先的 else 分支只重设 busy，去掉后省掉一次空转重渲染。 */
          if (sel && sel.reasoningEffort && sel.reasoningEffort !== mstate.effortId) {
            mset({ effortId: sel.reasoningEffort });
          }
        }).catch(function (e) {
          if (my !== selToken) return;
          mset({ error: '选择失败：' + (e && e.message ? e.message : String(e)) });
        });
      }
    
      /* 目录缓存：推理强度是模型自带的预设档位，不随会话变化。
         首次打开才真的去读，之后直接用缓存立即渲染，后台静默刷新。 */
      var catalogCache = null;
      var catalogInflight = false;
      var selToken = 0;            // 选择请求序号，防止旧回执覆盖新选择
    
      /* ---------------- 打开面板：读目录并定位当前 ---------------- */
      function openPanel(c, btn) {
        var label = btn.querySelector('.pum-label');
        var cap = btn.querySelector('.pum-cap');
        var nameText = ((label && label.textContent) || (btn.textContent || '')).trim();
        var effortText = (cap && cap.textContent || '').trim();
        var hasCache = !!catalogCache;
        /* 有缓存 → 立即用缓存定位当前档位，界面不出现"读取中"；
           无缓存（本进程第一次打开）→ 才显示读取中，并且只此一次。 */
        mset({ open: true, btn: btn, loading: !hasCache, error: '',
          modelName: nameText, effortName: effortText || '—' });
    
        function locate(cat) {
          var mm = matchModel(cat, nameText);
          if (!mm) {
            mset({ loading: false, catalog: cat, error: '当前模型不在目录：' + nameText });
            return;
          }
          var eff = pickEffortFrom(mm.model, effortText);
          mset({ loading: false, catalog: cat,
            providerId: mm.group.id, modelId: mm.model.id, modelName: mm.model.name,
            effortId: eff ? eff.id : '',
            effortName: eff ? effortZh(eff) : (effortText || '—') });
        }
    
        if (hasCache) {
          locate(catalogCache);
          if (catalogInflight) return;          // 已有后台刷新在跑，不重复发
        }
    
        var call;
        try {
          var session = sessionRemoteOf(c);
          if (!session || typeof session.modelCatalog !== 'function') {
            mset({ loading: false, error: 'remote.session 取不到（modelCatalog 不可用）' });
            return;
          }
          catalogInflight = true;
          call = Promise.resolve(session.modelCatalog());
        } catch (e) {
          catalogInflight = false;
          mset({ loading: false, error: 'modelCatalog 抛出：' + (e && e.message ? e.message : String(e)) });
          return;
        }
        call.then(function (r) {
          catalogInflight = false;
          if (!r || r.ok !== true) {
            mset({ loading: false, error: '目录读取失败：' + ((r && r.error && (r.error.message || r.error.code)) || '未知') });
            return;
          }
          catalogCache = r.value;
          /* 后台刷新：只有这次打开的面板仍是最新一轮时才回写，避免旧响应覆盖新面板 */
          if (mstate.open && mstate.btn === btn) locate(r.value);
        }).catch(function (e) {
          catalogInflight = false;
          mset({ loading: false, error: '目录调用异常：' + (e && e.message ? e.message : String(e)) });
        });
      }
    
      /* ---------------- 探针：找按钮 + 接管点击 ----------------
         两条互斥路径，靠 delegateOnce 区分：
           · 正常点击触发块 → 阻止事件到达宿主（否则宿主列表会和本面板同时弹出），
             打开本面板；
           · 面板里点「更换模型」→ 置 delegateOnce，收起面板后再放一次点击过去，
             这一次**不阻止**，宿主原生列表照常弹出（搜索、1017 徽章等全部保留）。 */
      var ctxRef = null;
      var delegateOnce = false;
      var hooked = [];   // [{btn, fn}] 卸载时逐个移除
    
      /* 用户要求：跳过宿主根菜单（「模型 / 推理等级」两行），**直接**进模型列表。
         做法：委托点击让根菜单弹出后，自动点其中的「模型」行 —— ui-model-selection
         README:34 确证该行会 drill 进模型列表（"Drilling focuses model search when
         shown, otherwise the current model or effort row"）。
         判据用行首文本「模型」，不猜宿主 class；找不到就保留根菜单让用户手点，
         不会白屏也不会卡死。20 次 × 60ms 上限，弹层动画再慢也够。 */
      var drillTimer = null;
      function stopDrill() { if (drillTimer) { clearInterval(drillTimer); drillTimer = null; } }
    
      function drillToModelList() {
        stopDrill();
        var tries = 0;
        drillTimer = setInterval(function () {
          tries += 1;
          if (tries > 20) {
            /* 20 次（约 1.2s）都没找到「模型」行 → 放弃 drill，
               同时必须移除隐藏类，否则宿主菜单会永久不可见。 */
            stopDrill();
            try { document.body.classList.remove('pum-drilling'); } catch (e) { /* 忽略 */ }
            return;
          }
          var nodes = document.querySelectorAll(
            '[role="menuitem"], [role="menuitemradio"], [role="option"], [role="button"], button');
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.closest && n.closest('.pum-panel')) continue;   // 绝不点自己的面板
            var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
            if (!t || t.length > 48) continue;
            if (t.indexOf('模型') !== 0) continue;                 // 行首必须是「模型」
            if (t.indexOf('推理等级') === 0) continue;
            stopDrill();
            n.click();
            hostListMaybeOpen = true;   /* 列表即将出现：允许校正逻辑工作 */
            /* 已点进「模型」→ 真正的模型列表正在打开，
               这时才揭掉隐藏，用户直接看到列表（看不到根菜单）。 */
            try { document.body.classList.remove('pum-drilling'); } catch (e) { /* 忽略 */ }
            /* 宿主列表刚展开：安排多次校正，抵消它自己的定位与动画 */
            scheduleAlignHostList();
            return;
          }
        }, 60);
      }
    
      /* ---------------- 宿主模型列表：探测 + 关闭 ----------------
         为什么需要它：宿主列表与我的面板是两个独立浮层，
         触发块只知道自己面板的开关状态，所以宿主列表展开时点击会叠出两个。
         这里在点击时先探测，可见就只关它。
    
         探测（不猜宿主构建期 class）：
           找 role=menu / listbox / dialog 的可见浮层，且满足其一：
             · 内部有 placeholder 含「搜索模型」的输入框
             · 内部 >= 3 个 role=menuitem / menuitemradio / option
         关闭：
             · 优先发 Escape 给 document（宿主自己收起，最干净）
             · 兜底：再点一次触发块（宿主实现通常是 toggle）
         只做「关」，不点任何宿主行，避免误选模型。 */
      function hostModelListOpen() {
        try {
          /* ⚠ 外层不再只查 role —— 宿主的模型列表可能是个普通 div，
             之前写死 role 会导致 nodes 恒为空，后面所有判据都执行不到
             （用户实测"还是没居中"的直接原因）。
             改为扫 body 下所有元素，再逐层用 position/尺寸/内容判据筛选。
             性能：body 直接子元素通常 <100 个，且本函数只在宿主行变化时跑。 */
          var nodes = Array.prototype.slice.call(document.body.children);
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!n || !n.isConnected) continue;
            if (n.closest && n.closest('.pum-panel')) continue;   // 排除自己的面板
            /* 不可见就跳过（display:none / 尺寸为 0） */
            var r = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
            if (r && (r.width < 80 || r.height < 80)) continue;
    
            /* 判据 A：搜索模型输入框 */
            var inp = n.querySelector ? n.querySelector('input') : null;
            var ph = inp ? String(inp.getAttribute('placeholder') || inp.placeholder || '') : '';
            if (ph && ph.indexOf('模型') !== -1) return true;
    
            /* 判据 B：模型行数量 */
            var rows = n.querySelectorAll
              ? n.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')
              : null;
            if (rows && rows.length >= 3) return true;
          }
        } catch (e) { /* 探测失败当作未打开，不影响主流程 */ }
        return false;
      }
    
      /* 收起宿主列表。返回 true 表示做了动作。 */
      /* ---------------- 把宿主模型列表居中到触发块 ----------------
         宿主用内联 left/right 定位这个浮层，右对齐。
         这里改成「相对触发块中心」对齐：
           left = btnCenter - panelWidth/2，再夹进视口。
    
         ⚠ 只改 left/right，不动尺寸、内容、层级。
         ⚠ 探测不到就静默返回，绝不抛错（守卫客户端不拖死宿主）。 */
      /* 用 WeakSet 而不是数组：节点被移除时自动回收，
         不会像数组那样需要手动 shift 防泄漏。 */
      var HOST_LIST_ALIGNED = (typeof WeakSet === 'function') ? new WeakSet() : null;
    
      /* ---- 性能闸门：宿主列表不在时直接退出 ----
         ⚠ alignHostModelList 会读 getBoundingClientRect 与 textContent，
           这些**强制重排**。而它被 MutationObserver 在每次 DOM 变化时调用，
           聊天流式输出每秒几十次 → 主线程被同步布局读取拖住（卡顿根源）。
         所以：先用一个几乎零成本的标志判断"列表是否可能开着"，不在就立刻返回。 */
      var hostListMaybeOpen = false;
    
      function alignHostModelList() {
        try {
          /* 闸门 1：我们自己知道列表没开 → 一次 DOM 读取都不做 */
          if (!hostListMaybeOpen) return;
          if (!mstate.btn || !document.contains(mstate.btn)) return;
          /* ⚠ 外层不再只查 role —— 宿主模型列表可能是个普通 div。
             写死 role 会让 nodes 恒为空，后面所有几何/内容判据都执行不到，
             这正是「还是没居中」的直接原因。
             改为扫 body 直接子元素，再用 position/尺寸/内容逐层筛。 */
          var nodes = Array.prototype.slice.call(document.body.children);
          /* 浮层也可能挂在自己造的 portal 容器里（body 孙辈）。
             把这些容器的子元素一并纳入候选，避免漏掉。 */
          var extra = [];
          for (var bi = 0; bi < nodes.length; bi++) {
            var c0 = nodes[bi];
            if (!c0 || !c0.children || c0.children.length === 0) continue;
            /* 只对「看起来像 portal 容器」的（无文本、有子元素、覆盖层样式）扩展一层 */
            var txt0 = (c0.textContent || '').trim();
            if (txt0.length > 200) continue;        /* 有大量文本的是内容容器，不是 portal */
            for (var ci = 0; ci < c0.children.length; ci++) extra.push(c0.children[ci]);
          }
          nodes = nodes.concat(extra);
    
          var r0 = mstate.btn.getBoundingClientRect();
          var cx = r0.left + r0.width / 2;
          var EDGE = 8;
    
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!n || !n.isConnected) continue;
            if (n.closest && n.closest('.pum-panel')) continue;   /* 排除我的面板 */
    
            /* ---- 探测：不再依赖 role 属性（宿主可能根本不给 role）----
               改为「几何 + 内容」双重判据，覆盖普通 div 浮层。
               之所以敢放开：这里只改 left/right，改错也不影响功能，
               且下面还有尺寸/内容门槛避免误伤别的浮层。 */
            var cs = null;
            try { cs = window.getComputedStyle(n); } catch (eCs) { cs = null; }
            var pos = cs ? cs.position : '';
            if (pos !== 'fixed' && pos !== 'absolute') continue;
    
            var rect = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
            if (!rect) continue;
            /* 尺寸门槛：模型列表是个不小的面板；太小的浮层（tooltip 等）跳过 */
            if (rect.width < 200 || rect.height < 150) continue;
            if (rect.width > window.innerWidth * 0.98) continue;   /* 全屏遮罩排除 */
    
            /* 内容判据：含搜索 input，或含足够多的可点击行 */
            var hasSearch = false;
            var inp = n.querySelector ? n.querySelector('input') : null;
            var ph = inp ? String(inp.getAttribute('placeholder') || inp.placeholder || '') : '';
            if (ph && (ph.indexOf('模型') !== -1 || ph.indexOf('搜索') !== -1)) hasSearch = true;
    
            var clickables = 0;
            if (n.querySelectorAll) {
              clickables = n.querySelectorAll(
                'button, [role="menuitem"], [role="menuitemradio"], [role="option"], [tabindex]'
              ).length;
            }
            if (!hasSearch && clickables < 5) continue;   /* 不像列表就跳过 */
    
            /* ---- 居中：以触发块中心为基准 ---- */
            var w = rect.width;
            var left = Math.round(cx - w / 2);
            /* 夹取放宽：优先真正居中；只有装不下时才贴边（左右各留 EDGE） */
            if (w + EDGE * 2 <= window.innerWidth) {
              left = Math.min(Math.max(EDGE, left), window.innerWidth - w - EDGE);
            } else {
              left = 0;   /* 比视口还宽：贴左，让右侧自然溢出 */
            }
    
            /* 只有当偏差超过 2px 才写，避免每帧都触发重排 */
            if (Math.abs(rect.left - left) > 2) {
              try {
                n.style.setProperty('left', left + 'px', 'important');
                n.style.setProperty('right', 'auto', 'important');
                /* 宿主可能用 transform 定位，一并归零 */
                n.style.setProperty('transform', 'none', 'important');
              } catch (eS) { /* 单个节点失败不影响其它 */ }
    
              /* 记录已校正（WeakSet 自动回收，无需防泄漏逻辑） */
              if (HOST_LIST_ALIGNED) { try { HOST_LIST_ALIGNED.add(n); } catch (e) { /* 忽略 */ } }
            }
          }
        } catch (e) { /* 静默：劫持失败只是保持宿主原位置 */ }
      }
    
      var alignTimers = [];
      /* 打开后校正宿主列表位置。
         ① queueMicrotask：**在浏览器绘制前**执行 —— 这是消除 1 帧跳动的关键。
            setTimeout(0) 是宏任务，宿主那一帧已经画在右边了。
         ② 之后的延时校正用于兜住宿主稍后再改回原位（动画/重排）。 */
      function scheduleAlignHostList() {
        for (var i = 0; i < alignTimers.length; i++) clearTimeout(alignTimers[i]);
        alignTimers = [];
        /* 微任务：绘制前先改一次，用户看不到右对齐那一帧 */
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(function () {
            try { alignHostModelList(); } catch (e) { /* 忽略 */ }
          });
        } else {
          try { alignHostModelList(); } catch (e) { /* 忽略 */ }
        }
        /* 后续兜底：宿主可能在自己的渲染周期里把位置写回去 */
        [30, 90, 180, 320].forEach(function (d) {
          alignTimers.push(setTimeout(function () {
            try { alignHostModelList(); } catch (e) { /* 忽略 */ }
          }, d));
        });
      }
    
      /* 收起宿主浮层树。
         ⚠ 为什么不能只发一次 Escape：宿主是**分层菜单**
            （根菜单「模型 / 推理等级」→ 模型列表），Escape 每次只退一层，
            实测一次 Escape 后根菜单仍在（用户截图可见）。
         所以要逐层退干净，再补一次「点外部空白」——
         宿主普遍用 click-outside 关闭，这条比 Escape 更彻底。
         每步之后都复查 hostModelListOpen()，还开着就继续。 */
      function closeHostModelList() {
        /* ① 逐层 Escape：**固定 3 次**，不看检测结果。
           为什么不 break：根菜单可能是普通 div 而非 role=menu，
           hostModelListOpen() 判据覆盖不到它，一旦 break 就少退一层，
           根菜单会残留（用户已实测到该现象）。
           进入本函数的前提是调用方已确认浮层开着，所以连发 3 次不会误伤。 */
        for (var k = 0; k < 3; k++) {
          try {
            var ev = new KeyboardEvent('keydown', {
              key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true,
            });
            (document.activeElement || document.body).dispatchEvent(ev);
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true,
            }));
          } catch (e) { /* 不支持 KeyboardEvent 构造：跳过，靠 ② 兜底 */ }
        }
    
        /* ② 在浮层外派发完整的指针/点击序列（**无条件执行**）。
             宿主挂 click-outside 用的是 pointerdown + mousedown + click，
             只发 click 往往不触发，三个都发才稳。
             坐标取视口左下角内侧（远离所有浮层）。 */
        {
          try {
            var x = 8;
            var y = Math.max(8, window.innerHeight - 12);
            var opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
            var target = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
            if (!target || (target.closest && target.closest('[role="menu"], [role="dialog"], [role="listbox"]'))) {
              target = document.body;
            }
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
              try {
                var Ctor = (type.indexOf('pointer') === 0 && typeof PointerEvent === 'function')
                  ? PointerEvent : MouseEvent;
                target.dispatchEvent(new Ctor(type, opts));
              } catch (e) { /* 单种事件失败不影响其它 */ }
            });
          } catch (e) { /* 兜底失败：宿主可能自己会关 */ }
        }
    
        /* ③ 复位 aria（视觉上不再显示"已展开"） */
        try { if (mstate.btn) mstate.btn.setAttribute('aria-expanded', 'false'); } catch (e) { /* 忽略 */ }
        try { unlockBtnWidth(); } catch (e) { /* 忽略 */ }
        /* 闸门复位：列表已收起，后续 MutationObserver 调用直接短路，
           不再做任何强制重排的测量。 */
        hostListMaybeOpen = false;
        return true;
      }
    
      /* ---------------- 展开时锁定宽度 ----------------
         展开后文字从「模型名 · 倍率 强度」变成「选择推理强度」，字数变少，
         按钮会按内容收缩，造成宽度跳变（用户要求宽度保持不变）。
         做法：打开前量出当前宽度写进内联 style 锁定，关闭时清掉。
    
         ⚠ 用 getBoundingClientRect().width 而不是 offsetWidth：
           前者含亚像素，缩放屏幕下更准。取 Math.ceil 避免差 1px 触发换行。 */
      var lockedWidthBtn = null;
      var lockedWidthPx = 0;
    
      function lockBtnWidth(btn) {
        try {
          if (!btn || !btn.style) return;
          var w = Math.ceil(btn.getBoundingClientRect().width);
          if (!w || w < 40) return;                 /* 尺寸异常就不锁，避免锁成 0 */
          lockedWidthBtn = btn;
          lockedWidthPx = w;
          btn.style.setProperty('width', w + 'px', 'important');
          btn.style.setProperty('min-width', w + 'px', 'important');
          btn.style.setProperty('max-width', w + 'px', 'important');
          /* 不换行：锁定后文字更短，但要保证不会因为内边距挤压而折行 */
          btn.style.setProperty('white-space', 'nowrap', 'important');
        } catch (e) { /* 忽略 */ }
      }
    
      function unlockBtnWidth() {
        try {
          var b = lockedWidthBtn;
          if (b && b.style) {
            b.style.removeProperty('width');
            b.style.removeProperty('min-width');
            b.style.removeProperty('max-width');
            b.style.removeProperty('white-space');
          }
        } catch (e) { /* 忽略 */ }
        lockedWidthBtn = null;
        lockedWidthPx = 0;
      }
    
      function hookButton(btn) {
        for (var i = 0; i < hooked.length; i++) { if (hooked[i].btn === btn) return; }
        var fn = function (e) {
          if (!ctxRef) return;
          if (delegateOnce) { delegateOnce = false; return; }  // 放这一次给宿主
          e.preventDefault();
          e.stopPropagation();
    
          /* 点这个按钮可能打开宿主列表 → 先放行校正逻辑。
             若下面走的是「关闭」分支，closeHostModelList 会复位为 false。 */
          hostListMaybeOpen = true;
    
          /* ① 我的面板开着 → 关它（同时释放宽度锁） */
          if (mstate.open && mstate.btn === btn) {
            mset({ open: false });
            unlockBtnWidth();
            btn.setAttribute('aria-expanded', 'false');
            return;
          }
    
          /* ② 宿主模型列表开着 → **只关它**，不开我的面板（用户要求）。
                否则两个浮层会叠在一起。 */
          if (hostModelListOpen()) {
            stopDrill();                       /* 别让 drill 定时器继续点「模型」 */
            closeHostModelList();
            btn.setAttribute('aria-expanded', 'false');
            return;
          }
    
          /* ③ 都没开 → 开我的面板。
             先锁定当前宽度再展开：展开后文字变短会让按钮收缩、宽度跳变，
             锁住后视觉上宽度不变（用户要求）。 */
          lockBtnWidth(btn);
          btn.setAttribute('aria-expanded', 'true');
          openPanel(ctxRef, btn);
        };
        btn.addEventListener('click', fn, true);
        hooked.push({ btn: btn, fn: fn });
      }
    
      function unhookAll() {
        stopDrill();
        for (var i = 0; i < hooked.length; i++) {
          try { hooked[i].btn.removeEventListener('click', hooked[i].fn, true); } catch (e) { /* 已移除 */ }
        }
        hooked = [];
      }
    
      /* pruneHooked：修剪已脱离文档的按钮条目。
         宿主重建模型行时会生成新的按钮节点，旧节点变成游离 DOM 子树；
         但 hooked 里的 {btn, fn} 条目会一直持有它的引用，直到 unhookAll 才清。
         长时间会话中每次宿主重建行都 push 一条 → 无界增长 + 持续持有游离子树。
         这里在每次 applyOnce 前先剪掉已游离的，顺带移除其监听器（虽对游离节点无效，
         但保持「监听器数量 = 数组长度」的不变式，便于将来排查）。 */
      function pruneHooked() {
        if (hooked.length === 0) return;
        var keep = [];
        var pruned = 0;
        for (var i = 0; i < hooked.length; i++) {
          var h = hooked[i];
          if (h.btn && h.btn.isConnected) { keep.push(h); continue; }
          try { h.btn.removeEventListener('click', h.fn, true); } catch (e) { /* 已移除 */ }
          pruned += 1;
        }
        if (pruned > 0) hooked = keep;
      }
    
      function findRow(anchor) {
        var node = anchor;
        for (var depth = 0; depth < 6 && node.parentElement; depth++) {
          node = node.parentElement;
          if (node.querySelectorAll && node.querySelectorAll('button').length >= 2) return node;
        }
        return null;
      }
    
      function applyOnce(anchor) {
        try {
          if (!anchor || !document.contains(anchor)) return;
          /* ⚠ 前置判断用**廉价探测**，不要直接调 alignHostModelList ——
             后者做 getBoundingClientRect / textContent（强制重排），
             在流式输出期间被高频触发会造成卡顿。
             这里只用 hostModelListOpen()（它虽也扫 DOM，但已有尺寸早退），
             且仅在「闸门为假」时才探测一次，作为自愈路径。 */
          if (!hostListMaybeOpen && hostModelListOpen()) {
            hostListMaybeOpen = true;
          }
          alignHostModelList();
          /* 先修剪注册表：宿主每重建一次模型行都会产生新按钮节点，
             旧条目若不清会无界增长并持续持有游离 DOM 子树。 */
          pruneHooked();
          var row = findRow(anchor);
          if (!row) return;
          var buttons = Array.prototype.slice.call(row.querySelectorAll('button'));
          for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.contains(anchor)) continue;
            /* 已经标记过就跳过整轮扫描：这是本函数最贵的一段（遍历后代 + 读文本）。
               宿主重建按钮会连带丢掉类名，所以「没标记」才是需要干活的状态。 */
            if (btn.classList && btn.classList.contains('pum-two-line')) {
              if (mstate.open && mstate.btn === btn) {
                btn.setAttribute('aria-expanded', 'true');
                /* 补宽度锁：宿主重渲染会丢掉内联 style，宽度就跳回去了。
                   ⚠ 必须用保存的 lockedWidthPx 原值，**不能重新量** ——
                   此刻文字已是「选择推理强度」，量出来是短宽度。 */
                try {
                  if (lockedWidthBtn === btn && lockedWidthPx > 0 &&
                      !btn.style.getPropertyValue('width')) {
                    btn.style.setProperty('width', lockedWidthPx + 'px', 'important');
                    btn.style.setProperty('min-width', lockedWidthPx + 'px', 'important');
                    btn.style.setProperty('max-width', lockedWidthPx + 'px', 'important');
                  }
                } catch (eW) { /* 忽略 */ }
              }
              /* 补一次 .pum-hint：宿主整体重建子节点时可能把这个外来节点抹掉，
                 抹掉后展开态就没有「选择推理强度」了。这里代价只有一次
                 querySelector，比等用户发现文字不见再排查便宜得多。 */
              try {
                /* 用「先清空、再插入」而不是「查重后插入」：
                   查重在宿主快速重建时会漏删，残留两份 →
                   两个「选择推理强度」叠在同一绝对定位层 → 文字重影（已实测）。
                   清空策略幂等，无论残留几份都归零。 */
                var stale = btn.querySelectorAll('.pum-hint');
                for (var si = 0; si < stale.length; si++) {
                  if (stale[si].parentElement) stale[si].parentElement.removeChild(stale[si]);
                }
                var hint0 = document.createElement('span');
                hint0.className = 'pum-hint';
                hint0.textContent = '选择推理强度';
                hint0.setAttribute('aria-hidden', 'true');
                var lab0 = btn.querySelector('.pum-label');
                if (lab0 && lab0.parentElement === btn && btn.insertBefore) {
                  btn.insertBefore(hint0, lab0);
                } else {
                  btn.appendChild(hint0);
                }
              } catch (e0) { /* 忽略 */ }
              continue;
            }
            var kids = Array.prototype.slice.call(btn.querySelectorAll('*'));
            var cap = null, name = null;
            for (var j = 0; j < kids.length; j++) {
              var n = kids[j];
              if (n.children.length > 0) continue;
              var t = (n.textContent || '').trim();
              if (!cap && isEffortText(t)) cap = n;
              else if (!name && t.length > 4 && t.indexOf('选择') === -1) name = n;
            }
            if (!cap || !name) continue;
            btn.classList.add('pum-two-line');
            cap.classList.add('pum-cap');
            name.classList.add('pum-label');
            /* 追加「选择推理强度」提示节点：面板展开时由 CSS 换上来显示。
               为什么用独立节点而不是改 label/cap 的文本：
               那两个节点由宿主 React 渲染，下一帧会把我们的修改覆盖回去
               （表现为文字闪一下又变回原样）。独立节点宿主不认识，不会被重写。 */
            try {
              /* 同样「先清空、再插入」——两个插入点用同一套策略，
                 避免一处查重一处清空导致的不一致残留。 */
              var staleM = btn.querySelectorAll('.pum-hint');
              for (var mi = 0; mi < staleM.length; mi++) {
                if (staleM[mi].parentElement) staleM[mi].parentElement.removeChild(staleM[mi]);
              }
              var hint = document.createElement('span');
              hint.className = 'pum-hint';
              hint.textContent = '选择推理强度';
              hint.setAttribute('aria-hidden', 'true');
              if (name.parentElement === btn && btn.insertBefore) {
                btn.insertBefore(hint, name);
              } else {
                btn.appendChild(hint);
              }
            } catch (e) { /* 插入失败不影响主流程 */ }
            /* 把"面板是否正开着"写成真实 aria-expanded：
               既是无障碍语义，也让 CSS 的展开态高亮真正生效
               （此前只有选择器没人设属性，那条规则一直是死的）。 */
            btn.setAttribute('aria-expanded',
              (mstate.open && mstate.btn === btn) ? 'true' : 'false');
            hookButton(btn);
          }
          /* 行已确认存在：把本地化监听挂到这一行。
             ⚠ 不能加 `if (!zhObserver)` 守卫 —— 宿主重建行后 zhObserver 仍非 null
             但挂在已游离的旧 row 上，守卫会让它永远不重挂。
             本函数内部已按「row 是否是同一个且仍存活」判断，重复调用是幂等的。 */
          startCaptionLocalizer(anchor);
          localizeCaptions();
        } catch (e) {
          /* 探针异常：静默。桌面版无控制台，此处没有可展示的诊断出口，
             失败表现为「面板没接管」，由用户截图反馈。 */
        }
      }
    
      function cleanupClasses() {
        capsValid = false;
        try {
          /* 三类标记合并为一次全页查询：原来分三次 querySelectorAll
             （.pum-cap / .pum-two-line / .pum-label），每次都要遍历整页。
             用一个逗号选择器一次拿到全部，再按类名分派，少两次 DOM 遍历。
             这些类只由我们自己标记，数量极少，开销主要在「遍历」不在「命中」。 */
          var nodes = document.querySelectorAll('.pum-cap, .pum-two-line, .pum-label');
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.classList.contains('pum-cap')) n.classList.remove('pum-cap');
            if (n.classList.contains('pum-two-line')) n.classList.remove('pum-two-line');
            if (n.classList.contains('pum-label')) n.classList.remove('pum-label');
          }
        } catch (e) { /* 已卸载 */ }
      }
    
      /* ---------------- 面板（shell.overlay，与余额卡片同模式） ---------------- */
      function Panel(c) {
        muse();
        var ref = React.useRef(null);
        var open = mstate.open;
    
        React.useEffect(function () {
          if (!open) return undefined;
          /* 关闭动作集中在这里：除了收起面板，还要把 aria-expanded 复位，
             否则展开态高亮会滞留在按钮上（点击外部/Esc 都会走到）。 */
          function close() {
            mset({ open: false });
            if (mstate.btn) {
              try { mstate.btn.setAttribute('aria-expanded', 'false'); } catch (e) { /* 已移除 */ }
            }
          }
          function onDown(e) {
            if (ref.current && ref.current.contains(e.target)) return;
            if (mstate.btn && mstate.btn.contains(e.target)) return;
            close();
          }
          function onKey(e) { if (e.key === 'Escape') close(); }
          document.addEventListener('pointerdown', onDown, true);
          document.addEventListener('keydown', onKey);
          return function () {
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('keydown', onKey);
          };
        }, [open]);
    
        if (!open) return null;
    
        /* 定位：贴触发块上方，**水平居中**（用户要求，原来是右缘对齐） */
        var style = { position: 'fixed', zIndex: 2147483002 };
        var PANEL_W = 280;   /* 与 .pum-panel 的 width 保持一致 */
        var EDGE = 8;        /* 视口左右最小留白 */
        if (mstate.btn && document.contains(mstate.btn)) {
          var r = mstate.btn.getBoundingClientRect();
          style.bottom = Math.max(8, Math.round(window.innerHeight - r.top + 8)) + 'px';
          /* 以按钮中心为基准算 left，再夹进视口内 */
          var cx = r.left + r.width / 2;
          var left = Math.round(cx - PANEL_W / 2);
          var maxLeft = Math.max(EDGE, window.innerWidth - PANEL_W - EDGE);
          left = Math.min(Math.max(EDGE, left), maxLeft);
          style.left = left + 'px';
          /* 显式清掉 right：它和 left 同时存在时，若元素宽超容器会互相牵制 */
          style.right = 'auto';
        } else { style.bottom = '120px'; style.left = 'auto'; style.right = '40px'; }
    
        var efforts = [];
        var mm = mstate.catalog ? matchModel(mstate.catalog, mstate.modelName) : null;
        if (mm) {
          efforts = visibleEfforts(mm.model);
          /* 当前档位如果被「关闭思考」规则剔掉了，就不能再假装它在第 0 档 ——
             那会让滑块显示在最左端，谎报状态。此时退回完整档位表，
             保证滑块位置与宿主实际选择一致。 */
          var all = (mm.model.reasoning && mm.model.reasoning.efforts) || [];
          if (mstate.effortId && !efforts.some(function (e) { return e.id === mstate.effortId; }) &&
            all.some(function (e) { return e.id === mstate.effortId; })) {
            efforts = all;
          }
        }
        var idx = 0, found = false;
        for (var i = 0; i < efforts.length; i++) {
          if (efforts[i].id === mstate.effortId) { idx = i; found = true; }
        }
        if (!found && efforts.length) idx = efforts.length - 1;
    
        function onSlider(e) {
          var k = Number(e.target.value);
          var eff = efforts[k];
          if (!eff || eff.id === mstate.effortId) return;
          mset({ effortId: eff.id, effortName: effortZh(eff) });
          applySelection(c);
        }
    
        /* 填充分界百分比：滑块中心的可移动区间是 [R, 260-R]，R = 31/2。
           直接用 idx/(n-1) 会让分界与滑块中心在两端错开约 15px，所以按中心算。 */
        /* 圆片直径 24 → 半径 12；轨道宽 260。行程 = W - 2*R = 236 */
          /* 圆片直径 28 → 半径 14；轨道宽 260。行程 = 260 - 28 = 232 */
          /* 圆片直径 28 → 半径 14；轨道宽 260。行程 = 260 - 28 = 232 */
          var THUMB_R = 14, TRACK_W = 260;
        var ratio = efforts.length > 1 ? idx / (efforts.length - 1) : 0;
        var fillPct = ((THUMB_R + (TRACK_W - 2 * THUMB_R) * ratio) / TRACK_W) * 100;
    
        var body = h(React.Fragment, null,
          /* 顶部整块 = 模型切换触发范围（图3 红箭头所指）：
             点击 → 收起本面板 → 把这一次点击交还给宿主 → 自动 drill 进模型列表，
             不停留在宿主的「模型 / 推理等级」根菜单。 */
          h('div', { className: 'pum-effort-model-row', role: 'button', tabIndex: 0,
            title: '更换模型',
            onClick: function (e) {
              e.stopPropagation();
              e.preventDefault();
              delegateOnce = true;
              mset({ open: false });
              if (mstate.btn) {
                /* 先给 body 打上 pum-drilling：宿主浮层渲染出来但 opacity 0，
                   用户不会看到「模型 / 推理等级」根菜单那一帧。
                   drill 成功点进「模型」后由 drillToModelList 移除。 */
                try { document.body.classList.add('pum-drilling'); } catch (e) { /* 忽略 */ }
                setTimeout(function () {
                  mstate.btn.click();
                  drillToModelList();
                }, 0);
              }
            } },
            h('div', { className: 'pum-effort-name' },
              mstate.loading ? '读取中…' : mstate.effortName),
            h('div', { className: 'pum-model-name-cell' },
              h('span', { className: 'pum-model-name-text' }, mstate.modelName || '—'),
              h('span', { className: 'pum-chev' }, '›'))),
          /* 滑块：只要目录里有档位就画（>=1），不再要求 >1 —— 之前只要
             模型只剩一档就整条滑块消失，看起来就像"功能坏了"。 */
          efforts.length >= 1
            ? h('div', { className: 'pum-slider' },
                /* 视觉层：灰轨 + 蓝色填充 + 白色滑块，全部可过渡 */
                /* 轨道与填充用同一个 SVG 绘制 ——
                   两者共享 viewBox 与 clipPath，端点圆角**结构上一致**，
                   不可能再出现「填充方角越出轨道圆角」的像素对不齐。 */
                h('svg', {
                  width: '260',
                  height: '18',
                  viewBox: '0 0 260 18',
                  preserveAspectRatio: 'none',
                  style: {
                    position: 'absolute',
                    left: '0',
                    top: 'calc((var(--pus-slider-h) - var(--pus-track-h)) / 2)',
                    display: 'block',
                    width: '260px',
                    height: '18px',
                    overflow: 'visible',
                  },
                  'aria-hidden': 'true',
                },
                  /* clipPath：胶囊形，按轨道高 18 → 圆角 9 */
                  h('defs', null,
                    h('clipPath', { id: 'pum-track-clip' },
                      h('rect', { x: '0', y: '0', width: '260', height: '18', rx: '9', ry: '9' }),
                    ),
                  ),
                  /* 轨道底：灰胶囊 */
                  h('rect', {
                    x: '0', y: '0', width: '260', height: '18',
                    rx: '9', ry: '9', fill: '#e3e5ea',
                  }),
                  /* 蓝色填充：矩形被 clipPath 裁成胶囊，端点自动贴合轨道 */
                  h('rect', {
                    /* x=1：左端内缩 1px，避免填充的蓝色露在白圆外缘之外
                       （白圆半径 13.5、中心 14，覆盖 0.5..27.5）。
                       width 写成 CSS 属性而非 SVG 属性：
                       CSS transition 只对 CSS 属性生效，
                       SVG 的 width 属性不参与过渡 → 会丢动画。 */
                    x: '1', y: '0', height: '18',
                    fill: '#3b82f6',
                    clipPath: 'url(#pum-track-clip)',
                    style: {
                      width: Math.max(0, fillPct / 100 * 260 - 1) + 'px',
                      transition: 'width .16s cubic-bezier(.4,0,.2,1)',
                    },
                  }),
                ),
                /* 滑块圆片：SVG <circle> 提供形状（不依赖 border-radius）。
                   · 像素尺寸 28×28（不是 100% —— 跟随父盒会被拉伸）
                   · preserveAspectRatio='xMidYMid meet' 保证等比缩放、绝不拉伸
                     即使外层盒被宿主样式拉宽/压扁，圆仍是圆（SVG 规范保证）
                   · 描边用 <circle stroke>，不用 box-shadow（后者跟随 border-radius，
                     而那个 radius 在宿主环境里已失效，会画出方块环） */
                h('div', {
                  className: 'pum-thumb',
                  style: {
                    left: Math.round(fillPct / 100 * TRACK_W) + 'px',
                    width: '28px',
                    height: '28px',
                    position: 'absolute',
                    top: '1px',
                    lineHeight: '0',
                    fontSize: '0',
                  },
                },
                  h('svg', {
                    width: '28',
                    height: '28',
                    viewBox: '0 0 28 28',
                    preserveAspectRatio: 'xMidYMid meet',
                    style: { display: 'block', width: '28px', height: '28px' },
                    'aria-hidden': 'true',
                  },
                    h('circle', {
                      cx: '14', cy: '14', r: '13',
                      fill: '#fff',
                      stroke: 'rgba(0,0,0,.06)',
                      'stroke-width': '1',
                    }),
                  ),
                ),
                h('div', { className: 'pum-dots' }, efforts.map(function (e, k) {
                  var r = efforts.length > 1 ? k / (efforts.length - 1) : 0;
                  var x = THUMB_R + (TRACK_W - 2 * THUMB_R) * r;
                  return h('span', { key: e.id,
                    className: 'pum-dot' + (k <= idx ? '' : ' off'),
                    style: { left: Math.round(x) + 'px' } });
                })),
                /* 交互层：原生 range 铺满且透明，保留键盘/拖拽行为 */
                h('input', {
                  className: 'pum-range', type: 'range', min: 0,
                  max: Math.max(0, efforts.length - 1), step: 1, value: idx,
                  'aria-label': '推理强度',
                  onChange: onSlider,
                }))
            : h('div', { className: 'pum-note2' },
                /* 取证：说清是哪一环没拿到，便于一次定位 */
                '无强度档：' + (mm ? ('目录里 ' + ((mm.model.reasoning && mm.model.reasoning.efforts) || []).length +
                  ' 档，过滤后 0；模型=' + mm.model.name) : ('未在目录匹配到「' + mstate.modelName + '」'))));
    
        return h('div', { className: 'pum-panel', ref: ref, style: style,
          role: 'dialog', 'aria-label': '推理强度' },
          body,
          mstate.error ? h('div', { className: 'pum-err' }, mstate.error) : null);
      }
    
      /* ---------------- 样式 ---------------- */
      var MODEL_CSS = [
        /* ---- 触发块：**保持宿主原生单行布局**（用户按图要求）----
           宿主 ui-model-selection 的按钮 JSX（app.asar 确证）本来就是一行：
             [图标 IconDataOutlineRegular] [span.triggerLabel 模型名]
             [span.triggerEffort 强度] [chevron]
           我前几版把它强改成 flex-direction:column 竖排，与图不符 —— 那是错的。
           现在只做**背景与圆角**这类纯装饰，不再动 display/flex 方向，
           让宿主的图标 + 名称 + 强度 + 箭头自然排成一行。
           因为不改布局，按钮重建时也不会出现"竖排↔单行"的跳变。 */
        /* 胶囊形：999px 会被浏览器钳制到「高度/2」，得到左右完美半圆（与图一致） */
        /* 复刻 Codex 胶囊（截图参照）：
           高度 40px → 999px 钳制为 20px 半径，视觉饱满；
           左右内边距 14px，文字离边不贴；
           box-sizing 保证高度不被 padding 撑破。 */
        'button:has(> span[data-model-id]){border-radius:999px !important;',
        'height:40px !important;min-height:40px !important;',
        'box-sizing:border-box !important;',
        'padding:0 14px 0 12px !important;',
        'background-color:transparent !important;transition:background-color .14s ease !important}',
        'button:has(> span[data-model-id]):hover{',
        'background-color:rgba(32,154,114,.10) !important}',
        'body[data-ds-dark-theme] button:has(> span[data-model-id]):hover{',
        'background-color:rgba(255,255,255,.10) !important}',
        'button:has(> span[data-model-id])[aria-expanded="true"]{',
        'background-color:rgba(32,154,114,.16) !important}',
        'body[data-ds-dark-theme] button:has(> span[data-model-id])[aria-expanded="true"]{',
        'background-color:rgba(255,255,255,.16) !important}',
        /* 与上面同一套规则，作用于探针标记的类（宿主结构微调时仍能命中） */
        /* 同上：与宿主按钮同一套视觉（高度 40px + 胶囊 + 内边距） */
        '.pum-two-line{border-radius:999px !important;',
        'height:40px !important;min-height:40px !important;',
        'box-sizing:border-box !important;',
        'padding:0 14px 0 12px !important;',
        'background-color:transparent !important;',
        'transition:background-color .14s ease !important}',
        '.pum-two-line:hover{background-color:rgba(32,154,114,.10) !important}',
        '.pum-two-line[aria-expanded="true"]{background-color:rgba(32,154,114,.16) !important}',
        'body[data-ds-dark-theme] .pum-two-line:hover{',
        'background-color:rgba(255,255,255,.10) !important}',
        /* 复刻 Codex 深色背景：展开态用更明显的一档半透明灰 */
        'body[data-ds-dark-theme] .pum-two-line[aria-expanded="true"]{',
        'background-color:rgba(255,255,255,.10) !important}',
        /* 强度字：与图中一致 —— 延续宿主自身的次级文字色与常规字重，
           不再放大、不再染绿加粗（图里它和模型名同色同重）。 */
        /* ---- 「选择推理强度」提示：面板展开时替换原文字 ---- */
        /* 默认隐藏（面板未展开时不该出现） */
        /* ⚠ 基础规则里**只能有 display:none**。
           之前在同一声明块里又写了 display:inline-flex，同一块内后者覆盖前者
           → .pum-hint 永远显示 → 与模型名文字重叠（用户已实测到）。
           显示态交给展开态规则（下面的 inline-flex）。 */
        '.pum-hint{display:none !important;font-size:inherit !important;',
        'line-height:inherit !important;font-weight:inherit !important;',
        'color:inherit !important;',
        /* 居中：绝对定位铺满按钮再 flex 居中 ——
           同排还有宿主的图标和箭头，靠 flex/margin 居中会被它们挤偏。
           ⚠ 绝对定位已脱离文档流，所以**不需要 order**（order 在此无效）。 */
        'position:absolute !important;inset:0 !important;',
        'align-items:center !important;',
        'justify-content:center !important;',
        'pointer-events:none !important}',
        /* 展开态：隐藏 模型名 + 强度，显示提示 */
        '.pum-two-line[aria-expanded="true"] .pum-label,',
        '.pum-two-line[aria-expanded="true"] .pum-cap{display:none !important}',
        /* 展开态才显示，并在此处补齐 flex 布局
           （基础规则不再提供 display，避免覆盖隐藏规则） */
        /* 兜底：若仍残留多个兄弟 hint，只渲染第一个 ——
           即便 JS 的先清空因竞态失效，视觉上也不会两份文字叠在一起。 */
        '.pum-hint ~ .pum-hint{display:none !important}',
        /* drill 期间把宿主浮层「瞬时隐藏」——
           从点开按钮到 drill 点进「模型」之间会显示根菜单（模型 / 推理等级），
           那一帧不该让用户看到。用 body 类开关，避免逐个改节点。 */
        'body.pum-drilling [role="menu"], body.pum-drilling [role="dialog"],',
        'body.pum-drilling [role="listbox"]{opacity:0 !important;pointer-events:none !important}',
        '.pum-two-line[aria-expanded="true"] .pum-hint{',
        'display:inline-flex !important;align-items:center !important;',
        'justify-content:center !important}',
        /* 展开态：按钮保持 flex 行布局。hint 是绝对定位的覆盖层，
           不占位、不影响箭头位置 —— 箭头仍在宿主原生的最右侧。 */
        '.pum-two-line[aria-expanded="true"]{',
        'display:flex !important;align-items:center !important;',
        /* space-between：图标贴左、箭头贴右。
           展开后 label/cap 已隐藏，按钮里只剩 [图标][箭头]，
           用 flex-start 会让两者都靠左（箭头跑到左边的直接原因）。
           .pum-hint 是绝对定位覆盖层，不参与这个排布，所以不影响它居中。 */
        'justify-content:space-between !important;gap:0 !important;',
        /* 绝对定位的 .pum-hint 需要按钮本身是定位上下文。
           relative 不改布局，只给绝对子元素提供基准框。 */
        'position:relative !important}',
        '.pum-cap{font-size:inherit !important;font-weight:inherit !important;',
        'color:inherit !important;line-height:inherit !important;order:0 !important}',
        /* 模型名：单行省略号，不换行不裁箭头 */
        '.pum-label{font-size:inherit !important;line-height:inherit !important;',
        'color:inherit !important;white-space:nowrap;overflow:hidden;',
        'text-overflow:ellipsis;max-width:100%;order:0 !important}',
        /* ---- 面板：宽 280，左右内边距 10 → 内容正好 260 = 滑块长度 ---- */
        '.pum-panel{box-sizing:border-box;width:280px;min-height:100px;padding:10px;position:fixed;',
        /* 面板容器：16px → 20px（用户反馈弧度不够） */
        'border-radius:20px;background:var(--dsw-alias-bg-layer-1,#fff);',
        'border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));',
        'box-shadow:0 16px 40px rgba(0,0,0,.14),0 3px 10px rgba(0,0,0,.05);',
        'font-size:13px;color:var(--dsw-alias-label-primary,#1f2329);z-index:2147483002}',
        /* 顶部信息块 = 模型切换命中范围（参考图比例）：
           块宽约面板 3/4（280 → 210），块高约 54px，圆角 12px。
           块比滑块窄：滑块几乎贴边（260），块内缩（210）。
    
           ⚠ 底色只做**悬停反馈**，默认完全透明（用户两次明确指出）：
             块本身不需要底色也能看出是两行信息；常驻底色在深色模式下
             无论用黑叠黑还是白叠白都显得脏。hover 才浮现，既有可达提示
             又不干扰静态画面。深色判据用宿主真实标记 body[data-ds-dark-theme]
             （ui-layout ThemePresenter 文档原文确证），不是 html[data-theme]。 */
        '.pum-effort-model-row{display:flex !important;flex-direction:column !important;',
        'align-items:center !important;justify-content:center !important;gap:2px !important;',
        'box-sizing:border-box;width:210px;max-width:210px;margin:0 auto;padding:6px 10px;',
        /* 内层模型行：12px → 14px，与面板/滑块弧度协调 */
        'border-radius:14px;cursor:pointer;background-color:transparent !important;',
        'transition:background-color .14s ease}',
        '.pum-effort-model-row:hover{background-color:rgba(32,154,114,.14) !important}',
        'body[data-ds-dark-theme] .pum-effort-model-row:hover{',
        'background-color:rgba(255,255,255,.14) !important}',
        /* 强度：居中、蓝色、单行 */
        '.pum-effort-name{font-size:15px;font-weight:600;line-height:1.3;text-align:center;',
        'color:#4d6bfe}',
        /* 模型名：与信息块同宽（由 padding 决定内部可用宽），居中、超长省略号 */
        '.pum-model-name-cell{display:flex;align-items:center;justify-content:center;',
        'width:100%;max-width:100%;margin:0 auto;font-size:12.5px;line-height:1.3;',
        'color:var(--dsw-alias-label-secondary,#8f959e)}',
        '.pum-model-name-text{min-width:0;overflow:hidden;text-overflow:ellipsis;',
        'white-space:nowrap}',
        '.pum-chev{flex:none;margin-left:4px;color:var(--dsw-alias-label-secondary,#8f959e)}',
        /* ---- 滑块：260 × 25 两段式胶囊 + 过渡动画 ----
           原生 range 的渐变轨道无法做过渡，因此拆成图层：
             .pum-track 灰底  /  .pum-fill 蓝色已选（宽过渡）
             .pum-thumb 白色圆片（left 过渡，比轨道大并溢出）
             .pum-range 透明原生 input，只负责交互（拖拽/键盘/无障碍）
           填充与滑块都停在同一个 x（滑块中心），所以分界永远对齐滑块。 */
        /* 滑块容器：高 28，轨道瘦到 16（参考图是瘦长胶囊） */
        /* 容器 34：轨道 28（与圆片直径相同）+ 上下留 6px 呼吸。
           轨道取 28 高是**几何必需**：圆角会被钳制到 高度/2，
           只有高度 = 圆片直径时，轨道端点半径(14) 才等于圆片半径(14)，
           圆片滑到两端时才能与轨道内壁严丝合缝。 */
        /* ---- 滑块几何：**唯一来源** ----
           --pus-track-h  轨道高（= 圆片直径 → 端点圆角与圆片半径一致）
           --pus-slider-h 容器高 = 轨道高 + 6（上下各 3px 呼吸） */
        '.pum-slider{--pus-track-h:18px;--pus-slider-h:calc(var(--pus-track-h) + 6px);',
        'position:relative;width:260px;height:var(--pus-slider-h);margin:6px auto 0}',
        /* 填充：与轨道同高同圆角；左端 14px 圆（贴合轨道端部），右端方角 */
        /* 填充：四角全圆（原来是 R 0 0 R，右端直角 ——
           滑块到最右端时方角顶出轨道半圆，露出蓝色尖角）。
           再加 overflow:hidden 兜住亚像素溢出。 */
        /* 滑块：尺寸已写进内联 style（见渲染处），这里只负责阴影/位移/过渡。
           不再用 CSS 定宽高 —— 与内联重复会掩盖真正生效的那条，
           排查时容易误判（上一版就是这么被绕过的）。 */
        /* 圆片容器：只负责定位与位移/过渡。
           ⚠ 刻意**不再写** border-radius / background / box-shadow ——
             上一版就是这几项被宿主压制，导致外环变成方块；
             圆的视觉完全由内部 SVG 的 <circle> 提供，不依赖这几项。 */
        /* 加 background:#fff 兜底：即使 SVG 未渲染，也不会透出下层蓝色。
           圆角也补上（虽然圆的视觉由 SVG 提供，但白底需要圆角避免露方角）。 */
        /* ⚠ 圆片的形状/尺寸/描边**保持不变**（用户要求不动圆）。
           这里只补 z-index:2 把它抬到最上层 ——
           原来它被蓝色 .pum-fill 压住，左侧被盖掉。 */
        /* 圆片容器：**只做定位/位移/过渡**。
           ⚠ 刻意不写 border-radius / background / box-shadow ——
             这三项在宿主环境里已被压制，留着只会画出方块环（用户实测）。
             形状完全由内部 SVG 的 <circle> 提供。 */
        '.pum-thumb{position:absolute !important;',
        'width:28px !important;height:28px !important;',
        'z-index:2 !important;',
        'transform:translateX(-50%) !important;pointer-events:none;',
        'line-height:0 !important;font-size:0 !important;',
        'transition:left .16s cubic-bezier(.4,0,.2,1)}',
        '.pum-thumb svg{display:block !important;width:28px !important;height:28px !important}',
        /* 圆片垂直居中：由 pum-slider 的高度变量推导，不在两处各写一个 top */
        '.pum-thumb{top:calc((var(--pus-slider-h) - 28px) / 2) !important}',
        /* SVG 自身也锁尺寸，防父盒拉伸影响（meet 已保证圆，这里是双保险） */
        '.pum-thumb svg{display:block !important;width:28px !important;height:28px !important;',
        'overflow:visible !important}',
        '.pum-range{position:absolute;left:0;top:0;width:100%;height:100%;margin:0;opacity:0;',
        'cursor:grab;appearance:none;-webkit-appearance:none;background:transparent}',
        /* 原生 thumb 必须显式定成和视觉层一样的 31px：它虽然不可见，
           但**命中测试与行程端点由它决定**。用浏览器默认尺寸的话，
           自绘滑块行程 [15.5, 244.5] 与原生行程不一致，
           拖到端点时视觉位置和实际抓取点会错开十几像素。 */
        '.pum-range::-webkit-slider-runnable-track{height:31px;border-radius:999px;background:transparent}',
        '.pum-range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;',
        'width:24px;height:24px;margin-top:0;border-radius:50%;background:#fff}',
        '.pum-range:active{cursor:grabbing}',
        '.pum-range:focus-visible{outline:2px solid #3b82f6;outline-offset:2px;border-radius:999px}',
        /* 小圆点容器：定位到**轨道中线**（与轨道同 top + 半高），
           不再用 50% —— 那是容器中线，与轨道中线不重合（用户实测点跑偏）。 */
        '.pum-dots{position:absolute;left:0;width:260px;height:0;pointer-events:none;',
        'top:calc((var(--pus-slider-h) - var(--pus-track-h)) / 2 + var(--pus-track-h) / 2);}',
        /* 圆点自身用 translateY(-50%) 垂直居中，不依赖硬编码 top */
        '.pum-dot{position:absolute;top:0;transform:translate(-50%,-50%);width:3px;height:3px;',
        'border-radius:50%;background:rgba(255,255,255,.6);transition:background .16s ease}',
    
        '.pum-dot.off{background:rgba(0,0,0,.15)}',
        '.pum-err{margin-top:8px;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#c62828)}',
        '.pum-note2{font-size:11.5px;text-align:center;color:var(--dsw-alias-label-secondary,#8f959e);padding:6px 0 0}',
      ].join('\n');
    
      return function installModel(c) {
        if (typeof document !== 'undefined') {
          /* 样式由装配层统一拥有，这里只幂等追加。 */
          PU_ensureCss('model', MODEL_CSS);
        }
        var offs = [];
        offs.push(c.slots.inject('conversation.input.right', function () {
          return c.slots.register(
            { name: 'conversation.input.right', id: 'dsh-perfect-ui.model-probe',
              order: 999, label: function () { return '模型块与强度面板'; } },
            function ProbeSlot() {
              ctxRef = c;
              var ref = React.useRef(null);
              React.useEffect(function () {
                startCaptionLocalizer(ref.current);
                /* 闪烁根因：宿主重渲染会重建触发按钮节点，我的类名随之丢失，
                   而 1.5s 定时器补不上这段空窗 —— 期间就是宿主原样（单行、
                   英文、无底色），用户看到的就是"闪一下旧样式"。
                   所以用 MutationObserver 在 DOM 变化的**同一轮微任务**里
                   立即重打标记（applyOnce 内部有去重，重复调用无副作用），
                   定时器降为兜底。 */
                /* ---- observer scope (perf) ----
                   host re-render rebuilds the trigger button and drops our classes,
                   so we must re-mark within the same microtask or the user sees a
                   brief flash of the old style.
                   But we must NOT observe document.body subtree: streaming tokens,
                   tool cards and sidebar updates all fire there.
                   Instead observe only the row that holds the model buttons,
                   and re-attach via a low-frequency fallback when the row is replaced. */
                var again = null;
                var mo = null;
                var observedRow = null;
                var seenTries = 0;
    
                function debouncedApply() {
                  /* ⚠ 同步校正宿主列表位置，**必须在浏览器绘制前**。
                     原来走 setTimeout(0)（宏任务）→ 宿主那一帧已经画在右边，
                     下一轮才挪到居中，用户看到 1 帧跳动。
                     MutationObserver 回调本身在微任务里，此处同步写入
                     left 后浏览器才绘制，跳帧消失。 */
                  try { alignHostModelList(); } catch (e) { /* 忽略 */ }
                  if (again) return;
                  again = setTimeout(function () {
                    again = null;
                    applyOnce(ref.current);
                  }, 0);
                }
    
                function attachObserver() {
                  var row = findRow(ref.current);
                  if (row === observedRow) return;
                  if (mo) { try { mo.disconnect(); } catch (e) { } mo = null; }
                  observedRow = row;
                  if (!row || typeof MutationObserver !== 'function') return;
                  mo = new MutationObserver(debouncedApply);
                  mo.observe(row, { childList: true, subtree: true });
                }
    
                applyOnce(ref.current);
                attachObserver();
    
                /* fallback: the row may be replaced wholesale, so the observer target
                   disappears and no callback ever fires again. 4s is enough.
                   After 4 misses we stop polling: the control is absent on this page
                   (e.g. a non-session view), so there is nothing to do. */
                var iv = setInterval(function () {
                  var row = findRow(ref.current);
                  if (!row) {
                    seenTries += 1;
                    if (seenTries >= 4) { clearInterval(iv); iv = null; }
                    return;
                  }
                  seenTries = 0;
                  applyOnce(ref.current);
                  attachObserver();
                }, 4000);
                return function () {
        /* 清理居中校正的定时器：插件停用后不该再有 setTimeout 在跑，
           否则它会拿着已失效的 mstate.btn 反复调用（虽有 try/catch 兜底，
           但留下悬挂定时器仍是资源泄漏）。 */
        for (var t = 0; t < alignTimers.length; t++) {
          try { clearTimeout(alignTimers[t]); } catch (e) { /* 已执行 */ }
        }
        alignTimers = [];
                  if (iv) { clearInterval(iv); iv = null; }
                  if (again) { clearTimeout(again); again = null; }
                  if (mo) { try { mo.disconnect(); } catch (e) { } mo = null; }
                  observedRow = null;
                  stopCaptionLocalizer();
                  unhookAll();
                  cleanupClasses();
                };
              }, []);
              return h('span', { ref: ref, style: { display: 'contents' } });
            });
        }));
        offs.push(c.slots.inject('shell.overlay', function () {
          return c.slots.register(
            { name: 'shell.overlay', id: 'dsh-perfect-ui.model-panel', order: 920,
              label: function () { return '模型与推理强度面板'; } },
            function PanelSlot() { return Panel(c); });
        }));
        return function () {
          unhookAll(); cleanupClasses();
          for (var i = 0; i < offs.length; i++) { try { offs[i](); } catch (e) { /* 已撤销 */ } }
        };
      };
    }
    

    /* ============ B4. 工作区一键运行命令（内联 actions.js） ============ */
    /* dsh-perfect-ui — 工作区 Action（Client 半边）
       ==========================================================================
       用户截图需求：
         点【运行】→ 弹出「添加 Action」对话框
           名称  [输入框]
           图标  [一排可选图标]
           命令  [多行输入]
                           [取消] [保存 Action]
         保存后在当前工作区执行。
    
       ---- 端点（host-actions.js 注册）----
         GET  /api/dsh-perfect-ui-actions/list
         POST /save   { action: { id?, label, icon, command } }
         POST /remove { id }
         POST /run    { id }
    
       ---- 重要告知 ----
       命令整条交给 Host，由系统 shell（Windows cmd.exe）执行，
       因此 `npm test`、管道、重定向与 && 都可用。这一点写在对话框底部。
       ========================================================================== */
    
    function PU_actions(React, h) {
      'use strict';
    
      var BASE = '/api/dsh-perfect-ui-actions';
    
      /* 图标候选（用户截图里的那一排，用 Unicode 近似宿主图标语义）。
         每一项都直接当 React key 用（见下面 ICONS.map 的 key: ic），**必须互不重复**：
         曾出现两个 📦，触发 duplicate-key 警告并在同一排渲染出两个一样的按钮。 */
      var ICONS = ['▶', '🔧', '⚙', '</>', '📦', '🏗', '⎇', '⇅', '🚀', '🔔', '🛡', '💾'];
    
      var S_INIT = {
        open: false,          // 面板是否打开
        view: 'list',         // list | form
        loading: false,
        saving: false,
        runningId: '',
        list: [],
        workspace: '',
        error: '',
        out: null,
        // 表单字段
        fLabel: '', fIcon: '▶', fCommand: '', fId: '',
      };
      /* 共享 store（store.js）：与 features/model 同一套订阅与批通知。 */
      /* actions 的初值是本地 S_INIT，所以在模块内创建 store（其余两个由装配层注入）。 */
      var sstore = PU_makeStore(React, S_INIT);
      var S = sstore.get();
      function sset(patch) { sstore.set(patch); }
      function ssub(fn) { return sstore.subscribe(fn); }
      function suse() { return sstore.useStore(); }
      /* 并发/卸载守卫：runSeq 递增序号只让最新一次请求写回 UI；
         disposed 标记模块已卸载，禁止任何在途响应再 sset（P2 修复）。 */
      var runSeq = 0;
      var disposed = false;
    
      /* 请求 + 解析。用户实测报过 "Failed to execute 'json' on 'Response':
         Unexpected end of JSON input" —— 根因是 Host 侧用了 Fetch 的 Response
         语义（已修）。这里再加一层客户端保险：先看文本再解析，
         空响应体给出可读错误而不是抛出原生 JSON 异常。
    
         ⚠ 必须用 Promise.resolve().then(fetch) 延迟求值。
         写成 Promise.resolve(fetch(url, opts)) 时，fetch 在 Promise 构造之前
         就已同步执行；一旦它同步抛出（非法 URL 等），异常逃出整个 .catch 链，
         调用方（saveAction/removeAction/runAction）虽然包了 try，但拿到的是
         未捕获异常而不是被拒绝的 Promise。 */
      /* 输出显示层（P1 性能修复）。
         Host 侧 MAX_OUTPUT_BYTES=256KB，stdout+stderr 合计可达 512KB，
         整块拼进单个文本节点 + pre-wrap 排版可卡几十~上百 ms，且每次列表
         视图重渲染都重做一次 O(n) 拼接。
         处理：显示层截断到 MAX_SHOWN 字符，并把结果缓存在 S.out 上（按对象身份
         比对），同一个 out 对象只拼一次。 */
      var MAX_SHOWN = 20000;
      var outTextCache = { src: null, text: '' };
      function outText(out) {
        if (!out) return '（无输出）';
        if (outTextCache.src === out) return outTextCache.text;
        var full = (out.stdout || '') +
          (out.stderr ? (out.stdout ? '\n' : '') + '[stderr]\n' + out.stderr : '');
        var text;
        if (!full) {
          text = '（无输出）';
        } else if (full.length > MAX_SHOWN) {
          text = full.slice(0, MAX_SHOWN) + '\n…（已截断，共 ' + full.length + ' 字符）';
        } else {
          text = full;
        }
        outTextCache.src = out;
        outTextCache.text = text;
        return text;
      }
    
      /* 请求 + 解析。用户实测报过 "Failed to execute 'json' on 'Response':
         Unexpected end of JSON input" —— 根因是 Host 侧用了 Fetch 的 Response
         语义（已修）。这里再加一层客户端保险：先看文本再解析，
         空响应体给出可读错误而不是抛出原生 JSON 异常。
    
         ⚠ 必须用 Promise.resolve().then(fetch) 延迟求值。
         写成 Promise.resolve(fetch(url, opts)) 时，fetch 在 Promise 构造之前
         就已同步执行；一旦它同步抛出（非法 URL 等），异常逃出整个 .catch 链。
         另带 30 秒超时（P2 修复）：carrier 异常时请求可能长时间挂起，期间
         runningId 保持 → 该行 disabled、永久转圈，只能关面板重开。 */
      var REQ_TIMEOUT_MS = 30000;
      function req(url, opts) {
        return Promise.resolve().then(function () {
          var timer = 0;
          var timeout = new Promise(function (_, rej) {
            timer = setTimeout(function () {
              rej(new Error('请求超时（' + (REQ_TIMEOUT_MS / 1000) + ' 秒）'));
            }, REQ_TIMEOUT_MS);
          });
          return Promise.race([
            fetch(url, opts),
            timeout,
          ]).then(
            function (r) { if (timer) { clearTimeout(timer); timer = 0; } return r; },
            function (e) { if (timer) { clearTimeout(timer); timer = 0; } throw e; });
        }).then(function (r) {
          return r.text().then(function (txt) {
            if (!txt || !txt.trim()) {
              throw new Error('服务端返回空响应（HTTP ' + r.status + '）');
            }
            try {
              return JSON.parse(txt);
            } catch (e) {
              throw new Error('响应不是 JSON（HTTP ' + r.status + '）：' + txt.slice(0, 120));
            }
          });
        });
      }
    
      function loadList() {
        sset({ loading: true, error: '', out: null });
        req(BASE + '/list', { method: 'GET', headers: { accept: 'application/json' } })
          .then(function (d) {
            if (!d || d.ok !== true) {
              sset({ loading: false, error: (d && d.error) || '读取失败' });
              return;
            }
            sset({ loading: false, list: d.actions || [], workspace: d.workspace || '' });
          })
          .catch(function (e) {
            sset({ loading: false, error: '请求异常：' + (e && e.message ? e.message : String(e)) });
          });
      }
    
      function saveAction() {
        var cmd = (S.fCommand || '').trim();
        if (!cmd) { sset({ error: '命令不能为空' }); return; }
        if (/[\r\n]/.test(S.fCommand)) { sset({ error: '命令不能包含换行' }); return; }
        sset({ saving: true, error: '' });
        req(BASE + '/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: {
              id: S.fId || undefined,
              label: (S.fLabel || '').trim() || cmd.split(/\s+/)[0],
              icon: S.fIcon || '▶',
              command: cmd,
            },
          }),
        }).then(function (d) {
          if (!d || d.ok !== true) {
            sset({ saving: false, error: (d && d.error) || '保存失败' });
            return;
          }
          sset({ saving: false, view: 'list', list: d.actions || [],
            fLabel: '', fIcon: '▶', fCommand: '', fId: '', error: '' });
        }).catch(function (e) {
          sset({ saving: false, error: '保存异常：' + (e && e.message ? e.message : String(e)) });
        });
      }
    
      function removeAction(id) {
        req(BASE + '/remove', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: id }),
        }).then(function (d) {
          if (d && d.ok === true) sset({ list: d.actions || [] });
          else sset({ error: (d && d.error) || '删除失败' });
        }).catch(function (e) {
          sset({ error: '删除异常：' + (e && e.message ? e.message : String(e)) });
        });
      }
    
      function runAction(id) {
        /* 并发守卫（P2 修复）：原先只有一个 runningId，点 A 再点 B 时
           A 返回会把 runningId 清空 → B 的转圈消失，且 B 的结果随后覆盖 A。
           用 runSeq 递增序号，只有「最新一次」的响应允许写回 UI。 */
        var seq = ++runSeq;
        sset({ runningId: id, out: null, error: '' });
        req(BASE + '/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: id }),
        }).then(function (d) {
          if (seq !== runSeq || disposed) return;
          if (!d) { sset({ runningId: '', error: '空响应' }); return; }
          sset({ runningId: '', out: d, error: d.ok === true ? '' : (d.error || '') });
        }).catch(function (e) {
          if (seq !== runSeq || disposed) return;
          sset({ runningId: '', error: '执行异常：' + (e && e.message ? e.message : String(e)) });
        });
      }
    
      /* ---------------- 右上角按钮 ---------------- */
      function HeaderButton(c) {
        suse();
        return h('button', {
          type: 'button', className: 'pxa-tgl',
          title: S.open ? '收起 Action' : '运行 Action / 添加命令',
          'aria-expanded': S.open ? 'true' : 'false',
          onClick: function (e) {
            e.preventDefault(); e.stopPropagation();
            if (S.open) { sset({ open: false }); return; }
            sset({ open: true, view: 'list', error: '', out: null });
            loadList();
          },
        }, h('span', { className: 'pxa-ico' }, '▶'), '运行');
      }
    
      /* ---------------- 对话框 ---------------- */
      function Dialog(c) {
        suse();
        var ref = React.useRef(null);
    
        /* 关闭方式（用户要求全部可用）：
             · 点对话框外空白 → 关闭
             · Esc → 关闭
             · 右上角 ✕ → 关闭
           Esc 用**捕获阶段**监听：面板位于 shell.overlay，若焦点在别处
           或宿主自己有 keydown 拦截，冒泡阶段会收不到；捕获阶段先拿到。 */
        React.useEffect(function () {
          if (!S.open) return undefined;
          function close() { sset({ open: false, view: 'list' }); }
          function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
              e.stopPropagation();
              close();
            }
          }
          function onDown(e) {
            /* 点在遮罩上（不是对话框内部）→ 关闭。
               排除头部触发器自身：pointerdown 在 document 捕获阶段先于 React
               的 onClick 触发，若不过滤，点触发器会先被判为「点在外面」关闭，
               随后 onClick 又读到已关闭的状态而重新打开（与 features.js 同一问题）。
               当前有 inset:0 全屏遮罩，触发器被遮挡故实际不可达，但属于防御性修正。 */
            var t = e.target;
            if (t && t.closest && t.closest('.pxa-tgl')) return;
            if (ref.current && ref.current.contains(t)) return;
            close();
          }
          document.addEventListener('keydown', onKey, true);
          document.addEventListener('pointerdown', onDown, true);
          return function () {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('pointerdown', onDown, true);
          };
        }, [S.open]);
    
        if (!S.open) return null;
    
        var head = h('div', { className: 'pxa-dlg-head' },
          h('div', null,
            h('div', { className: 'pxa-dlg-title' }, S.view === 'form' ? '添加 Action' : '工作区 Action'),
            h('div', { className: 'pxa-dlg-sub' },
              S.view === 'form'
                ? '把常用命令保存为快捷 Action，点击后在当前工作区执行。'
                : (S.workspace || '未选择工作区'))),
          h('button', { type: 'button', className: 'pxa-dlg-x', title: '关闭',
            onClick: function () { sset({ open: false, view: 'list' }); } }, '✕'));
    
        var body;
        if (S.view === 'form') {
          var iconRow = h('div', { className: 'pxa-icons' }, ICONS.map(function (ic) {
            return h('button', {
              key: ic, type: 'button',
              className: 'pxa-icon' + (S.fIcon === ic ? ' pxa-icon-on' : ''),
              title: ic,
              onClick: function () { sset({ fIcon: ic }); },
            }, ic);
          }));
          body = h('div', { className: 'pxa-dlg-body' },
            h('label', { className: 'pxa-field' },
              h('span', { className: 'pxa-label' }, '名称'),
              h('input', {
                className: 'pxa-input', type: 'text', value: S.fLabel,
                placeholder: '例如：测试', maxLength: 60,
                onChange: function (e) { sset({ fLabel: e.target.value }); },
              })),
            h('div', { className: 'pxa-field' },
              h('span', { className: 'pxa-label' }, '图标'),
              iconRow),
            h('label', { className: 'pxa-field' },
              h('span', { className: 'pxa-label' }, '命令'),
              h('textarea', {
                className: 'pxa-input pxa-textarea', value: S.fCommand,
                placeholder: '例如：npm test', rows: 4, maxLength: 2000,
                onChange: function (e) { sset({ fCommand: e.target.value }); },
              })),
            h('div', { className: 'pxa-note' },
              '命令由系统 shell 执行（Windows 为 cmd.exe），支持管道、重定向与 &&。'),
            S.error ? h('div', { className: 'pxa-err' }, S.error) : null,
            h('div', { className: 'pxa-dlg-foot' },
              h('button', { type: 'button', className: 'pxa-btn',
                onClick: function () { sset({ view: 'list', error: '', fId: '' }); } }, '取消'),
              h('button', {
                type: 'button', className: 'pxa-btn pxa-btn-primary',
                disabled: S.saving,
                onClick: saveAction,
              }, S.saving ? '保存中…' : '保存 Action')));
        } else {
          var rows = S.list.map(function (a) {
            var busy = S.runningId === a.id;
            return h('div', { key: a.id, className: 'pxa-row' + (busy ? ' pxa-busy' : '') },
              h('button', {
                type: 'button', className: 'pxa-run',
                title: '执行：' + a.command,
                disabled: busy,
                onClick: function () { if (!busy) runAction(a.id); },
              }, busy ? '…' : (a.icon || '▶')),
              h('div', { className: 'pxa-row-main' },
                h('div', { className: 'pxa-row-label' }, a.label),
                h('div', { className: 'pxa-row-cmd' }, a.command)),
              h('button', {
                type: 'button', className: 'pxa-row-x', title: '删除',
                onClick: function () { removeAction(a.id); },
              }, '✕'));
          });
          body = h('div', { className: 'pxa-dlg-body' },
            S.loading
              ? h('div', { className: 'pxa-msg' }, '读取中…')
              : (S.list.length
                ? h('div', { className: 'pxa-rows' }, rows)
                : h('div', { className: 'pxa-msg' },
                    '还没有 Action。点下方「添加 Action」创建第一条。')),
            S.error ? h('div', { className: 'pxa-err' }, S.error) : null,
            S.out ? h('div', { className: 'pxa-out' },
              h('div', { className: 'pxa-out-head' },
                h('span', { className: (S.out.exitCode === 0 ? 'pxa-ok' : 'pxa-err') },
                  S.out.exitCode === null || S.out.exitCode === undefined
                    ? '异常退出' : '退出码 ' + S.out.exitCode),
                h('span', { className: 'pxa-out-cmd' }, S.out.command || '')),
              h('div', { className: 'pxa-out-body' }, outText(S.out))) : null,
            h('div', { className: 'pxa-dlg-foot' },
              h('button', { type: 'button', className: 'pxa-btn',
                onClick: function () { sset({ open: false }); } }, '关闭'),
              h('button', {
                type: 'button', className: 'pxa-btn pxa-btn-primary',
                onClick: function () {
                  sset({ view: 'form', fLabel: '', fIcon: '▶', fCommand: '', fId: '', error: '' });
                },
              }, '添加 Action')));
        }
    
        return h('div', { className: 'pxa-dlg-wrap' },
          h('div', { className: 'pxa-dlg', ref: ref, role: 'dialog', 'aria-label': 'Action' }, head, body));
      }
    
      var CSS = [
        '.pxa-tgl{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;',
        'border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.10));border-radius:8px;',
        'background:transparent;color:var(--dsw-alias-label-primary,#1f2329);',
        'font-size:12px;line-height:1;cursor:pointer;white-space:nowrap;',
        'transition:background-color .14s ease,border-color .14s ease}',
        '.pxa-tgl:hover{background:rgba(32,154,114,.10);border-color:rgba(32,154,114,.35)}',
        '.pxa-tgl[aria-expanded="true"]{background:rgba(32,154,114,.16);border-color:rgba(32,154,114,.45)}',
        'body[data-ds-dark-theme] .pxa-tgl:hover{background:rgba(255,255,255,.10)}',
        'body[data-ds-dark-theme] .pxa-tgl[aria-expanded="true"]{background:rgba(255,255,255,.16)}',
        '.pxa-ico{font-size:10px;line-height:1}',
        '.pxa-dlg-wrap{position:fixed;inset:0;z-index:2147483000;display:flex;',
        'align-items:center;justify-content:center;background:rgba(0,0,0,.16);',
        'pointer-events:auto;backdrop-filter:blur(2px)}',
        'body[data-ds-dark-theme] .pxa-dlg-wrap{background:rgba(0,0,0,.42)}',
        '.pxa-dlg{box-sizing:border-box;width:560px;max-width:calc(100vw - 48px);',
        'max-height:calc(100vh - 96px);display:flex;flex-direction:column;border-radius:16px;',
        'background:var(--dsw-alias-bg-layer-1,#fff);',
        'border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));',
        'box-shadow:0 24px 64px rgba(0,0,0,.22),0 4px 14px rgba(0,0,0,.08);',
        'font-size:13px;color:var(--dsw-alias-label-primary,#1f2329);overflow:hidden}',
        'body[data-ds-dark-theme] .pxa-dlg{background:#161d24;border-color:rgba(255,255,255,.12)}',
        '.pxa-dlg-head{display:flex;align-items:flex-start;gap:10px;padding:14px 16px 10px;flex:none}',
        '.pxa-dlg-title{font-size:14px;font-weight:600;line-height:1.4}',
        '.pxa-dlg-sub{margin-top:3px;font-size:12px;line-height:1.5;',
        'color:var(--dsw-alias-label-secondary,#8f959e)}',
        '.pxa-dlg-x{margin-left:auto;width:24px;height:24px;border:none;border-radius:6px;',
        'background:transparent;color:var(--dsw-alias-label-secondary,#5c6b68);',
        'cursor:pointer;font-size:14px;line-height:1;flex:none}',
        '.pxa-dlg-x:hover{background:rgba(0,0,0,.06)}',
        'body[data-ds-dark-theme] .pxa-dlg-x:hover{background:rgba(255,255,255,.10)}',
        '.pxa-dlg-body{flex:1;min-height:0;overflow:auto;padding:4px 16px 14px}',
        '.pxa-field{display:block;margin-bottom:14px}',
        '.pxa-label{display:block;margin-bottom:6px;font-size:12px;font-weight:500;',
        'color:var(--dsw-alias-label-primary,#1f2329)}',
        '.pxa-input{box-sizing:border-box;width:100%;padding:7px 10px;border-radius:8px;',
        'border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));',
        'background:transparent;color:inherit;font:inherit;font-size:12.5px;outline:none}',
        '.pxa-input:focus{border-color:var(--dsw-alias-brand-primary,#209a72)}',
        'body[data-ds-dark-theme] .pxa-input{border-color:rgba(255,255,255,.16)}',
        '.pxa-textarea{resize:vertical;min-height:84px;line-height:1.6;',
        "font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace}",
        '.pxa-icons{display:flex;flex-wrap:wrap;gap:6px}',
        '.pxa-icon{width:30px;height:30px;display:inline-flex;align-items:center;',
        'justify-content:center;border-radius:8px;border:1px solid transparent;',
        'background:rgba(0,0,0,.04);color:inherit;font-size:14px;cursor:pointer;',
        'transition:background-color .12s ease,border-color .12s ease}',
        '.pxa-icon:hover{background:rgba(32,154,114,.14)}',
        'body[data-ds-dark-theme] .pxa-icon{background:rgba(255,255,255,.08)}',
        'body[data-ds-dark-theme] .pxa-icon:hover{background:rgba(255,255,255,.16)}',
        '.pxa-icon-on{background:rgba(32,154,114,.20) !important;',
        'border-color:var(--dsw-alias-brand-primary,#209a72) !important}',
        '.pxa-note{margin:2px 0 12px;font-size:11px;line-height:1.6;',
        'color:var(--dsw-alias-label-secondary,#8f959e)}',
        '.pxa-err{margin:0 0 10px;font-size:12px;line-height:1.5;color:#c62828}',
        '.pxa-ok{color:#1f7a53}',
        '.pxa-msg{padding:14px 2px;font-size:12px;line-height:1.6;',
        'color:var(--dsw-alias-label-secondary,#8f959e)}',
        '.pxa-rows{display:flex;flex-direction:column;gap:4px}',
        '.pxa-row{display:flex;align-items:center;gap:8px;padding:6px;border-radius:10px}',
        '.pxa-row:hover{background:rgba(32,154,114,.08)}',
        'body[data-ds-dark-theme] .pxa-row:hover{background:rgba(255,255,255,.08)}',
        '.pxa-busy{opacity:.65}',
        '.pxa-run{width:32px;height:32px;flex:none;display:inline-flex;align-items:center;',
        'justify-content:center;border-radius:8px;border:1px solid rgba(0,0,0,.10);',
        'background:rgba(32,154,114,.10);color:var(--dsw-alias-brand-primary,#209a72);',
        'font-size:14px;cursor:pointer}',
        '.pxa-run:hover{background:rgba(32,154,114,.20)}',
        '.pxa-run:disabled{cursor:default}',
        'body[data-ds-dark-theme] .pxa-run{background:rgba(255,255,255,.10);',
        'color:#7fe0b8;border-color:rgba(255,255,255,.14)}',
        '.pxa-row-main{flex:1;min-width:0}',
        '.pxa-row-label{font-size:12.5px;font-weight:500;line-height:1.4;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.pxa-row-cmd{font-size:11px;line-height:1.4;',
        'color:var(--dsw-alias-label-secondary,#8f959e);',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
        "font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace}",
        '.pxa-row-x{width:24px;height:24px;flex:none;border:none;border-radius:6px;',
        'background:transparent;color:var(--dsw-alias-label-secondary,#8f959e);',
        'cursor:pointer;font-size:13px;line-height:1}',
        '.pxa-row-x:hover{background:rgba(198,40,40,.12);color:#c62828}',
        '.pxa-out{margin-top:10px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));',
        'border-radius:10px;overflow:hidden}',
        'body[data-ds-dark-theme] .pxa-out{border-color:rgba(255,255,255,.12)}',
        '.pxa-out-head{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:11.5px;',
        'border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}',
        'body[data-ds-dark-theme] .pxa-out-head{border-bottom-color:rgba(255,255,255,.08)}',
        '.pxa-out-cmd{flex:1;min-width:0;text-align:right;',
        'color:var(--dsw-alias-label-secondary,#8f959e);',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.pxa-out-body{max-height:220px;overflow:auto;padding:8px 10px;white-space:pre-wrap;',
        'word-break:break-all;font-size:11.5px;line-height:1.55;',
        "font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace}",
        '.pxa-dlg-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:6px;flex:none}',
        '.pxa-btn{height:30px;padding:0 14px;border-radius:8px;border:1px solid transparent;',
        'background:rgba(0,0,0,.05);color:inherit;font-size:12.5px;cursor:pointer}',
        '.pxa-btn:hover{background:rgba(0,0,0,.09)}',
        'body[data-ds-dark-theme] .pxa-btn{background:rgba(255,255,255,.10)}',
        'body[data-ds-dark-theme] .pxa-btn:hover{background:rgba(255,255,255,.18)}',
        '.pxa-btn-primary{background:#209a72 !important;color:#fff !important;font-weight:500}',
        '.pxa-btn-primary:hover{background:#1b8462 !important}',
        '.pxa-btn:disabled{opacity:.6;cursor:default}',
      ].join('\n');
    
      return function installActions(c) {
        if (typeof document !== 'undefined') {
          /* 样式由装配层统一拥有，这里只幂等追加。 */
          PU_ensureCss('actions', CSS);
        }
        var offs = [];
        offs.push(c.slots.inject('conversation.session.header.utilities', function () {
          return c.slots.register(
            { name: 'conversation.session.header.utilities', id: 'dsh-perfect-ui.actions',
              order: 400, label: function () { return '运行 Action'; } },
            /* 同上：直接传组件，不要包 `function Slot(){ return HeaderButton(c); }`。 */
            HeaderButton);
        }));
        offs.push(c.slots.inject('shell.overlay', function () {
          return c.slots.register(
            { name: 'shell.overlay', id: 'dsh-perfect-ui.actions-panel', order: 940,
              label: function () { return 'Action 对话框'; } },
            /* 直接传 Dialog，不包一层 `function Slot(){ return Dialog(c); }` ——
               那种写法每次 inject 都新建组件类型，slot 重新 inject 时 React 会
               卸载重挂（Dialog 的 document 监听被拆除重建，开着的对话框会闪）。
               features.js 直接传组件是正确示范。 */
            Dialog);
        }));
        return function () {
          /* 标记已卸载：禁止在途请求的 then 再写 store（P2 修复）。
             同时递增 runSeq，让所有已发出的 run 响应判定为「过期」而被丢弃。 */
          disposed = true;
          runSeq += 1;
          sset({ open: false, view: 'list', runningId: '', out: null, error: '' });
          for (var i = 0; i < offs.length; i++) { try { offs[i](); } catch (e) { /* 已撤销 */ } }
        };
      };
    }
    

    /* ============ B5. 会话真正删除 + 右键菜单（内联 session.js） ============ */
    /* dsh-perfect-ui — 会话真正删除 + 右键打开会话菜单（Client 半边）
       ==========================================================================
       需求（用户截图）：
         1) 会话「...」菜单新增「删除会话」，实现**真正的删除**（不是归档）
         2) **右键会话行**能打开这个会话管理菜单
    
       ---- 座位与 props（cordis_inspect 实时查询原文确证）----
       座位 sidebar.workspaces.session.menu.item（list, replaceRisk=none）
         已有 occupant: pin(100) / rename(200) / fork(300) / archive(400) /
                       session-id(450)
         我的行用 order 500 排在其后，不遮蔽任何已发布行。
         ownerProps: { sessionId, displayTitle }
         slotInject: { hooks: { menuOpenState }, shortcuts }
           → 组件里能拿到 hooks.menuOpenState（用于操作后关闭菜单）
         每个 entry 渲染一个 role="menuitem" 的 button，列表的键盘行走读 DOM，
         所以我的原生 button 会自动加入键盘导航。
    
       ---- 右键实现方式 ----
       宿主没有给会话行提供右键菜单。做法是**拦截会话行的 contextmenu 事件，
         再合成一次「点击该行 ... 按钮」** —— 复用宿主菜单本体，
         而不是自己重画一个菜单（重画会丢失宿主的分组、快捷键、焦点归还）。
       行与「...」按钮的定位靠几何关系：右键点在某行内 → 在同一行的作用域内
       找 aria-haspopup="menu" 的触发按钮 → 合成 click。
    
       ---- 删除通道 ----
       Host 端点 /api/dsh-perfect-ui-session/probe 与 /delete（host-session.js）。
       宿主没有删除会话的 API，只能删磁盘目录；Host 侧已实现
       「先原子改名进回收站再可恢复」的安全策略。
       ========================================================================== */
    
    
    function PU_session(React, h) {
      'use strict';
    
      var BASE = '/api/dsh-perfect-ui-session';
    
      /* 请求头标记：Host 侧 requireOwnPage 用它拒收非本插件页面的请求
         （参考实现 dsh-session-purge 的同一做法）。 */
      function jsonHeaders() {
        return {
          'content-type': 'application/json',
          'x-dsh-perfect-ui-purge': '1',
        };
      }
    
      /* 请求 + 容错解析（沿用 actions.js 已验证的写法：先 text 再 parse）。
         ⚠ 必须是 Promise.resolve().then(...) 延迟调用 fetch，不能写成
         Promise.resolve(fetch(url, opts)) —— 后者的 fetch 在 Promise 构造
         之前就已同步求值，一旦它同步抛出（非法 URL 等），异常就逃出了
         后面的 .catch 链，成为未捕获异常。 */
      function req(url, opts) {
        return Promise.resolve().then(function () {
          return fetch(url, opts);
        }).then(function (r) {
          return r.text().then(function (txt) {
            if (!txt || !txt.trim()) throw new Error('服务端返回空响应（HTTP ' + r.status + '）');
            try { return JSON.parse(txt); }
            catch (e) { throw new Error('响应不是 JSON（HTTP ' + r.status + '）：' + txt.slice(0, 120)); }
          });
        });
      }
    
      function fmtBytes(n) {
        var v = Number(n) || 0;
        if (v < 1024) return v + ' B';
        if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
        if (v < 1024 * 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + ' MB';
        return (v / 1024 / 1024 / 1024).toFixed(2) + ' GB';
      }
    
      /* ---------------- 会话菜单项：删除会话 ----------------
         组件签名按宿主**实际源码**对齐（app.asar 里 SessionIdMenuItem 原文）：
             function SessionIdMenuItem({ sessionId, useMenuOpenState, copySessionId, t })
         即：sessionId 是顶层 prop；**useMenuOpenState 是一个 hook 函数本身**
         （不是 props.hooks.menuOpenState）；调用后得到 [read, write]。
         上一版把 hooks 嵌套写错 —— 关闭动作会静默失效。 */
      /* React 规则：hook 必须无条件调用，不能包在 if / try-catch 里。
         宿主每次都会传 useMenuOpenState（见上方源码），但仍给出稳定兜底 ——
         万一某次不传，就用这个常量 hook，保证 hook 调用序列不变。 */
      function noopMenuOpenState() { return [null, function () {}]; }
    
      function DeleteSessionMenuItem(props) {
        var sessionId = props.sessionId;
        var useMenuOpenState = props.useMenuOpenState;
    
        /* 无条件调用（顶层，不在任何分支/异常处理里）。 */
        var openState = (typeof useMenuOpenState === 'function' ? useMenuOpenState : noopMenuOpenState)();
    
        var st = React.useState(0);
        var setTick = st[1];
        var state = React.useRef({ phase: 'idle', probe: null, error: '', diag: '', });
    
        function patch(next) {
          Object.assign(state.current, next);
          setTick(function (v) { return v + 1; });
        }
    
        /* 探测：告知该会话在盘上占多大。
           同时把失败原因写进 diag —— 桌面版没有控制台，
           界面自报是唯一能定位"为什么灰掉"的通道。 */
        React.useEffect(function () {
          var alive = true;
          if (!sessionId) {
            patch({ diag: '菜单项没拿到 sessionId' });
            return undefined;
          }
          req(BASE + '/probe', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ sessionId: String(sessionId) }),
          }).then(function (d) {
            if (!alive) return;
            if (d && d.ok === true) {
              patch({ probe: {
                dirs: d.dirs || 0, bytes: d.bytes || 0,
                cwd: d.cwd || '', createdAt: d.createdAt || null, live: !!d.live,
                artifacts: d.artifacts || null, attachments: d.attachments || 0,
                removable: d.removable !== false,
                warnings: d.warnings || [],
              }, diag: '' });
            } else {
              patch({ diag: (d && d.error) || '探测返回异常' });
            }
          }).catch(function (e) {
            if (!alive) return;
            patch({ diag: 'probe 失败：' + (e && e.message ? e.message : String(e)) });
          });
          return function () { alive = false; };
        }, [sessionId]);
    
        /* 可删除的判据用 removable（日志目录 **或** 工作区记录任一还在），
           而不是只看日志目录 —— 否则日志已删、工作区还挂着时菜单会永久变灰。 */
        var pr = state.current.probe;
        var mc = !!(pr && pr.removable);
    
        function closeMenu() {
          try {
            if (openState && typeof openState[1] === 'function') openState[1](false);
          } catch (e) { /* 忽略 */ }
          try {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
          } catch (e) { /* 忽略 */ }
        }
    
        /* 用户要求：保留二次确认，但**不显示删除范围选择**、不提示运行态，
           点确认即彻底删除（everything：记录 + 本对话写过的文件 + 无引用附件）。
           运行中的会话由 Host 侧自动停止后再删。 */
        function reallyDelete() {
          if (state.current.phase === 'deleting') return;
          patch({ phase: 'confirm', error: '' });
        }
    
        function cancel() { patch({ phase: 'idle', error: '' }); }
        function doDelete() {
          if (state.current.phase === 'deleting') return;
          patch({ phase: 'deleting', error: '' });
          req(BASE + '/delete', {
            method: 'POST',
            headers: jsonHeaders(),
            /* 固定 everything（彻底删除，含无引用附件），不经用户选择 */
            body: JSON.stringify({ sessionId: String(sessionId), mode: 'everything', confirm: true }),
          }).then(function (d) {
            if (d && d.ok === true) {
              var rm = d.removed || {};
              patch({ phase: 'done', error: '' });
              closeMenu();
    
              /* 侧栏移除该行由 Host 侧的 ctx.emit('api-session/removed', id) 完成，
                 不需要浏览器这边再刷新 —— 这是参考实现的机制，也是此前
                 "refresh ok 但列表不变"的真正解法。这里只补一个本地事件，
                 供其它自绘列表消费。 */
              try {
                window.dispatchEvent(new CustomEvent('dsh-perfect-ui:session-deleted', {
                  detail: { sessionId: sessionId, removed: rm, errors: d.errors || [] },
                }));
              } catch (e) { /* 忽略 */ }
            } else {
              patch({ phase: 'idle', error: (d && d.error) || '删除失败' });
            }
          }).catch(function (e) {
            patch({ phase: 'idle', error: '删除异常：' + (e && e.message ? e.message : String(e)) });
          });
        }
    
        /* 二次确认：只有一句确认 + 取消/删除两个按钮。
           按要求**不显示**删除范围选择、不显示运行态提示。 */
        if (state.current.phase === 'confirm') {
          return h('div', { className: 'pxs-confirm', role: 'menuitem' },
            h('div', { className: 'pxs-confirm-text' },
              '彻底删除「' + (props.displayTitle || '该会话') + '」？'),
            h('div', { className: 'pxs-confirm-meta' },
              '记录、本对话写过的文件与无引用附件都会被删除'),
            h('div', { className: 'pxs-confirm-actions' },
              h('button', { type: 'button', className: 'pxs-cbtn', onClick: cancel }, '取消'),
              h('button', { type: 'button', className: 'pxs-cbtn pxs-danger', onClick: doDelete }, '删除')));
        }
    
        /* 诊断一律可见：灰掉时下方那行小字就是原因，
           不再需要用户猜"为什么点不了"。 */
        var sizeLabel = '';
        if (pr) {
          if (pr.bytes > 0) sizeLabel = fmtBytes(pr.bytes);
          else if (pr.artifacts && pr.artifacts.bytes > 0) sizeLabel = fmtBytes(pr.artifacts.bytes);
        }
        return h('div', { className: 'pxs-item-wrap' },
          h('button', {
            type: 'button',
            className: 'pxs-item' + (mc ? '' : ' pxs-dim'),
            role: 'menuitem',
            title: mc
              ? ('删除会话：记录 ' + (pr.dirs || 0) + ' 份' +
                 (pr.artifacts && pr.artifacts.allowed ? '，写过文件 ' + pr.artifacts.allowed + ' 个' : ''))
              : (state.current.diag || '磁盘和工作区都找不到该会话'),
            disabled: state.current.phase === 'deleting' || !mc,
            onClick: function (e) { e.preventDefault(); reallyDelete(); },
          },
            h('span', { className: 'pxs-ico' }, '🗑'),
            h('span', { className: 'pxs-label' },
              state.current.phase === 'deleting' ? '删除中…' : '删除会话'),
            sizeLabel ? h('span', { className: 'pxs-size' }, sizeLabel) : null,
          state.current.error
            ? h('div', { className: 'pxs-err' }, state.current.error)
            : (state.current.diag && !mc
                ? h('div', { className: 'pxs-diag' }, state.current.diag)
                : null)));
      }
    
      /* ---------------- 右键行 → 打开宿主菜单 ----------------
         纯 DOM 手法：捕获 contextmenu → 定位被点的**那一行** → 行内找「...」按钮
         → preventDefault 后合成 click。不重画菜单。
    
         ⚠ 用户实测：右键空白区域会误触发第一个工作区的菜单。
           根因是上一版的几何判据太宽 —— 空白处向上找祖先会命中**整个列表容器**
           （容器里有大量 button、宽度也不超限），于是"取最后一个 button"点中了
           某一行。这属于把容器当成了行。
    
         现在的判据同时要求以下四条，缺一不可：
           ① 容器高度像**单行**（12–64px）：列表容器/分组容器高度远超此值；
           ② 点击坐标确实落在该容器的矩形内（排除点在容器之外但被冒泡到了）；
           ③ 容器宽度合理（≤ 520px，侧栏一行不会更宽）；
           ④ 容器内 button 数量 ≤ 6：一行只有「...」+ 可能的一两个快捷动作，
              列表容器动辄十几个，直接被排除。
         四条都满足才认为"右键的是一行"。空白区域点击时，最近祖先要么高度过界，
         要么按钮过多，一律不命中 → 不 preventDefault、不弹任何菜单。 */
      function installContextMenu() {
        var MAX_ROW_HEIGHT = 64
        var MIN_ROW_HEIGHT = 12
        var MAX_ROW_WIDTH = 520
        var MAX_ROW_BUTTONS = 6
    
        function pickTrigger(scope) {
          // ① 语义锚点
          var t = scope.querySelector && scope.querySelector('[aria-haspopup="menu"]')
          if (t) return t
          // ② aria-label 语义
          var labels = scope.querySelectorAll && scope.querySelectorAll('button[aria-label]')
          if (labels) {
            for (var i = 0; i < labels.length; i++) {
              var lab = String(labels[i].getAttribute('aria-label') || '').toLowerCase()
              if (/more|more actions|更多|操作|menu|\.\.\.|…/.test(lab)) return labels[i]
            }
          }
          // ③ 行内最后一个 button（行尾通常是「...」）。
          //    仅在按钮很少时使用 —— 容器已被 MAX_ROW_BUTTONS 排除，这里再收紧一层。
          var btns = scope.querySelectorAll && scope.querySelectorAll('button')
          if (btns && btns.length && btns.length <= MAX_ROW_BUTTONS) return btns[btns.length - 1]
          return null
        }
    
        function onContextMenu(e) {
          var x = e.clientX
          var y = e.clientY
          var cur = e.target
          for (var depth = 0; depth < 10 && cur && cur !== document.body; depth++) {
            if (cur.nodeType !== 1) { cur = cur.parentElement; continue }
            var r = cur.getBoundingClientRect()
    
            /* 提前退出（性能关键）：祖先的矩形只会比后代更大，所以一旦
               高度已超过行高上限，再往上走只会更大，不可能命中 —— 直接返回。
               原来这里 continue 继续上溯，白白多算近 10 层的
               getBoundingClientRect + querySelectorAll('button')。 */
            if (r.height > MAX_ROW_HEIGHT) return
    
            var btns = cur.querySelectorAll ? cur.querySelectorAll('button') : null
    
            var okHeight = r.height >= MIN_ROW_HEIGHT && r.height <= MAX_ROW_HEIGHT
            var okWidth = r.width > 0 && r.width <= MAX_ROW_WIDTH
            var okCount = btns && btns.length >= 1 && btns.length <= MAX_ROW_BUTTONS
            var okPoint = y >= r.top && y <= r.bottom && x >= r.left && x <= r.right
    
            if (!(okHeight && okWidth && okCount && okPoint)) {
              cur = cur.parentElement
              continue
            }
            var trig = pickTrigger(cur)
            if (trig) {
              e.preventDefault()
              e.stopPropagation()
              try { trig.click() } catch { /* 忽略 */ }
              return
            }
            cur = cur.parentElement
          }
        }
    
        document.addEventListener('contextmenu', onContextMenu, true)
        return function () { document.removeEventListener('contextmenu', onContextMenu, true) }
      }
    
      var CSS = [
        /* 菜单项：与宿主菜单行视觉一致，只补自己的强调色 */
        '.pxs-item-wrap{padding:0}',
        '.pxs-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;',
        'border:none;border-radius:6px;background:transparent;color:inherit;',
        'font:inherit;font-size:12.5px;text-align:left;cursor:pointer}',
        '.pxs-item:hover{background:rgba(198,40,40,.10)}',
        '.pxs-item:disabled{opacity:.55;cursor:default}',
        '.pxs-item:disabled:hover{background:transparent}',
        '.pxs-dim{opacity:.55}',
        '.pxs-ico{flex:none;font-size:13px;line-height:1}',
        /* 「删除会话」这几个字用红色（用户要求）。
           .pxs-label 全文件只有这一处使用，所以直接给它上色即可。
           颜色走主题令牌 state-error-primary（与 .pxs-err 同一套），
           深色/浅色主题会自动跟随，不会像硬编码 #c62828 那样在深色下刺眼。 */
        '.pxs-label{flex:1;min-width:0;color:var(--dsw-alias-state-error-primary,#c62828)}',
        '.pxs-size{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary,#8f959e)}',
        /* 二次确认行内展开，不弹独立对话框 —— 这样仍在菜单内，Esc 可退 */
        '.pxs-confirm{padding:8px 10px}',
        '.pxs-confirm-text{font-size:12px;line-height:1.5;color:inherit}',
        '.pxs-confirm-meta{margin-top:4px;font-size:11px;line-height:1.6;',
        'color:var(--dsw-alias-label-secondary,#8f959e);word-break:break-all}',
        '.pxs-confirm-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}',
        '.pxs-cbtn{height:26px;padding:0 12px;border-radius:6px;border:1px solid transparent;',
        'background:rgba(0,0,0,.06);color:inherit;font-size:12px;cursor:pointer}',
        '.pxs-cbtn:hover{background:rgba(0,0,0,.10)}',
        'body[data-ds-dark-theme] .pxs-cbtn{background:rgba(255,255,255,.10)}',
        'body[data-ds-dark-theme] .pxs-cbtn:hover{background:rgba(255,255,255,.18)}',
        '.pxs-danger{background:#c62828 !important;color:#fff !important}',
        '.pxs-danger:hover{background:#a51f1f !important}',
        '.pxs-err{margin-top:6px;font-size:11px;line-height:1.5;color:#c62828}',
        '.pxs-diag{margin-top:4px;font-size:10.5px;line-height:1.45;',
        'color:var(--dsw-alias-label-secondary,#8f959e)}',
      ].join('\n');
    
      return function installSession(c) {
        
        if (typeof document !== 'undefined') {
          /* 样式由装配层统一拥有，这里只幂等追加。 */
          PU_ensureCss('session', CSS);
        }
    
        var offs = [];
    
        /* 会话菜单行：order 500，排在宿主 session-id(450) 之后 */
        offs.push(c.slots.inject('sidebar.workspaces.session.menu.item', function () {
          return c.slots.register(
            { name: 'sidebar.workspaces.session.menu.item',
              id: 'dsh-perfect-ui.delete-session', order: 500,
              label: function () { return '删除会话'; } },
            DeleteSessionMenuItem);
        }));
    
        /* 右键打开会话菜单：纯 DOM 监听，随插件卸载移除 */
        var offCtx = installContextMenu();
        offs.push(function () { try { offCtx(); } catch (e) { /* 已移除 */ } });
    
        return function () {
          for (var i = 0; i < offs.length; i++) { try { offs[i](); } catch (e) { /* 已撤销 */ } }
        };
      };
    }
    





    return {
      /* 依赖声明以两条运行时诊断为准（用户截图原文）：
           cannot get property "remote.account" without inject
           cannot get property "remote.session" without inject
         —— 但**不能**把点号键写进这里：'remote.session' 不是 Cordis 服务键，
         硬依赖解析不到会让本条目整体不活动，连配色一起消失。
         余额链路的既有证据：声明只有 'remote'，取用走
         ctx.get('remote.account') / ctx.get('remote').account 两条点号路径
         都能拿到命名空间（2.6.0 起余额工作至今）。model.js 的
         sessionRemoteOf 采用同一模式，不依赖点号声明。
         sessions：模型面板读当前会话（retainedBy.mainView 模式，宿主标题
         组件同款），selectModel 的 sessionId 必填；提供方 ui-session 已核实 active。
         风险已评估：api-remotes / account-controller / ui-session 在本 profile
         均 active，依赖必定可满足；即使不可满足，也只有本条目不激活，
         不会像接管 root 那样拖垮 ui-layout（那次让 26 个插件连锁 pending）。 */
      inject: ['theme', 'slots', 'remote', 'locale', 'sessions'],
      apply(ctx) {
        /* ================================================================
           装配层。每个可开关的功能都经 feature() 包装：apply 时读设置页的
           开关决定是否安装，开关变化时就地重装 / 撤销 —— 即时生效，
           不需要重启，也不写 profile（不影響其它插件与宿主行为）。
           偏好持久化在 localStorage：客户端半边没有存储服务，ctx 白名单里
           只有 theme/slots/remote/locale/sessions/layout/timer/workspaces，
           而宿主 ui-settings 自己也是这么存的。
           ================================================================ */
        var PU_SET = PU_settings(React, h);

        /* 通用包装：key 是开关名，install 返回 disposer（或 undefined）。
           只在该开关真的变化时重建，避免无关改动引发全部功能重挂。 */
        function feature(label, key, install) {
          ctx.effect(function () {
            var disposed = null;
            function mount() {
              if (disposed) { try { disposed(); } catch (e) { /* 已撤销 */ } disposed = null; }
              if (PU_SET.store.value[key]) disposed = install() || null;
            }
            mount();
            var last = PU_SET.store.value[key];
            var off = PU_SET.store.subscribe(function () {
              if (PU_SET.store.value[key] === last) return;
              last = PU_SET.store.value[key];
              mount();
            });
            return function () {
              off();
              if (disposed) { try { disposed(); } catch (e) { /* 已撤销 */ } }
            };
          }, 'dsh-perfect-ui: ' + label);
        }

        /* A1. 令牌样式表（确定性通道）。随本包卸载移除，不留残余。
              注入前先摘掉同 id 的旧标签：页面开着时换版本会留下前一代标签，
              两代叠加会让旧值继续生效。 */
        ctx.effect(function () {
          if (typeof document === 'undefined') return undefined;
          var old = document.querySelectorAll('style[data-plugin-css="' + PU_PLUGIN_ID + '/tokens.css"]');
          for (var i = 0; i < old.length; i++) old[i].remove();
          var tag = document.createElement('style');
          tag.dataset.plugin = PU_PLUGIN_ID;
          tag.dataset.pluginCss = PU_PLUGIN_ID + '/tokens.css';
          tag.textContent = PU_SHEET;
          document.head.appendChild(tag);
          return function () { tag.remove(); };
        }, 'dsh-perfect-ui: token sheet');

        /* CSS 容器所有权：本 effect 负责创建与移除，模块只追加。
           这样任一功能开关都不会让别人的样式消失。 */
        ctx.effect(function () {
          if (typeof document === 'undefined') return undefined;
          var old = document.querySelectorAll('style[data-plugin-css="' + PU_CSS_ID + '"]');
          for (var i = 0; i < old.length; i++) old[i].remove();
          PU_CSS_SEEN = {};
          var tag = document.createElement('style');
          tag.dataset.plugin = PU_PLUGIN_ID;
          tag.dataset.pluginCss = PU_CSS_ID;
          tag.textContent = '';
          document.head.appendChild(tag);
          return function () {
            PU_CSS_SEEN = {};
            try { tag.remove(); } catch (e) { /* 已移除 */ }
          };
        }, 'dsh-perfect-ui: controls css container');
        /* A2. 主题扩展点：让 Theme 服务 / inspect 如实反映本主题。 */
        ctx.effect(function () {
          var dispose = ctx.theme.overrideTokens(PU_SOURCE, PU_TOKENS);
          return function () {
            if (typeof dispose === 'function') dispose();
          };
        }, 'dsh-perfect-ui: mint token layer');

        /* A3. 自定义背景层（设置页写入，真实生效通道）。
           ⚠ 这里**不用** ctx.theme.overrideTokens —— 实测证明它盖不动：
             用户把 --dsw-alias-bg-base 设成 #ffffff，localStorage 里也存着 #ffffff，
             但运行时读 body 上的该变量仍是主题默认的 #e2f0ec。
             根因（控制台实测确认）：本插件的 tokens.css 是
               html body{--dsw-alias-bg-base:#e2f0ec !important;...}
             而 overrideTokens 产出的是**不带 !important** 的作者样式，
             被这条 !important 完全压制。所以无论它怎么调都盖不过自己的主题表。

           正确做法：把用户选的颜色并进**同一个** !important 通道 ——
           动态改写 tokens.css 的 textContent。两边优先级一致
           （都是 html body + !important），后写入的自定义值覆盖主题默认值。
           这样也不依赖宿主的任何内部机制（实例归属、激活时序、presenter 重放）。

           只允许覆盖 PU_TOKENS 里已知的 bg 令牌：文字色与品牌色留给主题层，
           避免用户把界面调成读不出来的组合。清空自定义 = 重新生成纯主题 sheet。 */
        ctx.effect(function () {
          var STYLE_ID = PU_PLUGIN_ID + '/tokens.css';
          var TOKEN_NAMES = Object.keys(PU_TOKENS);

          /* ---- 性能优化 1：只重建「被改动令牌」的声明，不重建整张表 ----
             之前每次颜色变化都重跑 sheetFor(bg)：遍历 50 个令牌 × 2 模式、
             重建整个对象、再拼 80 条声明、重写 style.textContent。
             拖动 <input type=color> 时 onChange **连续触发**（实测约每秒数十次），
             于是每秒几十次「解析 CSS + 全页样式重算 + 全页重排」——这就是卡顿来源。

             现在拆成两段：
               baseSheet —— 主题默认表，只在首次生成一次，之后永不重建；
               customDecls —— 只包含用户真正改过的令牌（通常 1~4 个），
                            每次变化只重拼这几条。80 条 → 通常 2 条。 */
          var baseSheet = null;
          function ensureBase() {
            if (baseSheet) return baseSheet;
            var light = TOKEN_NAMES.map(function (n) {
              var t = PU_TOKENS[n] || {};
              return n + ':' + t.light + ' !important;';
            }).join('');
            var dark = TOKEN_NAMES.map(function (n) {
              var t = PU_TOKENS[n] || {};
              return n + ':' + t.dark + ' !important;';
            }).join('');
            var NL = String.fromCharCode(10);
            baseSheet = 'html body{' + light + '}' + NL + 'html body[data-ds-dark-theme]{' + dark + '}';
            return baseSheet;
          }

          /* 只取「用户设过且值合法」的令牌，生成覆盖块。没有覆盖时返回空串，
             此时直接沿用 baseSheet —— 不产生任何多余写入。 */
          function customSheet(bg) {
            var light = [];
            var dark = [];
            ['light', 'dark'].forEach(function (mode) {
              var table = (bg && bg[mode]) || {};
              Object.keys(table).forEach(function (id) {
                if (!PU_TOKENS[id]) return;                                 /* 只允许已知令牌 */
                if (!/^#[0-9a-fA-F]{6}$/.test(String(table[id]))) return;    /* 必须 6 位 hex */
                var decl = id + ':' + table[id] + ' !important;';
                if (mode === 'light') light.push(decl); else dark.push(decl);
              });
            });
            if (light.length === 0 && dark.length === 0) return '';
            var NL = String.fromCharCode(10);
            var out = '';
            /* 覆盖块必须写在 baseSheet 之后，同优先级下后者胜出 */
            if (light.length) out += 'html body{' + light.join('') + '}' + NL;
            if (dark.length) out += 'html body[data-ds-dark-theme]{' + dark.join('') + '}' + NL;
            return out;
          }

          /* ---- 性能优化 2：rAF 合并 ----
             拖动色盘时 onChange 会密集触发；用 requestAnimationFrame 合并，
             一帧最多写一次样式，避免同一帧内写 N 次。 */
          var pending = false;
          var rafId = 0;

          function writeNow() {
            pending = false;
            rafId = 0;
            var tag = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]');
            if (!tag) return;                                                 /* sheet 尚未注入 */
            var next;
            try {
              next = ensureBase() + customSheet(PU_SET.store.value.bg);
            } catch (e) {
              try { console.error('[dsh-perfect-ui] custom bg failed:', e && e.message) } catch (_) { /* 无 console */ }
              return;
            }
            /* ---- 性能优化 3：内容没变就不写 ----
               style.textContent 赋值即使是相同字符串也会触发 CSS 重解析，
               因此先比对；拖动时大量重复值（离散的 hex）能被这层直接吃掉。 */
            if (tag.textContent === next) return;
            tag.textContent = next;
          }

          function schedule() {
            if (pending) return;
            pending = true;
            if (typeof requestAnimationFrame === 'function') {
              rafId = requestAnimationFrame(writeNow);
            } else {
              /* 极端环境没有 rAF：退回微任务合并，仍然一帧最多一次 */
              Promise.resolve().then(writeNow);
            }
          }

          writeNow();                                                         /* 首次同步写，避免首屏闪烁 */
          var off = PU_SET.store.subscribe(schedule);
          return function () {
            off();
            pending = false;
            if (rafId && typeof cancelAnimationFrame === 'function') { try { cancelAnimationFrame(rafId) } catch (e) { /* 忽略 */ } }
            rafId = 0;
            /* 卸载时还原成纯主题色，不留用户自定义残留 */
            try {
              var tag = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]');
              if (tag) tag.textContent = ensureBase();
            } catch (e) { /* 已移除 */ }
          };
        }, 'dsh-perfect-ui: custom background layer');

        /* B. 余额查询（可开关）。 */
        feature('balance feature', 'balance', function () {
          return PU_features(React, h)(ctx);
        });

        /* B4. 工作区一键运行命令（可开关）。
              命令由 Host 侧经系统 shell 执行（host-actions.js），
              这里只负责按钮与结果面板。 */
        feature('workspace actions', 'actions', function () {
          return PU_actions(React, h)(ctx);
        });

        /* B5. 会话删除 + 右键打开会话菜单（可开关）。
              菜单行注册在 sidebar.workspaces.session.menu.item（list, none），
              删除通道走 Host 的 host-session.js（磁盘目录 → 回收站）。
              开关关掉后没有菜单行，用户就无从调用删除路由；
              右键接管也随之解除（两者在同一个 install 里）。 */
        feature('session delete', 'deleteSession', function () {
          return PU_session(React, h)(ctx);
        });

        /* B3. 模型修改样式（可开关）。
              它做两件事：① 把输入框的模型选择器改成两行（强度 + 模型名）；
              ② 接管点击，改为弹出本插件的面板（含推理强度滑块）。
              关掉后：类名被 cleanupClasses 摘除、宿主点击被 unhookAll 还原、
              观察器与定时器断开，按钮回到宿主原生单行样式。
              ⚠ 上一轮重写装配层时漏掉过这段，导致模型样式整体消失，别再删。 */
        feature('model style', 'modelStyle', function () {
          return PU_model(React, h)(ctx);
        });
        /* B2. 电源菜单：不设开关。它是标题栏 caption 上的原生尺寸按钮，
              关掉会让用户找不到关闭窗口，与"控件开关"的诉求无关。 */
        ctx.effect(function () {
          return PU_power(React, h)(ctx);
        }, 'dsh-perfect-ui: power menu');

        /* D. 技能市场面板（复刻 @montersy123/dsh-skill-market v2.0.7，MIT）。
              它的 apply(ctx) 不返回 disposer，无法整体撤销。我不侵入改它
              （保留与上游逐字 diff 的能力），而是传一个**影子 ctx**：
              它只用到 effect / locale / slots 三个成员（已实测确认），
              所以影子对象显式提供这三个 —— slots.inject 与 effect 的
              disposer 全部收集起来，关闭时逐个撤销；locale 原样透传。
              边界：只关客户端入口与面板。Host 半边的 /skill-market/api
              代理与已安装技能仍在运行，设置页如实写明这一点。 */
        feature('skill market panel', 'skillMarket', function () {
          var offs = [];
          var shadow = {
            locale: ctx.locale,
            slots: {
              inject: function (key, cb) { offs.push(ctx.slots.inject(key, cb)); },
              register: function () { return ctx.slots.register.apply(ctx.slots, arguments); },
            },
            effect: function (fn) {
              var d = fn();
              if (typeof d === 'function') offs.push(d);
              return function () {};
            },
          };
          PU_SM.apply(shadow);
          return function () {
            for (var i = 0; i < offs.length; i++) { try { offs[i](); } catch (e) { /* 已撤销 */ } }
          };
        });


        /* E. 设置页自身不可关 —— 关掉就改不回来了。 */
        ctx.effect(function () {
          return PU_SET.install(ctx);
        }, 'dsh-perfect-ui: settings section');

      },
    };
  },
});
