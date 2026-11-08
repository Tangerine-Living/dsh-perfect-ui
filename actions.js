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
