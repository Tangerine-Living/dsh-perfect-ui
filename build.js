/* build.js — 由 theme-tokens.js 生成 dist/client.js（唯一的 Client 半边产物）
   用法：node build.js
   ------------------------------------------------------------------------
   本插件是**真主题插件**：不挂载任何覆盖层 DOM，只走 DSH 官方的第三方主题
   扩展点 ctx.theme.overrideTokens(source, tokens)。

   为什么这样就等于「完全改变当前界面」：
     · 宿主 ui-theme 把全部配色收在 --dsw-alias-* 语义令牌里（design-platform.css）；
     · 本插件注册的覆盖层被 ThemeRuntime.composeActive 折进 snapshot.active.tokens；
     · 宿主 ui-layout 的 ThemePresenter.apply() 逐条写成 body 的**内联** CSS 变量，
       内联优先级高于样式表规则，因此真实界面整体换肤；
     · 会话列表、输入框、流式回复、快捷键、右侧栏全是宿主原生组件 —— 功能真实。
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(resolve(here, f), 'utf8');

// 令牌表是单一事实来源：从 theme-tokens.js 读出、校验形状后内联进产物。
const src = read('theme-tokens.js');
const start = src.indexOf('{', src.indexOf('export const TOKENS'));
if (start < 0) throw new Error('theme-tokens.js 未找到 export const TOKENS');
const objText = src.slice(start, src.lastIndexOf('};') + 1)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const tokens = (0, eval)(`(${objText})`);

const names = Object.keys(tokens);
if (!names.length) throw new Error('令牌表为空');
for (const name of names) {
  const v = tokens[name];
  if (!name.startsWith('--')) throw new Error(`令牌名必须以 -- 开头：${name}`);
  if (!v || typeof v.light !== 'string' || typeof v.dark !== 'string') {
    throw new Error(`令牌 ${name} 缺少 { light, dark } 字符串对（宿主会抛 teaching error）`);
  }
}

const manifest = JSON.parse(read('manifest.json'));

/* ---------- B. 功能半边源码 ---------- */
const features = read('features.js');
const power = read('power.js');
const model = read('model.js');
const actions = read('actions.js');
const session = read('session.js');
const smClient = read('vendor-skill-market-client.js');
const settings = read('settings.js');
const storeSrc = read('store.js');
const peakSrc = read('peak.js');
const IND = '    ';
const indent = (s) => s.replace(/^/gm, IND);

/* ---------- C. 令牌样式表：确定性通道 ----------
   为什么不能只靠 ctx.theme.overrideTokens：
     宿主 ui-layout 的 ThemePresenter 把 snapshot.active.tokens 写成 body 的
     **内联**变量（client.js:563-566）。内联优先级高于任何作者样式表，所以只要
     那条链路有任何一环没走到本层（实例归属、激活时序、presenter 未重新 apply），
     我们的值就被内联的宿主默认值压住 —— 用户截图正是「按钮出现了、配色没变」。
   解法：作者 !important。CSS 层叠中作者 !important 高于非 important 的内联声明，
   因此无论 presenter 写没写、写了什么，本表必定生效；同时仍注册 overrideTokens，
   让 Theme 服务与 inspect 如实反映本主题（两处取值一致，不会互相打架）。
   深色跟随宿主已有的 body[data-ds-dark-theme] 属性，即 Appearance 的深浅色。
   注入方式抄宿主静态包自己的做法（ui-theme installThemeStyles）：静态包的
   factory 里没有 styles builtin（它只对 dynamic 半边可用），必须自建 <style>。 */
const lightDecls = names.map((n) => `${n}:${tokens[n].light} !important;`).join('');
const darkDecls = names.map((n) => `${n}:${tokens[n].dark} !important;`).join('');
const tokenSheet = `html body{${lightDecls}}\n`
  + `html body[data-ds-dark-theme]{${darkDecls}}`;

const out = `/* dsh-perfect-ui — 生成产物，请勿手工编辑。
   源文件：theme-tokens.js + features.js + power.js + model.js + actions.js + session.js
           + vendor-skill-market-client.js（复刻 @montersy123/dsh-skill-market v2.0.7，MIT）
   重新生成：node build.js */

/* 技能市场 Client 半边在**顶层**内联，不缩进：
   它的模块体里有大量多行模板字面量，任何整体缩进都会改变模板内容。 */
${smClient}

window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.packageName)},
  factory(require) {
    'use strict';
    var React = require('react');
    var h = React.createElement;

    /* ============ A. 主题层：语义令牌覆盖表 ============ */
    var PU_SOURCE = ${JSON.stringify(manifest.themeSource)};
    var PU_TOKENS = ${JSON.stringify(tokens, null, 2)};
    var PU_SHEET = ${JSON.stringify(tokenSheet)};
    var PU_PLUGIN_ID = ${JSON.stringify(manifest.packageName)};
    /* 构建版本戳。2.4.0 与 2.4.1 的诊断文字逐字相同，无法区分
       「修复无效」与「页面仍跑旧代际」。版本显示在卡片底部一次排除。 */
    var PU_VERSION = ${JSON.stringify(manifest.version)};

    /* ============ C. 技能市场 Client 模块（复刻，见文件顶层） ============ */
    var PU_SM = PU_skillMarketFactory(require);

    /* ============ E. 设置页（功能开关 + 背景颜色） ============ */
${indent(settings)}

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
      tag.textContent = tag.textContent + '\\n' + text;
      PU_CSS_SEEN[section] = true;
    }
    /* ============ S. 共享 store（内联 store.js） ============ */
${indent(storeSrc)}

    /* 三个模块各一份独立 store：它们的状态互不相干，共用实现但实例分离。 */
    var PU_store = PU_makeStore(React, { open: false, loading: false, data: null, error: null, signedOut: false, links: null, notice: '' });
    var PU_store2 = PU_makeStore(React, { open: false, btn: null, catalog: null, providerId: '', modelId: '', modelName: '', effortId: '', effortName: '', loading: false, error: '' });
    /* ============ P. 峰谷时段（内联 peak.js） ============ */
${indent(peakSrc)}
    var PU_PEAK = PU_peak();
    /* ============ B. 功能层：真实余额（内联 features.js） ============ */
${indent(features)}

    /* ============ B2. 电源菜单（内联 power.js，复刻 dsh-power-menu 机制） ============ */
${indent(power)}

    /* ============ B3. 模型触发块两行化（内联 model.js） ============ */
${indent(model)}

    /* ============ B4. 工作区一键运行命令（内联 actions.js） ============ */
${indent(actions)}

    /* ============ B5. 会话真正删除 + 右键菜单（内联 session.js） ============ */
${indent(session)}





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
`;

mkdirSync(resolve(here, 'dist'), { recursive: true });
const target = resolve(here, 'dist/client.js');
writeFileSync(target, out, 'utf8');

try {
  new vm.Script(out, { filename: 'dist/client.js' });
} catch (e) {
  console.error('产物语法自检失败：', e.message);
  process.exitCode = 1;
}
try {
  new vm.Script(`(function(require){${features}})`, { filename: 'features.js' });
} catch (e) {
  console.error('features.js 语法自检失败：', e.message);
  process.exitCode = 1;
}

// 源码级缺陷扫描：组件不得引用被遮蔽的 ctx 形参
if (/function install\(ctx\)/.test(features)) {
  console.error('features.js: install(ctx) 形参会遮蔽外层 ctx —— 必须用 install(c)');
  process.exitCode = 1;
}
if (/window\.__puq/.test(features)) {
  console.error('features.js: 不允许使用 window 全局传递 ctx');
  process.exitCode = 1;
}

/* （原 PLUGIN_VERSION 一致性守卫已随 Host 用量代理一同撤除：
   index.js 不再发出任何平台请求，也就没有需要与包版本同步的请求头。
   Client 半边的代际戳仍由 manifest.version 注入 PU_VERSION，单一来源。 */

console.log(`dist/client.js 写出：${out.length} bytes，令牌 ${names.length} 个`);
