# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## v2.68.60 — 2026-11-20

### 变更

- **Git / GitHub 安装也能一键更新** —— 之前只有 registry 安装给「更新」按钮，Git 安装只提示「需重新安装」。
  现在 Host 会自己现算目标：`git ls-remote` 取最新正式 tag，并取该 tag 指向的**完整 40 位 commit**，
  拼成 `github:owner/repo#<sha>` 交给宿主 `updateBundle(name, version, { spec })`。
  - 为什么必须钉 commit：宿主 `planGitUpdate` 原文「updates only to a Git spec pinned to a full commit」，
    且要求 spec 的 origin 与已装来源同一仓库；只给 tag 名会被拒（`invalid-spec`）。
  - 全程**不需要任何 token**：检测与更新都只匿名读公共仓库的 tag 列表，更新的拉取由 pnpm 自己完成。
  - 客户端仍然只发 `{ name }`，spec 一律由 Host 算，避免前端伪造更新来源。
- **`/self` 增加 `latestSha` 与 `updateSpec`** —— `updateSpec` 只在「Git 安装 + 确有新版本」时非空；
  link 安装仍如实说明「git pull 后重新构建」，不假装能一键升级。
- **面板文案** —— Git 安装的可更新提示从「需重新安装该插件」改为「钉 tag commit 原地更新」，
  两处入口（设置 → 工作台、技能市场顶栏）口径一致。

---

## v2.68.59 — 2026-11-20

### 变更

- **「检测更新」改为检测本插件自身** —— 检测对象是 `@local/dsh-perfect-ui`（橘小黑工作台）自己，
  不再是推荐列表里的三方插件。设置 → 工作台 → 插件 与 技能市场顶栏两处入口口径一致。
  - 已装版本：读本插件目录的 `package.json`（正在跑的那一份源码）
  - 最新版本：读仓库 tag（`git ls-remote --tags`，不依赖 GitHub API 限流；结果缓存 30 分钟，`?force=1` 绕过）
  - registry / Git 安装：面板给「更新」按钮（复用宿主 `updateBundle`，目标版本由 Host 自算）
  - 本地 `link:` 安装：如实说明「远端最新 vX，git pull 后重新构建即可」，不假装能一键升级
  - 技能市场：有新版时顶栏按钮变强调色 + 圆点角标，下方出现一条「橘小黑工作台有新版本 vX · 查看」提示条
- **Host 新增 `GET /api/dsh-perfect-ui-plugins/self`** —— 返回
  `{ name, installed, latest, canUpdate, updateMode, repoUrl, checkedAt, error }`；
  `updateMode` 取 `registry` / `git` / `link` / `pinned`，决定客户端给不给「更新」按钮

### 修复

- **package.json 的 repository / homepage / bugs 还是占位符 `<你的用户名>`** —— 已填成真实仓库地址。
  这会让自检去访问一个不存在的仓库（返回 400），检测永远失败却看不出原因。

## v2.68.58 — 2026-11-20

### 新增

- **「检测全部插件更新」，打开即自动检测** — 两个入口，同一套判定
  - 设置 → 橘小黑工作台 → 插件：进入设置页就自动检测，面板直接给出结果，无需点按钮
  - 技能市场面板：打开时自动检测，有新版本时在顶栏下方显示一条提示条（「N 个插件有新版本 · 查看」），
    顶栏「检测更新」按钮同时带数量角标；点开才是列表，不弹窗打断浏览
  - 5 分钟内重复打开复用上次结果，不重复联网（Git 远端查询要跑 `git ls-remote`）
  - **registry 安装的插件**：按 DSH 官方 `updateCandidate()` 口径计算可更新版本
    （在架 / 声明 `dsh.bundle` / 与当前 DSH 兼容 / 未废弃 / 非预发布），可一键「更新」
  - **GitHub / Git 安装的插件**：官方不检测新提交（`listVersions` 对 Git 安装直接
    `refused`，而 `updateBundle` 又要求目标版本严格大于当前版本），因此改为比对
    远端 `HEAD` 与钉住的 commit，有新提交时如实提示「需重新安装该插件」，不代劳更新
- **Host 新增 `GET /api/dsh-perfect-ui-plugins/updates`** — 一次遍历全部已安装插件，
  Git 远端查询结果缓存 5 分钟；`/update` 的目标版本由 Host 按同一口径自算，不采信前端传值

### 修复

- **「已是最新」被误报为可更新** — 候选版本现在必须严格高于已安装版本
  （之前取版本列表第一个，当最新版本恰好等于已装版本时仍会给出「更新」按钮）

## v2.68.56 — 2026-11-20

### 修复

- **推荐插件的「可更新版本」与 DSH 官方口径不一致** — 之前直接取版本列表的第一个，
  会把「与当前 DSH 不兼容」的新版本报成可更新，而 DSH 自己认为没有更新
  - 判定规则改为与宿主客户端 `updateCandidate()` 逐条对齐：
    `listVersions` 必须 `listed`，且版本要声明 `dsh.bundle`、与运行中的 DSH 兼容、
    未标记废弃、不是预发布，才可能成为更新目标
  - 无法安装的新版本会在卡片上如实说明原因（例如「v0.2.117 需要更新 DSH」），
    与宿主插件详情页的「新版本需要更新 DSH」一致
- **「更新」按钮点了版本不变** — 之前走的是 `installBundle`，宿主对已装包会在 pnpm
  跑之前就回 `already-installed`，所以永远装不上新版本
  - 改走宿主官方更新入口 `updateBundle(name, version)`，目标版本由 Host 按上面的
    规则自己算，不采信前端传值
  - 更新成功会回报 `v旧 → v新`，并提示重启 DSH

## v2.68.55 — 2026-11-10

### 新增

- **隐藏侧栏「更多」开关** — 设置 → 橘小黑工作台 → 插件开关
  - 收起侧栏面板列表末尾的「更多」按钮（那个带九宫格图标的入口）
  - 默认**关闭**，不影响现有界面
  - 三层 CSS 兜底：`moreAnchor` 子串匹配 / `aria-haspopup` 语义匹配 / `aria-label` 匹配
  - 状态挂在 `<html data-pus-hide-more>` 上，宿主重渲染侧栏也不会失效
  - 首屏同步放在 `install()` 注入样式之前，避免按钮闪一下再消失

### 修复

- **模型选择器滑块端点溢出** — 滑到最左/最右时蓝色不再越出轨道圆角
  - 轨道与填充改用 SVG 绘制，共用同一 `clipPath`，端点圆角结构上一致
  - 填充宽度改为 CSS 属性以恢复过渡动画（SVG 属性不参与 `transition`）
- **「选择推理强度」文字重影** — 改为「先清空再插入」，并加 `~` 兄弟选择器兜底
- **推理强度识别失败** — 白名单补齐 `Light` / `Reasoning` / `深度` 等，并加特征兜底判据
- **模型列表弹出前闪出根菜单** — drill 期间用 `body.pum-drilling` 临时隐藏
- **模型列表居中跳动一帧** — 校正改到 `queueMicrotask`，在浏览器绘制前完成

### 性能

- **对齐逻辑加短路闸门** — 宿主列表没打开时不做任何 `getBoundingClientRect` / `textContent` 读取
  - 原来这些调用会被 `MutationObserver` 在流式输出期间高频触发，造成主线程卡顿
- **已校正节点改用 WeakSet** — 节点移除自动回收，无手动防泄漏逻辑

### 文档

- 重写插件描述，改为用户视角（原来的描述写实现细节和调用栈）
- 新增本 CHANGELOG

---

## 更早版本

v2.68.53 及之前为迭代开发阶段，未逐版记录。主要内容：

- 主题配色系统（50 组深浅色令牌）
- 账户余额卡片
- 工作区一键运行 Action
- 会话右键快速删除
- 技能市场
- 模型选择器两行样式 + 推理强度滑块
- 设置页（功能开关 + 背景颜色自定义）
