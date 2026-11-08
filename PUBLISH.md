# 如何让插件被社区收录

## 当前状态

本地仓库已就绪（31 个文件，1 次提交），**只差推送到 GitHub**。

> 本机没有 GitHub 凭证，且 GitHub 直连被重置（Connection was reset）。
> 需要你提供 token 或开代理后才能推送。

## 路线 A：手动创建 + 推送（推荐）

1. 浏览器打开 https://github.com/new
2. 仓库名 `dsh-perfect-ui`，Public，**不勾选** README/.gitignore/License（本地已有）
3. 在本目录执行：

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"   # 如需要代理
git remote add origin https://github.com/<你的用户名>/dsh-perfect-ui.git
git push -u origin main
```

## 路线 B：一键脚本（自动建仓库 + 推送 + 打标签）

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
.\publish.ps1 -Repo "你的用户名/dsh-perfect-ui" -Token "ghp_你的token"
```

Token: https://github.com/settings/tokens → Generate new token (classic) → 勾选 `repo`

## 收录渠道

| 渠道 | 说明 |
|---|---|
| DSH 插件市场 | 设置 → 插件 → 市场，部分支持从 GitHub URL 安装 |
| awesome 清单 | 搜 `awesome deepseek harness`，提 PR 加一行 |
| 社区论坛 | r/LocalLLaMA、相关 QQ/微信群 |

## 仓库建议设置

- **名称**：`dsh-perfect-ui`
- **描述**：橘小黑工作台 — DeepSeek Harness 主题与增强插件
- **Topics**：`dsh` `deepseek-harness` `plugin` `theme`
- **License**：MIT（已含 LICENSE 文件）

## 已就绪的发布文件

```
.gitignore             排除 node_modules / dist / 缓存
LICENSE                MIT 许可
README.md              功能说明 + 安装 + 开发
package.json           含 keywords / repository / license / files
publish.ps1            一键发布脚本
.github/workflows/     CI 自动构建验证
PUBLISH.md             本文件
```