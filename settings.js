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
  /* 用 rev + useSyncExternalStore 的写法保证重渲染可靠。
     ⚠ subscribe/getSnapshot 必须是**稳定引用**（模块级函数），不能每渲染新建箭头函数 ——
     否则 useSyncExternalStore 每次渲染都会退订再重订一轮，白白重分配 subs 数组。 */
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

  /* 查状态：进入设置页时对每个推荐项跑一次，让按钮直接显示「已安装 / 安装」 */
  function probeRecommended(item) {
    pluginApi('/status?name=' + encodeURIComponent(item.name)).then(function (d) {
      if (d && d.ok && d.available) {
        if (d.installed) {
          recSet(item.name, {
            phase: 'done',
            version: d.version || '',
            latest: d.latest || '',
            newer: d.newer || [],
            msg: (d.newer && d.newer.length)
              ? ('已安装 v' + (d.version || '?') + '，可更新到 v' + d.latest)
              : '',
          });
        } else {
          recSet(item.name, { phase: 'idle', version: '', latest: d.latest || '', msg: '' });
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
    recSet(item.name, { phase: 'install', msg: '正在安装…' });
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
        recSet(item.name, {
          phase: 'done',
          alreadyInstalled: true,
          version: d.version || '',
          latest: d.latest || '',
          newer: d.newer || [],
          msg: d.message || ('已安装 v' + (d.version || '?')),
        });
        return;
      }
      recSet(item.name, {
        phase: 'done',
        version: d.version || '',
        msg: '安装完成' + (d.version ? ' v' + d.version : '') + '，重启 DSH 后生效',
      });
    }).catch(function (e) {
      recSet(item.name, { phase: 'error', msg: '安装异常：' + ((e && e.message) || String(e)) });
    });
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

    /* 推荐卡的渲染：状态机 idle → install → done / error。
       已装时按钮变「重新安装」，并在标题旁显示版本号。 */
    function recCard(item) {
      var st = recGet(item.name);
      var phase = st.phase || 'idle';
      var busy = phase === 'install';
      var installed = phase === 'done';
      var hasNewer = installed && st.newer && st.newer.length;
      var btnText = busy ? '安装中…'
        : (installed ? (hasNewer ? '更新' : '重装') : '安装');

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
          st.msg ? h('div', { className: 'pus-rec-msg' + (phase === 'error' ? ' is-err' : '') }, st.msg) : null),
        h('button', {
          type: 'button',
          className: 'pus-rec-btn' + (installed ? ' is-done' : ''),
          disabled: busy,
          onClick: function () { if (!busy) installRecommended(item); },
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
