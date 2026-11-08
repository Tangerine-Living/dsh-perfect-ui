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
