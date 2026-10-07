import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// rich.js 是无 DOM 依赖的经典脚本，通过 globalThis 取回导出的两个渲染函数。
const src = readFileSync(new URL("../public/rich.js", import.meta.url), "utf8");
const { renderRich, renderInline } = new Function(
  `${src}; return { renderRich: globalThis.renderRich, renderInline: globalThis.renderInline };`,
)();

// Markdown 子集
assert.ok(renderRich("**第一步**：设总量为 120。\n- 甲效率 20\n- 乙效率 30").includes("<b>第一步</b>"));
assert.ok(renderRich("**第一步**：设总量为 120。\n- 甲效率 20\n- 乙效率 30").includes("<ul>"));
assert.ok(renderRich("步骤：\n1. 找对象\n2. 找关系").includes("<ol>"));
assert.ok(renderRich("步骤：\n1、找对象\n2、找关系").includes("<ol>"));
assert.ok(renderRich("3.5 亿元的增长").includes("<p>3.5 亿元的增长</p>"), "小数不应被当作列表");
assert.ok(renderRich("## 解题思路\n正文").includes("<h4>"));
const table = renderRich("| 量 | 值 |\n| --- | --- |\n| 甲 | 6 天 |");
assert.ok(table.includes("<table>") && table.includes("<th>") && table.includes("6 天"));
assert.ok(renderRich("> 提醒：先统一单位").includes("<blockquote>"));

// LaTeX 数学
const inlineMath = renderRich("设 \\(x\\) 为原价，则 \\(1.2x = 120\\)。");
assert.ok(inlineMath.includes("math-inline"));
assert.ok(!inlineMath.includes("\\("));
assert.ok(renderRich("\\[\\frac{6}{4} = \\frac{3}{2}\\]").includes("mfrac"));
assert.ok(renderRich("\\[v = \\dfrac{s}{t}\\]").includes("math-block"));
assert.ok(renderRich("\\(2^{10}\\)").includes("<sup>10</sup>"));
assert.ok(renderRich("\\(a_1 + a_2\\)").includes("<sub>1</sub>"));
assert.ok(renderRich("\\(30 \\times 40\\%\\)").includes("×"));
assert.ok(renderRich("\\(6 \\div 3 \\ne 1\\)").includes("÷"));
assert.ok(renderRich("\\(\\sqrt{2}\\)").includes("msqrt"));
assert.ok(renderRich("\\(\\frac{1}{\\frac{1}{2}}\\)").split("mfrac").length === 3, "嵌套分数");
assert.ok(renderInline("速度和为 \\(60+40=100\\) km/h").includes("math-inline"));

// 安全：模型文本先转义，不能注入 HTML
const xss = renderRich("<script>alert(1)</script> **加粗**");
assert.ok(!xss.includes("<script"));
assert.ok(xss.includes("&lt;script"));
assert.ok(xss.includes("<b>加粗</b>"));

// 占位符必须全部还原
for (const out of [renderRich("\\(a\\) 和 \\(b\\) 与 \\[c\\] 与 `code`"), renderInline("$x$ 加 $y$")]) {
  assert.ok(!out.includes("\u0001"));
}

console.log("test-rich: all assertions passed");
