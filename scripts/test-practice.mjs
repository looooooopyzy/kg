import assert from "node:assert/strict";
import { build } from "esbuild";

const compiled = await build({ entryPoints: ["app/api/practice/route.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const request = body => new Request("https://example.test/api/practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const base = { apiKey: "test-key-12345", model: "glm-5.3-flash", topic: "work", level: "basic" };

assert.equal((await POST(request({ ...base, apiKey: "" }))).status, 400);
assert.equal((await POST(request({ ...base, topic: "not-a-lesson" }))).status, 400);
assert.equal((await POST(request({ ...base, model: "unknown" }))).status, 400);

const exercise = {
  stem: "甲单独完成一项任务要 6 天，乙单独完成要 3 天。两人合作要多少天？",
  options: ["1 天", "2 天", "3 天", "9 天"], correctIndex: 1, finalAnswer: "2 天",
  hint: "把工作总量设为 6 份。",
  steps: ["设总任务为 6 份。", "甲每天完成 1 份，乙每天完成 2 份。", "合作每天完成 3 份，所以需要 6÷3=2 天。"],
  check: "合作 2 天共完成 6 份。", pitfall: "合作效率相加，完成天数不能直接相加。",
};

const oldFetch = globalThis.fetch;
try {
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return Response.json({ choices: [{ message: { content: JSON.stringify(exercise) } }] });
  };
  const response = await POST(request(base));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.exercise.topic, "work");
  assert.equal(data.exercise.correctIndex, 1);
  assert.equal(data.exercise.steps.length, 3);
  assert.equal(captured.url, "https://open.bigmodel.cn/api/paas/v4/chat/completions");
  assert.equal(captured.options.headers.Authorization, "Bearer test-key-12345");
  assert.match(JSON.parse(captured.options.body).messages[1].content, /合作效率相加/);

  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ ...exercise, finalAnswer: "9 天" }) } }] });
  assert.equal((await POST(request(base))).status, 502);

  globalThis.fetch = async () => new Response("test-key-12345", { status: 401 });
  const unauthorized = await POST(request(base));
  assert.equal(unauthorized.status, 401);
  assert.doesNotMatch(JSON.stringify(await unauthorized.json()), /test-key-12345/);
} finally {
  globalThis.fetch = oldFetch;
}
console.log("同知识点出题接口校验与模型转发测试通过。");
