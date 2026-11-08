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
