# 解题有形 · 行测理解实验室

一个面向零基础考公学习者的静态互动网站。重点是先理解数量关系，再通过可旋转的三维立方体理解空间图形推理。

## 功能

- **数量关系**：8 个递进知识点，包含白话解释、三步解题、动态数字实验台、原创例题与练习。图解会随滑块变化。
- **空间图推**：可拖动或用方向键旋转的 CSS 三维立方体、对应的展开图、相对面练习及图形规律识别提示。
- **错题复盘**：答错自动归档；记录第一眼特征、错因和下次的解题动作；支持 JSON 导出。
- **本地进度**：掌握状态、练习和复盘记录保存在浏览器的 `localStorage` 中，无需账户。

本项目所有练习题均为原创模拟题，并非官方真题。页面不提供实时 AI 对话或在线题库接口。

## 运行

项目是无构建步骤的静态网页，打开 `dist/index.html` 即可；也可从项目根目录运行：

```powershell
python -m http.server 4173 --directory dist
```

然后打开 <http://localhost:4173/>。

## 内容参考

内容结构、方法分类和复盘字段参考以下开源 skill；讲解、图解和题目针对网页重新编写。

- [kaogong-skill](https://github.com/KeWang0622/kaogong-skill)：行测题型框架与内容准确性原则。
- [huasheng13-skill](https://github.com/WangJunqing-coder/huasheng13-skill)：数量关系方法及图推分类。
- [kaogong-review-skill](https://github.com/zheng489/kaogong-review-skill)：错因归类与结构化复盘流程。

动态图解采用原生 HTML/CSS/JavaScript 绘制。检索过现成教学图片与立方体示例后，选择自绘图解，以便让用户调整数字并看到即时变化。
