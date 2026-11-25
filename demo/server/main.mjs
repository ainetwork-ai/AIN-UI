/**
 * AIN-UI playground server: the built web app, the catalog, the agent run (server-sent AG-UI events), Express
 * compilation, skill files, evaluation results and recorded runs.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { AINUI_CATALOG_DOCUMENT } from "ain-ui";
import { catalogsFor, createUiAuthor, exportSkills, toExpress, UiError } from "ain-ui/agent";
import { AINUI_MACROS } from "ain-ui/macros";
import { runTurn } from "./agent.mjs";
import { createBudget } from "./limits.mjs";
import { zip } from "./zip.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const WEB = resolve(here, "../dist");
const RECORDINGS = resolve(here, "../recordings");
const EVALS = resolve(here, "../evals/results.json");
const VERSION = JSON.parse(readFileSync(resolve(here, "../package.json"), "utf8")).version;

const env = process.env;
const PORT = Number(env.PORT ?? 3000);
/** The first is the default. Qwen answers in about ten seconds; GLM writes richer surfaces but takes several times longer. */
const MODELS = (env.AINUI_MODELS ?? "Qwen3.8-Flash-Next,GLM-5.3-Flash").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_CALLS = Number(env.AINUI_MAX_MODEL_CALLS ?? 4);
const MAX_COMPONENTS = Number(env.AINUI_MAX_COMPONENTS ?? 1000);
const budget = createBudget({ perHour: Number(env.AINUI_RUNS_PER_HOUR ?? 30), perDay: Number(env.AINUI_RUNS_PER_DAY ?? 120) });
/** The whole service's ceiling, whoever is asking — the key is one account. */
const total = createBudget({ perHour: Number(env.AINUI_TOTAL_RUNS_PER_HOUR ?? 600), perDay: Number(env.AINUI_TOTAL_RUNS_PER_DAY ?? 4000) });

// Inside an ainize project the node hands the service its model gateway; the project's own key signs the calls.
const baseURL = env.AINUI_MODEL_BASE_URL ?? (env.AINIZE_URL ? `${env.AINIZE_URL.replace(/\/+$/, "")}/v1` : "https://ainize.ai/v1");
// The playground's own key (a project secret). `AINIZE_API_KEY` is the node's to set and may be empty or someone else's.
const apiKey = env.AINUI_AINIZE_KEY || env.AINIZE_API_KEY;
const client = apiKey ? new OpenAI({ apiKey, baseURL, timeout: 90_000, maxRetries: 1 }) : null;
const chat = (body) => client.chat.completions.create(body);

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".map": "application/json", ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8" };
const SECURITY = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };

const send = (res, status, body, headers = {}) => {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": data.length, ...SECURITY, ...headers });
  res.end(data);
};
const fail = (res, status, code, message, headers) => send(res, status, { error: { code, message } }, headers);

async function readJson(req, limit = 512 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error("request body too large"), { status: 413 }); chunks.push(chunk); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("request body is not JSON"), { status: 400 }); }
}

const caller = (req) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();

function serveStatic(req, res, pathname) {
  const wanted = normalize(join(WEB, decodeURIComponent(pathname)));
  const inside = wanted.startsWith(WEB);
  const file = inside && existsSync(wanted) && statSync(wanted).isFile() ? wanted : join(WEB, "index.html");
  if (!existsSync(file)) return fail(res, 404, "not_built", "the web app is not built (run `npm run build` in demo/)");
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  const immutable = file.includes(`${join(WEB, "assets")}`);
  // The page may be embedded (?embed=1) — framing is allowed; everything else is locked to this origin.
  const csp = "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self' data: blob:; font-src 'self' data:; base-uri 'self'; form-action 'self'";
  send(res, 200, readFileSync(file), { "content-type": type, "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache", ...(type.startsWith("text/html") ? { "content-security-policy": csp } : {}) });
}

function recordings() {
  if (!existsSync(RECORDINGS)) return [];
  return readdirSync(RECORDINGS).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const r = JSON.parse(readFileSync(join(RECORDINGS, f), "utf8"));
    return { id: f.replace(/\.json$/, ""), title: r.title, prompt: r.prompt, model: r.model, format: r.format, recordedAt: r.recordedAt, events: r.events };
  });
}

async function run(req, res) {
  if (!client) return fail(res, 503, "model_not_configured", "This playground has no model key. The recorded runs under /watch still play.");
  const body = await readJson(req);
  const history = Array.isArray(body.messages) ? body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12_000) })) : [];
  const action = body.action && typeof body.action.name === "string" ? { name: body.action.name.slice(0, 120), surfaceId: typeof body.action.surfaceId === "string" ? body.action.surfaceId.slice(0, 120) : undefined, context: body.action.context } : undefined;
  if (!action && history.at(-1)?.role !== "user") return fail(res, 400, "invalid_request", "messages must end with the user's message");
  const model = MODELS.includes(body.model) ? body.model : MODELS[0];
  const format = body.format === "json" ? "json" : "express";
  // The browser says what it can draw; a catalog it sends inline is the one written for.
  const offered = catalogsFor(body.capabilities);
  const catalogs = offered.length ? offered : undefined;

  const who = caller(req);
  const mine = budget.take(who), all = mine.ok ? total.take("all") : mine;
  const refused = !mine.ok ? mine : !all.ok ? all : null;
  if (refused) return fail(res, 429, "run_budget", `The playground's ${refused.window === "hour" ? "hourly" : "daily"} run budget is used up. Try again in ${Math.ceil(refused.retryAfterSeconds / 60)} min.`, { "retry-after": String(refused.retryAfterSeconds) });

  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no", ...SECURITY });
  const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let open = true;
  req.on("close", () => { open = false; });
  emit({ type: "RUN_STARTED", runId, model, format });
  try {
    for await (const event of runTurn({ chat, model, format, history, action, catalogs, maxCalls: MAX_CALLS, maxComponents: MAX_COMPONENTS })) {
      if (!open) break;
      if (event.type === "text") emit({ type: "TEXT_MESSAGE_CONTENT", runId, delta: event.delta });
      else if (event.type === "surface") emit({ type: "ACTIVITY_SNAPSHOT", runId, messageId: `${runId}-${Math.random().toString(36).slice(2, 6)}`, activityType: "a2ui-surface", content: { a2ui_operations: event.messages }, format: event.format, ms: event.ms });
      else if (event.type === "source") emit({ type: "CUSTOM", runId, name: "ainui.source", value: { format: event.format, source: event.source, ms: event.ms, attempt: event.attempt } });
      else if (event.type === "rejected") emit({ type: "CUSTOM", runId, name: "ainui.rejected", value: { format: event.format, message: event.message } });
      else if (event.type === "writing") emit({ type: "CUSTOM", runId, name: "ainui.writing", value: { format: event.format, chars: event.chars, source: event.source.slice(-1200) } });
      else if (event.type === "forgiven") emit({ type: "CUSTOM", runId, name: "ainui.forgiven", value: { notes: event.notes } });
      else if (event.type === "fallback") emit({ type: "CUSTOM", runId, name: "ainui.fallback", value: { from: event.from, to: event.to } });
      else if (event.type === "error") emit({ type: "RUN_ERROR", runId, message: event.message });
      else if (event.type === "done") emit({ type: "RUN_FINISHED", runId, calls: event.calls, shown: event.shown, ms: event.ms });
    }
  } catch (e) {
    console.error(new Date().toISOString(), "run failed", e?.message);
    if (open) emit({ type: "RUN_ERROR", runId, message: "The run stopped unexpectedly." });
  }
  res.end();
}

async function compileExpress(req, res) {
  const body = await readJson(req, 256 * 1024);
  if (typeof body.express !== "string" || !body.express.trim()) return fail(res, 400, "invalid_request", "express (string) is required");
  try {
    const messages = createUiAuthor({ format: "express", macros: AINUI_MACROS }).fromToolCall({ express: body.express });
    const components = messages.reduce((n, m) => n + (m.createSurface?.components?.length ?? 0), 0);
    if (components > MAX_COMPONENTS) return fail(res, 413, "too_many_components", `${components} components; the limit is ${MAX_COMPONENTS}`);
    send(res, 200, { messages, components });
  } catch (e) {
    if (e instanceof UiError) return fail(res, 422, "express_invalid", e.message);
    throw e;
  }
}

async function decompile(req, res) {
  const body = await readJson(req, 512 * 1024);
  if (!Array.isArray(body.messages)) return fail(res, 400, "invalid_request", "messages (array) is required");
  try { send(res, 200, { express: toExpress(body.messages) }); }
  catch (e) { fail(res, 422, "not_expressible", String(e?.message ?? e).slice(0, 400)); }
}

function skills(url, res) {
  const format = url.searchParams.get("format") === "json" ? "json" : "express";
  const files = exportSkills({ format, macros: AINUI_MACROS });
  if (url.searchParams.get("download")) {
    return send(res, 200, zip(Object.fromEntries(Object.entries(files).map(([name, content]) => [`ainui-skills-${format}/${name}`, content]))),
      { "content-type": "application/zip", "content-disposition": `attachment; filename="ainui-skills-${format}.zip"` });
  }
  send(res, 200, { format, files });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/api/health") return send(res, 200, { ok: true, version: VERSION, models: client ? MODELS : [], catalog: AINUI_CATALOG_DOCUMENT.catalogId });
    if (req.method === "GET" && path === "/catalog.json") return send(res, 200, AINUI_CATALOG_DOCUMENT, { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" });
    if (req.method === "GET" && path === "/api/models") return send(res, 200, { models: client ? MODELS : [], formats: ["express", "json"], limits: { modelCallsPerRun: MAX_CALLS, componentsPerRequest: MAX_COMPONENTS } });
    if (req.method === "GET" && path === "/api/skills") return skills(url, res);
    if (req.method === "GET" && path === "/api/evals") return existsSync(EVALS) ? send(res, 200, readFileSync(EVALS)) : send(res, 200, { runs: [] });
    if (req.method === "GET" && path === "/api/watch") return send(res, 200, { recordings: recordings().map(({ events, ...meta }) => ({ ...meta, steps: events.length })) });
    if (req.method === "GET" && path.startsWith("/api/watch/")) {
      const found = recordings().find((r) => r.id === path.slice("/api/watch/".length));
      return found ? send(res, 200, found) : fail(res, 404, "not_found", "no such recording");
    }
    if (req.method === "POST" && path === "/api/run") return await run(req, res);
    if (req.method === "POST" && path === "/api/express") return await compileExpress(req, res);
    if (req.method === "POST" && path === "/api/decompile") return await decompile(req, res);
    if (path.startsWith("/api/")) return fail(res, 404, "not_found", "no such endpoint");
    if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "method_not_allowed", "GET only");
    return serveStatic(req, res, path);
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status >= 500) console.error(new Date().toISOString(), req.method, path, e?.message);
    if (!res.headersSent) fail(res, status, status === 413 ? "too_large" : status === 400 ? "invalid_request" : "internal", status >= 500 ? "internal error" : e.message);
    else res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`AIN-UI playground on :${PORT} — models ${client ? MODELS.join(", ") : "(none: AINUI_AINIZE_KEY not set)"} via ${baseURL}`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
