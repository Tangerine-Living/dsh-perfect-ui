/**
 * theme-tokens.js — 薄荷绿设计系统的语义令牌覆盖表（单一事实来源）
 * ---------------------------------------------------------------------------
 * 走 DSH 官方的第三方主题扩展点：ctx.theme.overrideTokens(source, tokens)。
 *
 * 形状约束（宿主 ThemeRuntime.validateOverrides 在运行时强制）：
 *   每个令牌必须是 { light: string, dark: string }；裸字符串会抛 teaching error，
 *   因为单一值在用户切换深浅色后会不可读。
 *
 * 生效路径：
 *   覆盖层 → ThemeRuntime.composeActive 折进 snapshot.active.tokens
 *   → ui-layout 的 ThemePresenter.apply() 逐条写成 body 的**内联** CSS 变量
 *   → 内联优先级高于 design-platform.css 的 body 规则 → 真实界面整体换肤。
 *
 * 令牌名来源（全部可在宿主 ui-theme 的样式表/README 中引用到，未发明名字）：
 *   design-platform.css  --dsw-alias-bg-*, border-l1..l4, label-*, state-*,
 *                         interactive-bg-hover, bg-module-platform, scrollbar-*,
 *                         toast-bg/label, menu-icon, switch-thumb, tooltip-key-bg,
 *                         label-shimmer, label-deep-diving(-shimmer),
 *                         bg-document-selection/preview, label-document-preview,
 *                         settings-card-fill/stroke, menu-group-header-fill
 *   base.css             --dsw-specific-sidebar-fill, --dsw-radius-*
 *   scrollbar.css        --dsh-scrollbar-thumb/hover, --dsh-scrollbar-width
 *   focus.css            --dsw-alias-state-business-primary
 *   onboarding.css       --dsw-alias-onboarding-*
 *   shiki.css            --dsw-alias-markdown-code-block
 *   gradient-shadow-text.css  --dsw-elevation-stroke-color
 *   AppearanceRow/菜单   --dsw-menu-surface-fill
 *
 * 刻意保持半透明的令牌（Web styling 规则要求保留其透明度语义）：
 *   --dsw-menu-surface-fill          菜单靠 backdrop-filter 模糊，改成不透明会失效
 *   --dsw-alias-menu-group-header-fill  宿主定义为 94% 不透明
 *   --dsw-alias-bg-document-selection   宿主定义为 40% 透明度（叠在文档原色上）
 *   --dsw-alias-label-shimmer         宿主定义为带 alpha 的遮罩色
 *   --dsw-alias-onboarding-card-fill  宿主定义为 80% 不透明
 */
export const TOKENS = {
  /* 背景：纯白外壳 × 纯白内容（bg-base 浅色默认值已按用户要求改为 #ffffff）
     ⚠ bg-base / bg-layer-1 / bg-overlay 现在都是纯白，三者边界完全依赖
       宿主的 border / border-l1~l3 与阴影来区分。若想让卡片更有层次，
       可把 layer-2 (#f4faf7) 加深，或调整 border 令牌。 */
  '--dsw-alias-bg-base': { light: '#ffffff', dark: '#0f1519' },
  '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#161d24' },
  '--dsw-alias-bg-layer-2': { light: '#f4faf7', dark: '#1b242c' },
  '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#1a232b' },
  '--dsw-alias-bg-module-platform': { light: '#d9f0e7', dark: '#123026' },
  '--dsw-alias-bg-document-selection': {
    light: 'rgba(32,154,114,.4)',
    dark: 'rgba(47,191,143,.4)',
  },
  '--dsw-alias-bg-document-preview': { light: '#d5e9e3', dark: '#131a20' },

  /* ---------- 边框：极细浅绿灰 ---------- */
  '--dsw-alias-border-l1': { light: '#dcebe6', dark: '#22303a' },
  '--dsw-alias-border-l2': { light: '#c5dcd5', dark: '#2b3b47' },
  '--dsw-alias-border-l3': { light: '#b8d4cb', dark: '#354856' },
  '--dsw-alias-border-l4': { light: '#a9cdc2', dark: '#3f5464' },

  /* ---------- 文本 ---------- */
  '--dsw-alias-label-primary': { light: '#1f2329', dark: '#e8eef2' },
  '--dsw-alias-label-secondary': { light: '#5c6b68', dark: '#9dabb4' },
  '--dsw-alias-label-document-preview': { light: '#41524e', dark: '#8fa0a8' },
  '--dsw-alias-label-shimmer': {
    light: 'rgba(31,35,41,.3)',
    dark: 'rgba(255,255,255,.45)',
  },
  '--dsw-alias-label-deep-diving': { light: '#2f5fd0', dark: '#7aaaff' },
  '--dsw-alias-label-deep-diving-shimmer': { light: '#93c5fd', dark: '#b7c8fe' },

  /* ---------- 强调：操作绿 ---------- */
  '--dsw-alias-brand-primary': { light: '#209a72', dark: '#2fbf8f' },
  '--dsw-alias-state-business-primary': { light: '#209a72', dark: '#2fbf8f' },
  '--dsw-alias-state-success-primary': { light: '#209a72', dark: '#3ecf9a' },
  '--dsw-alias-state-warn-primary': { light: '#c9760a', dark: '#e0a34a' },
  '--dsw-alias-state-error-primary': { light: '#d94a4a', dark: '#ff6b6b' },
  '--dsw-alias-state-idle-primary': { light: '#93a2ac', dark: '#6f8090' },

  /* ---------- 交互态：侧栏悬停 / 选中 ---------- */
  '--dsw-alias-interactive-bg-hover': { light: '#d1e5df', dark: '#1d2a33' },

  /* ---------- 侧栏：整列与标题行底色 ---------- */
  '--dsw-specific-sidebar-fill': { light: '#e2f0ec', dark: '#0f1519' },

  /* ---------- 浮层 / 菜单 / Toast ---------- */
  '--dsw-menu-surface-fill': {
    light: 'rgba(255,255,255,.86)',
    dark: 'rgba(26,35,43,.86)',
  },
  '--dsw-alias-menu-group-header-fill': {
    light: 'rgba(244,250,247,.94)',
    dark: 'rgba(27,36,44,.94)',
  },
  '--dsw-alias-menu-icon': { light: '#3c4b47', dark: '#adb2b8' },
  '--dsw-alias-toast-bg': { light: '#ffffff', dark: '#1a232b' },
  '--dsw-alias-toast-label': { light: '#1f2329', dark: '#e8eef2' },
  '--dsw-alias-switch-thumb': { light: '#ffffff', dark: '#cfd3d6' },
  /* Tooltip 键帽（用户截图：提示框内键帽与底色几乎同色，白字糊成一片）。
     宿主 tooltip 的真实 CSS（app.asar 确证两处）：
       @102372743  提示框: background var(--dsw-alias-tooltip-bg)
                          color    var(--dsw-static-neutral-bluish-00)  ← 纯白
       @102351361  键帽:   ._key_ { background var(--dsw-alias-tooltip-key-bg) }
                          该规则**没有设 color** → 继承提示框的白字
     因此键帽上必然是白字，只能让键帽底色足够深来保证可读性。

     我把对比度实算过（WCAG 相对亮度公式）：
       键帽 #2f3d47 上的白字 = 11.4:1        ✓ 远超 AA 的 4.5
       键帽与提示框底 #0f171d 的色差          用边框补足（见下方说明）
     之前的值 #f4faf7（浅色模式）是重大错误：白字压在白底上，
     对比度只有 1.1:1，等于完全看不见 —— 这就是截图里的现象。

     键帽与背景的“填充色差”刻意不做大：白字可读性必须优先，
     且宿主的键帽规则没留边框插槽，所以视觉区分交给
     --dsw-alias-tooltip-bg 整体偏深（提示框本身即深底白字）来完成。 */
  '--dsw-alias-tooltip-bg': { light: '#1f2b33', dark: '#1f2b33' },
  '--dsw-alias-tooltip-key-bg': { light: '#3a4a55', dark: '#3a4a55' },

  /* ---------- 内容层：代码块 / 设置卡片 ---------- */
  '--dsw-alias-markdown-code-block': { light: '#f7fbf9', dark: '#131a20' },
  '--dsw-alias-settings-card-fill': { light: '#f4faf7', dark: '#1b242c' },
  '--dsw-alias-settings-card-stroke': { light: '#dcebe6', dark: '#2b3b47' },

  /* ---------- 滚动条 ---------- */
  '--dsw-alias-scrollbar-bg-l1': { light: '#c5dcd5', dark: '#2b3b47' },
  '--dsw-alias-scrollbar-hover-l1': { light: '#a9cdc2', dark: '#3f5464' },
  '--dsh-scrollbar-width': { light: '7px', dark: '7px' },

  /* ---------- 新手引导 ---------- */
  '--dsw-alias-onboarding-accent': { light: '#209a72', dark: '#2fbf8f' },
  '--dsw-alias-onboarding-card-fill': {
    light: 'rgba(255,255,255,.8)',
    dark: 'rgba(22,29,36,.8)',
  },
  '--dsw-alias-onboarding-secondary-fill': { light: '#ffffff', dark: '#243039' },
  '--dsw-alias-onboarding-checkbox-border': {
    light: 'rgba(31,35,41,.2)',
    dark: '#2b3b47',
  },

  /* ---------- 投影描边：hairline 也染成浅绿灰 ---------- */
  '--dsw-elevation-stroke-color': { light: '#c5dcd5', dark: '#2b3b47' },

  /* ---------- 圆角尺度：整体收到 Cursor 一档（结构层改变） ---------- */
  '--dsw-radius-xs': { light: '4px', dark: '4px' },
  '--dsw-radius-sm': { light: '8px', dark: '8px' },
  '--dsw-radius-md': { light: '12px', dark: '12px' },
  '--dsw-radius-lg': { light: '14px', dark: '14px' },
  '--dsw-radius-xl': { light: '16px', dark: '16px' },
  '--dsw-radius-panel': { light: '20px', dark: '20px' },
};
