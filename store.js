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
