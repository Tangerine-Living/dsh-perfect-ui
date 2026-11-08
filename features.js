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
