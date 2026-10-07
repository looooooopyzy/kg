# 本地运行与协作说明

## 本地运行

要求 Node.js `22.13+`。

首次安装依赖：

```powershell
cd D:\\kaogong
npm ci
```

开发检查和生产构建：

```powershell
npm run check
npm run build
```

启动本地版本：

```powershell
npm run start
```

浏览器打开 <http://127.0.0.1:8787>。源码修改后，如果使用 `npm run start`，重新执行 `npm run build`；开发阶段也可以尝试 `npm run dev`。

API Key 不需要写入 `.env`。在本地页面的“AI 答疑”中输入自己的 GLM 或 DeepSeek API Key；Key 只在当前页面内存中使用。

Windows 也可以执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\start-local.ps1
```

## 和 ZCode 协作

推荐让两个开发工具共用 `D:\\kaogong` 这个项目目录，但不要同时编辑同一个文件。

在 ZCode 中打开项目后，先阅读本文件。它修改并保存后，我可以立即看到文件变化；我修改的内容也会出现在 ZCode 中。开始另一项工作前，先检查：

```powershell
git status
git diff
```

更稳妥的方式是让 ZCode 为每项工作建立自己的分支：

```powershell
cd D:\\kaogong
git switch main
git pull --ff-only
git switch -c zcode/<任务名>
```

完成后运行 `npm run check` 和 `npm run build`，再提交：

```powershell
git add .
git commit -m "完成 <任务名>"
```

把提交 SHA、改动摘要和测试结果告诉我。我会检查、修复冲突，再合并到 `main` 并决定是否发布到线上。

不要在有未提交改动时执行 `git reset --hard`、切换分支或覆盖文件，避免丢失另一方的工作。

## 进度同步

- 同一台电脑：文件系统实时共享，Git 提交记录负责记录进度。
- 不同电脑：配置你自己的 GitHub/Git 远程仓库，通过 `git push` / `git pull` 同步；不要把 API Key 提交到仓库。
- 每项任务保留一个提交，提交信息写清功能和测试结果，方便我或 ZCode 接着工作。

