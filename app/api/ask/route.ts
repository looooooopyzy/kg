import { routeSkill, type TutorMode } from "../../../lib/tutor-skills";

const UPSTREAM = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MAX_BODY = 5_800_000;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const NO_STORE = { "Cache-Control": "no-store" };

type HistoryMessage = { role: "user" | "assistant"; content: string };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY) return error("请求内容过大，请压缩图片后重试。", 413);
  let raw: string;
  try { raw = await request.text(); } catch { return error("无法读取请求。", 400); }
  if (raw.length > MAX_BODY) return error("请求内容过大，请压缩图片后重试。", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return error("请求格式不正确。", 400); }
  if (!body || typeof body !== "object") return error("请求格式不正确。", 400);

  const key = body.apiKey;
  const model = body.model;
  const question = body.question;
  const image = body.image;
  const mode = body.mode;
  const lesson = body.lesson;
  const history = body.history;
  if (typeof key !== "string" || key.length < 8 || key.length > 300 || /\s/.test(key)) return error("请输入有效的 API Key。", 400);
  if (model !== "glm-5.3" && model !== "glm-5.3-flash") return error("请选择支持的模型。", 400);
  if (typeof question !== "string" || question.trim().length < 2 || question.length > 4000) return error("问题需在 2 到 4000 字之间。", 400);
  if (mode !== "auto" && mode !== "quantity" && mode !== "spatial" && mode !== "review") return error("答疑模式无效。", 400);
  if (lesson !== undefined && (typeof lesson !== "string" || lesson.length > 30)) return error("课程参数无效。", 400);
  if (image !== undefined && (typeof image !== "string" || image.length > 5_600_000 || !IMAGE_PATTERN.test(image) || Math.floor((image.length - image.indexOf(",") - 1) * 3 / 4) > 4 * 1024 * 1024)) return error("图片需为不超过 4 MB 的 PNG、JPEG 或 WebP。", 400);
  if (image && model !== "glm-5.3-flash") return error("图片答疑请切换到 GLM-5.3-Flash。", 400);
  if (!Array.isArray(history) || history.length > 8 || history.some((m: HistoryMessage) => !m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || m.content.length > 3000)) return error("对话记录格式无效。", 400);

  const { system, routedMode } = routeSkill(mode as TutorMode, question, lesson as string | undefined, Boolean(image));
  const userContent = image ? [
    { type: "text", text: question.trim() },
    { type: "image_url", image_url: { url: image } },
  ] : question.trim();
  const payload = {
    model,
    messages: [{ role: "system", content: system }, ...history, { role: "user", content: userContent }],
    stream: false,
    max_tokens: 4096,
    ...(model === "glm-5.3" ? { thinking: { type: "enabled" }, reasoning_effort: "low" } : {}),
  };
  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    return error("模型连接超时或暂时不可用，请稍后重试。", 503);
  }
  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) return error("API Key 验证失败，或该 Key 无权使用所选模型。", 401);
    if (upstream.status === 429) return error("模型调用已达到限额或当前繁忙，请检查账户额度并稍后再试。", 429);
    return error(`模型服务返回错误（${upstream.status}）。请检查模型权限和账户额度。`, 502);
  }
  let data: { choices?: Array<{ message?: { content?: unknown } }> };
  try { data = await upstream.json(); } catch { return error("模型返回的数据无法解析。", 502); }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return error("模型没有返回正文，请重试或切换模型。", 502);
  return Response.json({ answer: content.trim(), skill: routedMode, model }, { headers: NO_STORE });
}
