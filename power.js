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
