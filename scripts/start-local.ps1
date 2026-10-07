$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "启动本地网站和个人学习题库: http://127.0.0.1:8787" -ForegroundColor Green
npm run local
