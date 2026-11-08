/* dsh-perfect-ui — 上下文压缩（注入宿主 ContextMeter 弹层）

   ⚠ 这不是「集成 dsh-ctx-trim」，而是给它套一个我控制的壳：
     · 位置：注入到宿主「上下文已用」弹层内部、明细列表下方
     · 动作：点击调 dsh-ctx-trim 的 Host 路由 POST /dsh-ctx-trim/run
     · 依赖：dsh-ctx-trim 必须存在；不存在时本按钮自动隐藏，
             并在设置页提供一键安装

   ---- 为什么用 DOM 注入而不是 slot ----
   宿主的 ContextMeter 组件（ui-conversation 的 ContextMeter.module.css）是
   纯硬编码 JSX：panel → header → bar → rows，**内部没有任何 ctx.slots 注入点**。
   实测 asar 原文确认 createPortal 出来的是固定结构，没有 children 插槽。
   所以只能等它出现在 DOM 里，再往 rows 之后插一行。

   ---- 定位策略（不依赖构建哈希）----
   弹层的类名是 A6Bq1a_panel 这种「模块前缀_名称」，前缀随构建变化。
   因此：
     · 弹层用 role="dialog" + aria-label（含「上下文已用」/ "of context used"）定位
     · 明细容器用类名后缀 _rows 定位
     · 两者都不写死 A6Bq1a，宿主升级换哈希也不会失效

   ---- 生命周期 ----
   弹层每次打开都是新建节点（React unmount/mount），所以注入节点会消失。
   用一个 MutationObserver 盯着 body：发现弹层出现且尚未注入 → 插一行。
   幂等：已存在 puq-trim-row 就跳过，不会重复插入。

   本文件由 build.js 内联进 dist/client.js，在 factory 作用域内执行。 */

function PU_ctxTrim(React, h) {
  'use strict';

  var CTX_TRIM = 'dsh-ctx-trim';
  var ROUTE = '/dsh-ctx-trim';
  var PLUGIN_API = '/api/dsh-perfect-ui-plugins';

  /* 依赖状态：unknown | checking | ready | missing | error */
  var dep = { phase: 'unknown', version: '', msg: '' };
  var depSubs = [];
  function depSet(patch) {
    dep = Object.assign({}, dep, patch);
    var list = depSubs.slice();
    for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { /* 忽略 */ } }
  }
  function depGet() { return dep; }

  /* 同源请求（照 features.js / actions.js 已验证的写法：先 text 再 parse） */
  function req(url, opts) {
    return Promise.resolve().then(function () { return fetch(url, opts); }).then(function (r) {
      return r.text().then(function (txt) {
        if (!txt || !txt.trim()) throw new Error('服务端返回空响应（HTTP ' + r.status + '）');
        try { return JSON.parse(txt); } catch (e) { throw new Error('响应不是 JSON（HTTP ' + r.status + '）'); }
      });
    });
  }

  /* ---- 依赖检查 ---- */
  function checkDep() {
    depSet({ phase: 'checking', msg: '' });
    return req(PLUGIN_API + '/ensure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      /* required:false → 只查不装 */
      body: JSON.stringify({ name: CTX_TRIM, required: false }),
    }).then(function (d) {
      if (!d || !d.ok) {
        depSet({ phase: 'error', msg: (d && d.error) || '无法检查依赖' });
        return;
      }
      if (d.installed) {
        depSet({ phase: 'ready', version: d.version || '', msg: '' });
      } else {
        depSet({ phase: 'missing', version: '', msg: '未安装 ' + CTX_TRIM });
      }
    }).catch(function (e) {
      depSet({ phase: 'error', msg: '检查失败：' + ((e && e.message) || String(e)) });
    });
  }

  /* ---- 联动安装（用户点「安装依赖」时调用）---- */
  function installDep() {
    depSet({ phase: 'checking', msg: '正在安装…' });
    return req(PLUGIN_API + '/ensure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: CTX_TRIM, required: true }),
    }).then(function (d) {
      if (d && d.ok && d.installed) {
        depSet({ phase: 'ready', version: d.version || '', msg: d.justInstalled ? '已安装 ' + (d.version || '最新版') : '' });
        return { ok: true, justInstalled: !!d.justInstalled };
      }
      depSet({ phase: 'missing', msg: (d && d.error) || '安装失败' });
      return { ok: false };
    }).catch(function (e) {
      depSet({ phase: 'error', msg: '安装异常：' + ((e && e.message) || String(e)) });
      return { ok: false };
    });
  }

  /* ---- 当前会话 id 通道 ----
     ⚠ 这是本模块最关键的一点：/dsh-ctx-trim/run 的 sessionId 是**必填**，
       传空串直接 400「缺 sessionId」（用户实测报的就是这条）。

     ctx-trim 自己怎么拿？它注册在 conversation.session.header.actions，
     那是 scope:"session" 的 slot，宿主会把 props.sessionId 传给它。

     我走的是 DOM 注入（因为 ContextMeter 弹层内部没有 slot），拿不到这个 prop。
     所以另开一条通道：**注册一个不可见的 slot 在同一数组里**，只为采 sessionId。
     它不渲染任何东西（返回 null），但宿主仍会调用它并传入 session 作用域 props。
     这样既拿到 id，又不在界面上留下任何痕迹。 */
  var currentSessionId = '';
  var sidSubs = [];
  function sidSet(id) {
    if (!id || id === currentSessionId) return;
    currentSessionId = String(id);
    var list = sidSubs.slice();
    for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { /* 忽略 */ } }
  }
  function sidGet() { return currentSessionId; }
  function sidSub(fn) { sidSubs.push(fn); return function () { sidSubs = sidSubs.filter(function (f) { return f !== fn; }); }; }

  /* ---- 触发压缩 ---- */
  /* ---- 查压缩状态 ----
     /dsh-ctx-trim/status 返回 compacting（compactionActive(session)），
     据此可以知道上一次压缩有没有收尾。 */
  function runStatus(sessionId) {
    var sid = String(sessionId || currentSessionId || '');
    if (!sid) return Promise.resolve(null);
    return req(ROUTE + '/status?sessionId=' + encodeURIComponent(sid)).catch(function () { return null; });
  }

  /* ---- 触发压缩 ----
     ⚠ 为什么必须带超时：
       ctx-trim 的 /run 内部调用 agent.runMaintenance(...)，**它会等 agent 空闲**。
       当 Agent 正在跑（对话进行中通常都如此），那个 Promise 一直不 resolve，
       HTTP 请求就永远挂着 —— 用户看到的就是「一直在正在压缩…」。
       这不是 bug，是它的设计（压缩必须在空闲时做）。

       对策：给请求设 20 秒上限。超时后不再干等，改为查 /status：
         · compacting=true  → 说明压缩已经在队列里，告知用户等当前回合结束
         · compacting=false → 没排上队，提示稍后重试
       两种情况都不让按钮永久转圈。 */
  var RUN_TIMEOUT_MS = 20000;

  function runTrim(sessionId, mode) {
    var sid = String(sessionId || currentSessionId || '');
    if (!sid) {
      return Promise.resolve({ ok: false, message: '拿不到当前会话 id（等会话加载完成再试，或改用会话头部的原按钮）' });
    }

    var timer = 0;
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(function () {
        /* 超时：查一次状态，给出可执行的说明 */
        runStatus(sid).then(function (st) {
          var compacting = !!(st && st.ok && st.compacting);
          resolve({
            ok: false,
            timeout: true,
            message: compacting
              ? '已排入压缩队列，需等当前回合结束后才执行（可稍后重新打开此面板查看）'
              : '压缩请求未在 20 秒内完成：Agent 正忙时压缩会排队，请等当前回合结束后再试',
          });
        });
      }, RUN_TIMEOUT_MS);
    });

    var request = req(ROUTE + '/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, mode: mode || 'normal' }),
    }).then(function (d) {
      if (d && d.ok) return { ok: true, message: d.message || '已压缩' };
      return { ok: false, message: (d && (d.message || d.error)) || '压缩失败' };
    }).catch(function (e) {
      return { ok: false, message: '请求失败：' + ((e && e.message) || String(e)) };
    });

    return Promise.race([request, timeout]).then(function (r) {
      if (timer) { clearTimeout(timer); timer = 0; }
      return r;
    });
  }

  return {
    CTX_TRIM: CTX_TRIM,
    ROUTE: ROUTE,
    depGet: depGet,
    depSubs: function () { return depSubs; },
    depSub: function (fn) { depSubs.push(fn); return function () { depSubs = depSubs.filter(function (f) { return f !== fn; }); }; },
    checkDep: checkDep,
    installDep: installDep,
    runTrim: runTrim,
    runStatus: runStatus,
    sidGet: sidGet,
    sidSet: sidSet,
    sidSub: sidSub,
  };
}

/* DOM 注入器单独放外面，因为它操作真实 DOM，不依赖 React。
   导出给 build.js 的装配层调用。 */
var PU_ctxTrimInjector = (function () {
  'use strict';

  var ROW_CLASS = 'puq-trim-row';
  var STYLE_ID = 'dsh-perfect-ui/ctx-trim.css';

  /* ---- 注入自己的样式表 ----
     这个按钮是 DOM 注入进来的，不在本插件的 controls.css 管辖里
     （那份 CSS 由装配层统一维护），所以单独一个 <style>。
     幂等：同 id 已存在就直接复用，避免重复注入。
     视觉（按用户截图要求）：
       · 整块撑满弹层宽度、浅灰底、圆角
       · 内容居中，品牌色文字 + 图标
       · hover 略深，disabled 降透明度 */
  var CSS = [
    '.puq-trim-row{margin:8px 0 0;padding:0;display:block}',
    '.puq-trim-btn{display:flex;align-items:center;justify-content:center;gap:6px;',
    'width:100%;box-sizing:border-box;padding:7px 12px;border:none;cursor:pointer;',
    'border-radius:var(--dsw-radius-sm,8px);',
    'background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.055));',
    'color:var(--dsw-alias-brand-primary,#1f7a53);',
    'font-family:inherit;font-size:var(--dsh-content-font-size-secondary,13px);',
    'font-weight:500;line-height:1.4;text-align:center;',
    'transition:background-color .14s ease,opacity .14s ease}',
    '.puq-trim-btn:hover{background:var(--dsw-alias-interactive-bg-pressed,rgba(0,0,0,.085))}',
    '.puq-trim-btn:active{opacity:.85}',
    '.puq-trim-btn:disabled{opacity:.55;cursor:default}',
    '.puq-trim-btn svg{width:14px;height:14px;flex:none}',
    '.puq-trim-hint{display:block;margin-top:5px;font-size:11px;line-height:1.5;',
    'color:var(--dsw-alias-label-secondary,#5c6b68);text-align:center}',
    '.puq-trim-hint.is-err{color:var(--dsw-alias-state-error-primary,#c62828)}',
    '.puq-trim-hint.is-ok{color:var(--dsw-alias-brand-primary,#1f7a53)}',
    /* ---- 隐藏 ctx-trim 自己的会话头部按钮 ----
       它的按钮用**内联 style**（没有 className），所以只能用属性选择器定位：
       它渲染成 span[style] > button[title=...]，title 来自 t("title")。
       中文 title 是「上下文压缩」，英文是 "Context trim"。
       用 title^= 匹配中文前缀 + 精确匹配英文，覆盖两种语言。
       为什么要隐藏：用户要求功能集中到弹层里的那一个按钮，
       两个入口并存会让人不知道该点哪个（而且原按钮点了同样会卡住）。 */
    'span[style*="inline-flex"] > button[title^="上下文压缩"],',
    'span[style*="inline-flex"] > button[title="Context trim"]{display:none !important}',
  ].join(String.fromCharCode(10));

  function ensureStyle() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var found = null;
    try {
      found = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]');
    } catch (e) { found = null; }
    if (found) return found;
    var tag = document.createElement('style');
    tag.setAttribute('data-plugin', 'dsh-perfect-ui');
    tag.setAttribute('data-plugin-css', STYLE_ID);
    tag.textContent = CSS;
    /* 注入目标：优先 head，退到 documentElement。
       原来只试 head，而弹层可能比 head 更早就被观察到（时序问题），
       那样样式表建了却没挂上，表现为「按钮没样式」—— 用户截图正是这样。 */
    try {
      var target = (document.head && document.head.appendChild) ? document.head
        : (document.documentElement && document.documentElement.appendChild ? document.documentElement : null);
      if (target) target.appendChild(tag);
    } catch (e) { /* 都不可用时放弃，功能仍可用 */ }
    return tag;
  }

  /* ---- 定位弹层：role=dialog + aria-label 语义属性 ---- */
  function findPanel() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return null;
    var panels = document.querySelectorAll('[role="dialog"]');
    for (var i = 0; i < panels.length; i++) {
      var el = panels[i];
      var label = (el.getAttribute && el.getAttribute('aria-label')) || '';
      if (label.indexOf('上下文已用') !== -1 || label.indexOf('of context used') !== -1) return el;
    }
    return null;
  }

  /* ---- 定位明细容器：类名后缀 _rows ---- */
  function findRows(panel) {
    if (!panel || !panel.children) return null;
    for (var i = 0; i < panel.children.length; i++) {
      var c = panel.children[i];
      var cls = (c.className && String(c.className)) || '';
      /* A6Bq1a_rows 这类「前缀_名称」——只看后缀，不绑死前缀 */
      if (/_rows$/.test(cls) || /_rows\b/.test(cls)) return c;
    }
    return null;
  }

  function alreadyInjected(panel) {
    if (!panel || !panel.children) return false;
    for (var i = 0; i < panel.children.length; i++) {
      var c = panel.children[i];
      if (c && c.className && String(c.className).indexOf(ROW_CLASS) !== -1) return true;
    }
    return false;
  }

  /* ---- 注入一行按钮 ---- */
  function inject(panel, deps) {
    if (!panel || alreadyInjected(panel)) return false;
    ensureStyle();   /* 幂等：只在第一次真正插入时创建样式表 */
    var rows = findRows(panel);
    if (!rows || !rows.parentElement) return false;

    /* 视觉上与明细行一致：分隔线 + 左右布局 */
    var row = document.createElement('div');
    row.className = ROW_CLASS;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'puq-trim-btn';
    btn.title = '手动压缩较早的对话历史（本地摘要，不调用模型）';

    /* 图标用内联 SVG：emoji 在不同系统/字体下尺寸与颜色不可控，
       而截图里的按钮是「单色图标 + 品牌色文字」，必须用 SVG 才能统一。 */
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var icon = null;
    try {
      icon = document.createElementNS(SVG_NS, 'svg');
      icon.setAttribute('viewBox', '0 0 16 16');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '1.6');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('aria-hidden', 'true');
      /* 压缩器：上下两块挡板 + 中间收窄的箭头 */
      var parts = [
        ['path', { d: 'M2 3.5h12' }],
        ['path', { d: 'M2 12.5h12' }],
        ['path', { d: 'M6.5 6.5h3v3h-3z' }],
        ['path', { d: 'M8 6.5v-2M8 9.5v2' }],
      ];
      for (var pi = 0; pi < parts.length; pi++) {
        var node = document.createElementNS(SVG_NS, parts[pi][0]);
        var at = parts[pi][1];
        for (var k in at) { if (Object.prototype.hasOwnProperty.call(at, k)) node.setAttribute(k, at[k]); }
        icon.appendChild(node);
      }
    } catch (e) { icon = null; }

    var label = document.createElement('span');
    label.textContent = '压缩上下文';

    if (icon) { btn.appendChild(icon); }
    else { /* SVG 不可用时退回文字图标，功能不受影响 */ btn.textContent = '🗜 '; }
    btn.appendChild(label);

    var hint = document.createElement('span');
    hint.className = 'puq-trim-hint';
    hint.textContent = '';

    row.appendChild(btn);
    row.appendChild(hint);

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      /* 依赖缺失就不发请求，直接说明原因 */
      var st = deps && deps.get ? deps.get() : null;
      if (st && st.phase !== 'ready') {
        hint.textContent = st.phase === 'missing'
          ? '需要先安装 ' + deps.name
          : (st.msg || '依赖不可用');
        hint.className = 'puq-trim-hint is-err';
        return;
      }
      btn.disabled = true;
      hint.textContent = '正在压缩…';
      hint.className = 'puq-trim-hint';
      var p = deps.runTrim(deps.sessionId(), 'normal');
      p.then(function (r) {
        hint.textContent = r.message || (r.ok ? '已压缩' : '压缩失败');
        hint.className = 'puq-trim-hint ' + (r.ok ? 'is-ok' : 'is-err');
        btn.disabled = false;
        /* 3 秒后清掉提示，保持界面干净 */
        setTimeout(function () {
          if (hint.textContent === (r.message || '')) hint.textContent = '';
        }, 3000);
      });
    });

    /* 插到 rows 之后（明细列表正下方） */
    rows.parentElement.insertBefore(row, rows.nextSibling);
    return true;
  }

  /* ---- 观察弹层出现 ---- */
  function install(deps) {
    if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return function () { return; };

    /* 立刻注入样式（不等弹层出现）。
       否则第一次打开弹层时样式还没挂上，会先看到无样式的按钮一帧 —— 
       用户截图里的「窄按钮并排」正是这个时序问题。
       这里还顺带把「隐藏 ctx-trim 原按钮」的规则提前生效。 */
    try { ensureStyle(); } catch (e) { /* 样式失败不影响功能 */ }

    var mo = null;
    var scheduled = false;

    function sweep() {
      scheduled = false;
      var panel = findPanel();
      if (!panel) return;
      inject(panel, deps);
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      /* rAF 合并：弹层打开时 body 会有多次 mutation，一帧只扫一次 */
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(sweep);
      } else {
        Promise.resolve().then(sweep);
      }
    }

    mo = new MutationObserver(schedule);
    try {
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      /* 观察失败不应影响装配 */
      try { mo.disconnect(); } catch (_) { /* 忽略 */ }
      mo = null;
    }
    /* 首次也扫一次（插件可能在弹层已打开时才启用） */
    schedule();

    return function () {
      if (mo) { try { mo.disconnect(); } catch (e) { /* 已断开 */ } mo = null; }
      /* 卸载时移除可能残留的行 */
      try {
        var styleTag = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]');
        if (styleTag && styleTag.parentElement) styleTag.parentElement.removeChild(styleTag);
      } catch (e) { /* 已移除 */ }
      try {
        var leftovers = document.querySelectorAll('.' + ROW_CLASS);
        for (var i = 0; i < leftovers.length; i++) {
          if (leftovers[i].parentElement) leftovers[i].parentElement.removeChild(leftovers[i]);
        }
      } catch (e) { /* 已移除 */ }
    };
  }

  return { install: install, findPanel: findPanel, findRows: findRows };
})();
