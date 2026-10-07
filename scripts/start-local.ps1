$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "[1/2] 构建本地版本..." -ForegroundColor Cyan
npm run build

Write-Host "[2/2] 启动本地服务: http://127.0.0.1:8787" -ForegroundColor Green
npm run start
