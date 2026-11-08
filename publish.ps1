# 橘小黑工作台 · 一键发布到 GitHub
# 用法：.\publish.ps1 -Repo "你的用户名/dsh-perfect-ui" -Token "ghp_xxx"
# Token: https://github.com/settings/tokens (需要 repo 权限)

param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [Parameter(Mandatory=$true)][string]$Token,
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Write-Host "==> 1. 检查网络" -ForegroundColor Cyan
try {
  git ls-remote "https://github.com/$Repo.git" 2>$null | Out-Null
  Write-Host "    GitHub 可达" -ForegroundColor Green
} catch {
  Write-Host "    [!] 无法连接 GitHub，请先开代理" -ForegroundColor Yellow
  Write-Host "        例: $env:HTTPS_PROXY='http://127.0.0.1:7890'" -ForegroundColor Yellow
  exit 1
}

Write-Host "==> 2. 创建远程仓库（若不存在）" -ForegroundColor Cyan
try {
  $headers = @{ Authorization = "Bearer $Token"; Accept = "application/vnd.github+json" }
  $name = ($Repo -split "/")[1]
  $body = @{ name = $name; description = "橘小黑工作台 — DeepSeek Harness 主题与增强插件"; private = $false } | ConvertTo-Json
  Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json" | Out-Null
  Write-Host "    仓库已创建" -ForegroundColor Green
} catch {
  Write-Host "    仓库可能已存在，继续" -ForegroundColor Yellow
}

Write-Host "==> 3. 推送代码" -ForegroundColor Cyan
$remote = "https://x-access-token:$Token@github.com/$Repo.git"
git remote remove origin 2>$null
git remote add origin $remote
git push -u origin $Branch
git remote set-url origin "https://github.com/$Repo.git"

Write-Host "==> 4. 打版本标签" -ForegroundColor Cyan
$ver = node -p "require('./package.json').version"
git tag -a "v$ver" -m "Release v$ver" 2>$null
git push origin "v$ver"

Write-Host ""
Write-Host "完成！" -ForegroundColor Green
Write-Host "  仓库: https://github.com/$Repo" -ForegroundColor Cyan
Write-Host "  版本: https://github.com/$Repo/releases" -ForegroundColor Cyan