/**
 * Evaluation: the same requests through the playground's own agent loop, for each model and format.
 *
 *   AINUI_AINIZE_KEY=… node evals/run.mjs [--models a,b] [--formats express,json] [--concurrency 3] [--record 4]
 *
 * Writes evals/results.json (shown on /evals) and, with --record N, the first N valid runs of the first
 * model/format as recordings/*.json (replayed on /watch).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import OpenAI from "openai";
import { runTurn } from "../server/agent.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };

export const CASES = [
  { id: "kpi-dashboard", prompt: "A dashboard for a small online shop: four KPIs, a revenue chart for the last six months and the top five products.", expects: ["Chart"] },
  { id: "compare-table", prompt: "Compare three laptops for a developer in a table, with a recommendation.", expects: ["Table"] },
  { id: "signup-form", prompt: "A sign-up form for a workshop: name, email, a session choice and a consent checkbox, with validation and a submit button.", expects: ["TextField", "Button"] },
  { id: "trip-map", prompt: "A weekend plan for Seoul: a map with five places and the order to visit them.", expects: ["Map"] },
  { id: "pricing", prompt: "A pricing page with three plans. Mark the recommended one.", expects: ["Card", "Button"] },
  { id: "recipe", prompt: "A recipe for kimchi fried rice: ingredients as a list, steps in order, and the cooking time.", expects: ["List"] },
  { id: "settings-tabs", prompt: "Account settings split into Profile, Notifications and Security tabs, each with two or three controls.", expects: ["Tabs"] },
  { id: "survey", prompt: "A five-question customer satisfaction survey with a slider, radio choices and a comment box.", expects: ["Slider", "RadioGroup"] },
  { id: "article-sources", prompt: "Summarise why the sky is blue in three short paragraphs with two cited sources and follow-up questions.", expects: ["Citation", "FollowUp"] },
  { id: "gallery", prompt: "A photo gallery of six landscape photos with captions, as a carousel.", expects: ["Carousel"] },
  { id: "order-status", prompt: "An order status card: order number, a status badge, the items in a table and a button to contact support.", expects: ["Badge", "Table", "Button"] },
  { id: "files", prompt: "Show a folder of eight files as a grid of tiles, with a breadcrumb path and an upload button.", expects: ["Tile", "Breadcrumbs", "FileUpload"] },
];

const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function one(chat, model, format, c) {
  const started = Date.now();
  const events = [];
  let surface = null, rejected = 0, fellBack = false, unanswered = false, reason = "";
  for await (const event of runTurn({ chat, model, format, history: [{ role: "user", content: c.prompt }] })) {
    events.push({ at: Date.now() - started, event });
    if (event.type === "surface" && !surface) surface = event;
    else if (event.type === "rejected") { rejected++; reason = event.message; }
    else if (event.type === "fallback") fellBack = true;
    else if (event.type === "error") { unanswered = true; reason = event.message; }
  }
  const names = new Set((surface?.messages ?? []).flatMap((m) => (m.createSurface?.components ?? []).map((x) => x.component)));
  // A run that only produced a surface after falling back to JSON is a failure of the format under test.
  const valid = !!surface && !(format === "express" && fellBack);
  return { id: c.id, events, unanswered: unanswered && !surface, valid, firstTry: valid && rejected === 0, choice: valid && c.expects.every((n) => names.has(n)),
    ms: Date.now() - started, reason: valid ? (c.expects.every((n) => names.has(n)) ? "" : `valid, but without ${c.expects.filter((n) => !names.has(n)).join(", ")}`) : reason.slice(0, 240) || "no surface" };
}

async function pool(items, size, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.AINUI_AINIZE_KEY || process.env.AINIZE_API_KEY;
  if (!apiKey) { console.error("AINUI_AINIZE_KEY is not set"); process.exit(1); }
  const client = new OpenAI({ apiKey, baseURL: process.env.AINUI_MODEL_BASE_URL ?? "https://ainize.ai/v1", timeout: 120_000, maxRetries: 1 });
  const chat = (body) => client.chat.completions.create(body);
  const models = arg("models", "Qwen3.8-Flash-Next,GLM-5.3-Flash").split(",");
  const formats = arg("formats", "express,json").split(",");
  const concurrency = Number(arg("concurrency", "3"));
  const record = Number(arg("record", "0"));
  const only = arg("cases", "");
  const cases = only ? CASES.filter((c) => only.split(",").includes(c.id)) : CASES;
  const runs = [];
  for (const model of models) for (const format of formats) {
    const results = await pool(cases, concurrency, (c) => one(chat, model, format, c));
    const scored = results.filter((r) => !r.unanswered);
    runs.push({ model, format, cases: cases.length, scored: scored.length, valid: scored.filter((r) => r.valid).length, firstTry: scored.filter((r) => r.firstTry).length,
      componentChoice: scored.filter((r) => r.choice).length, medianMs: median(scored.filter((r) => r.valid).map((r) => r.ms)),
      failures: results.filter((r) => r.reason).map((r) => ({ id: r.id, reason: r.unanswered ? `not scored: ${r.reason}` : r.reason })) });
    const row = runs.at(-1);
    console.log(`${model} ${format}: valid ${row.valid}/${row.scored}, first try ${row.firstTry}, choice ${row.componentChoice}, median ${(row.medianMs / 1000).toFixed(1)} s`);
    if (record && runs.length === 1) {
      mkdirSync(resolve(here, "../recordings"), { recursive: true });
      for (const r of results.filter((x) => x.valid).slice(0, record)) {
        const c = cases.find((x) => x.id === r.id);
        const toWire = ({ at, event }) => ({ at, event: event.type === "text" ? { type: "TEXT_MESSAGE_CONTENT", delta: event.delta }
          : event.type === "surface" ? { type: "ACTIVITY_SNAPSHOT", activityType: "a2ui-surface", content: { a2ui_operations: event.messages }, format: event.format, ms: event.ms }
            : event.type === "source" ? { type: "CUSTOM", name: "ainui.source", value: { format: event.format, source: event.source, ms: event.ms, attempt: event.attempt } }
              : event.type === "rejected" ? { type: "CUSTOM", name: "ainui.rejected", value: { format: event.format, message: event.message } }
                : event.type === "forgiven" ? { type: "CUSTOM", name: "ainui.forgiven", value: { notes: event.notes } }
                  : event.type === "fallback" ? { type: "CUSTOM", name: "ainui.fallback", value: { from: event.from, to: event.to } }
                    : event.type === "done" ? { type: "RUN_FINISHED", calls: event.calls, shown: event.shown, ms: event.ms } : { type: "RUN_ERROR", message: event.message } });
        writeFileSync(resolve(here, `../recordings/${r.id}.json`), JSON.stringify({ title: c.prompt.split(/[:.]/)[0], prompt: c.prompt, model, format, recordedAt: new Date().toISOString(),
          events: [{ at: 0, event: { type: "RUN_STARTED", runId: r.id, model, format } }, ...r.events.map(toWire)] }, null, 1) + "\n");
      }
    }
  }
  writeFileSync(resolve(here, "results.json"), JSON.stringify({ ranAt: new Date().toISOString(), cases: cases.map(({ id, prompt, expects }) => ({ id, prompt, expects })), runs }, null, 1) + "\n");
}
