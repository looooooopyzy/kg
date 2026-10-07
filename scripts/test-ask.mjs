import assert from "node:assert/strict";
import { build } from "esbuild";
import { routeSkill } from "../public/tutor-skills.js";

const compiled = await build({ entryPoints: ["app/api/ask/route.ts"], bundle: true, platform: "node", format: "esm", write: false });
const url = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`;
const { POST } = await import(url);
const request = (body) => new Request("https://example.test/api/ask", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const base = { apiKey: "test-key-12345", model: "glm-5.3", mode: "quantity", lesson: "work", question: "工程问题为什么要赋总量？", history: [] };

assert.equal((await POST(request({ ...base, apiKey: "" }))).status, 400);
assert.equal((await POST(request({ ...base, apiKey: "test-key-中文" }))).status, 400);
assert.equal((await POST(request({ ...base, model: "other-model" }))).status, 400);
assert.equal((await POST(request({ ...base, image: "data:image/png;base64,aGVsbG8=" }))).status, 400);

const oldFetch = globalThis.fetch;
try {
  let captured;
  globalThis.fetch = async (upstream, options) => {
    captured = { upstream, options };
    return Response.json({ choices: [{ message: { content: "先看每天完成多少。" } }] });
  };
  const response = await POST(request(base));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: "先看每天完成多少。", skill: "quantity", model: "glm-5.3" });
  assert.equal(captured.upstream, "https://open.bigmodel.cn/api/paas/v4/chat/completions");
  assert.equal(captured.options.headers.Authorization, "Bearer test-key-12345");
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, "glm-5.3");
  assert.equal(payload.thinking.type, "enabled");
  assert.match(payload.messages[0].content, /合作效率相加/);
  assert.equal(payload.messages[0].content, routeSkill("quantity", base.question, "work").system);
  assert.equal(routeSkill("auto", "立方体展开图怎么判断？").routedMode, "spatial");

  const flash = await POST(request({ ...base, model: "glm-5.3-flash", mode: "spatial", lesson: "cube", image: "data:image/png;base64,aGVsbG8=" }));
  assert.equal(flash.status, 200);
  assert.equal((await flash.json()).skill, "spatial");
  const flashPayload = JSON.parse(captured.options.body);
  assert.equal(flashPayload.messages.at(-1).content[1].type, "image_url");
  assert.equal(flashPayload.thinking, undefined);

  const deepseek = await POST(request({ ...base, model: "deepseek-flash", mode: "quantity", image: undefined }));
  assert.equal(deepseek.status, 200);
  assert.equal((await deepseek.json()).model, "deepseek-flash");
  assert.equal(captured.upstream, "https://api.deepseek.com/chat/completions");
  const deepseekPayload = JSON.parse(captured.options.body);
  assert.equal(deepseekPayload.model, "deepseek-flash");
  assert.equal(deepseekPayload.thinking, undefined);

  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: [{ type: "text", text: "分段回复也能正常显示。" }] } }] });
  const arrayContent = await POST(request({ ...base, model: "deepseek-flash" }));
  assert.equal(arrayContent.status, 200);
  assert.equal((await arrayContent.json()).answer, "分段回复也能正常显示。");

  const deepseekProImage = await POST(request({ ...base, model: "deepseek-v4-pro", mode: "spatial", lesson: "cube", image: "data:image/png;base64,aGVsbG8=" }));
  assert.equal(deepseekProImage.status, 400);

  globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
  const invalidKey = await POST(request(base));
  assert.equal(invalidKey.status, 401);
  assert.doesNotMatch(JSON.stringify(await invalidKey.json()), /test-key|unauthorized/);
} finally {
  globalThis.fetch = oldFetch;
}
console.log("AI 答疑接口校验与模型转发测试通过。");
