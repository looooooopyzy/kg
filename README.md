# 解题有形 · 行测理解实验室

面向零基础考公学习者的互动网站。重点是先理解数量关系，再通过可旋转的三维立方体理解空间图形推理，并在卡住时获得 AI 答疑。

## 功能

- **数量关系**：8 个递进知识点，包含白话解释、三步解题、动态数字实验台、原创例题与练习。图解会随滑块变化。
- **空间图推**：可拖动或用方向键旋转的 CSS 三维立方体、对应的展开图、相对面练习及图形规律识别提示。
- **错题复盘**：答错自动归档；记录第一眼特征、错因和下次的解题动作；支持 JSON 导出。
- **AI 答疑**：选择 GLM-5.3 或 GLM-5.3-Flash，在页面输入自己的智谱 API Key；可提问、追问、从课程带入当前知识点，或在 Flash 下上传题目图片。服务端按问题类型选择数量关系、图形推理或结构化复盘的教学规则。
- **AI 同类题**：在数量关系课程和立方体图推中选择模型与难度，按当前知识点生成原创选择题；作答后展示逐步解法、验算和易错点，也可先看提示或直接查看解法。
- **草稿纸**：页面右下角随时打开，支持 Apple Pencil、鼠标和触控笔；可切换画笔与橡皮、调整颜色和粗细、撤销、清空并导出 PNG。默认忽略手指触碰，可手动开启手指书写。
- **本地进度**：掌握状态、练习和复盘记录保存在浏览器的 `localStorage` 中，无需账户。

本项目所有练习题均为原创模拟题，并非官方真题。AI 讲解可能有误，需核对条件与计算。

## API Key 与数据

API Key 只放在当前页面内存和当次请求中，不写入源码、浏览器存储或学习记录。页面将 Key、问题和可选图片通过本站 `/api/ask` 发往服务端；服务端仅转发给固定的智谱官方接口 `https://open.bigmodel.cn/api/paas/v4/chat/completions`，不保存 Key，也不把上游错误正文返回浏览器。刷新或关闭页面后需重新输入。

生成同类题使用同一页面内存中的 Key，经 `/api/practice` 转发到同一固定接口。草稿笔迹单独保存在当前浏览器的 `localStorage` 中，不会随提问或出题请求发送给模型。可导出图片后手动清空。

使用者应自行确认所选模型的权限和额度。

## 运行

需要 Node.js 22.13 或以上版本：

```powershell
npm ci
npm run build
npm run start
```

默认打开 <http://127.0.0.1:8787/>。开发时也可以运行 `npm run dev`。接口模拟测试：`node scripts/test-ask.mjs` 和 `node scripts/test-practice.mjs`。

## 内容参考

内容结构、方法分类和复盘字段参考以下开源 skill；讲解、图解和题目针对网页重新编写。答疑接口在服务端根据问题类型注入整理后的对应教学规则，并不运行第三方仓库脚本。

- [kaogong-skill](https://github.com/KeWang0622/kaogong-skill)：行测题型框架与内容准确性原则。
- [huasheng13-skill](https://github.com/WangJunqing-coder/huasheng13-skill)：数量关系方法及图推分类。
- [kaogong-review-skill](https://github.com/zheng489/kaogong-review-skill)：错因归类与结构化复盘流程。

动态图解采用原生 HTML/CSS/JavaScript 绘制。检索过现成教学图片与立方体示例后，选择自绘图解，以便让用户调整数字并看到即时变化。

模型接口与名称见[智谱官方 GLM-5.3 文档](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3)和[GLM-5.3-Flash 文档](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash)。
