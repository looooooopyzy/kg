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
npm run local
```

浏览器打开 <http://127.0.0.1:8787>。`npm run local` 会构建网站并同时启动本机题库服务；`npm run start` 只启动网站。源码修改后，重新构建或在开发阶段使用 `npm run dev`。
刷题入口在左侧导航的“本机题库 · 刷题”，也可以直接打开 <http://127.0.0.1:8787/#bank>。进入后可选知识点、换题、查看解析，并用草稿纸计算。
启动前请先用 `Ctrl+C` 停止已经运行的 `npm run start` 或 `npm run local`，否则 Windows 可能因构建目录被占用而报 `EPERM`，或因端口占用而无法启动。

## 本机个人题库

[ERRRC/kaogong-shuati](https://github.com/ERRRC/kaogong-shuati) 的题库数据，作者说明仅供个人学习备考，不允许商用或二次分发。下载脚本固定在其 `12cf8e73be8fd18f615782e7a5748b0ca7f39ce2` 提交，校验每个 Git 文件以及重组主库的 MD5：

```powershell
node scripts/fetch-personal-bank.mjs
npm run local
```

主库、索引库和申论材料库保存在 `D:\kaogong\.local-data\kaogong-shuati\`。该目录已被 Git 忽略；不要用 `git add -f` 把它加入仓库，也不要把数据库上传或部署到公共网站。

数量关系课程的“本机题库”卡片从数据库里筛选题干、四个选项和解析都能以文字完整显示的题目。当前主库有 95,627 条记录，符合这一显示条件的行测数量关系题去重后有 374 道；每课通过关键词进一步筛选。关键词只用于推荐练习，若某题实际考点不同，请以题目本身为准。带公式图片的题仍留在本地数据库中，暂不在卡片中展示。

题库服务仅绑定本机 `127.0.0.1:8788`，并只接受本地网站的浏览器来源。在线网站不会分发或读取这份个人题库。Android、iPad 若要使用这份数据库，需要另行实现安全的个人设备同步；现在的页面题库卡片仅在 Windows 本机运行时出现。

API Key 不需要写入 `.env`。在本地页面的“AI 答疑”中输入自己的 GLM 或 DeepSeek API Key。默认只在当前页面内存中使用；勾选“在此浏览器保存 API Key”后，会按服务商保存在当前浏览器的 `localStorage`，刷新后自动恢复。可随时点击“清除已保存的 Key”。本地存储不加密，公用设备不要开启；该设置不会随学习记录导出，也不会通过 Git 同步。

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
