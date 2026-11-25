import { test } from "node:test";
import assert from "node:assert/strict";
import { inPlace, runTurn } from "./agent.mjs";
import { createBudget } from "./limits.mjs";
import { zip } from "./zip.mjs";

/** A model that answers with the scripted replies, in order, and records what it was sent. */
function scripted(...replies) {
  const seen = [];
  const chat = async (body) => { seen.push(body); const next = replies.shift(); if (next instanceof Error) throw next; return { choices: [{ message: next }] }; };
  return { chat, seen };
}
const call = (args, id = "c1") => ({ role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name: "render_ui", arguments: JSON.stringify(args) } }] });
const collect = async (gen) => { const out = []; for await (const e of gen) out.push(e); return out; };
const history = [{ role: "user", content: "a table of regions" }];

test("a valid Express call is shown after one model call", async () => {
  const m = scripted(call({ express: `root = Column([Title("Regions"), Table(columns=["Region"], rows=[["APAC"]])])` }));
  const events = await collect(runTurn({ chat: m.chat, model: "GLM-5.3-Flash", format: "express", history }));
  assert.deepEqual(events.map((e) => e.type), ["source", "surface", "done"]);
  assert.equal(events[1].messages[0].createSurface.components.some((c) => c.component === "Table"), true);
  assert.equal(events[2].calls, 1);
  assert.equal(m.seen[0].tools[0].function.name, "render_ui");
  assert.equal(m.seen[0].reasoning_effort, "low");
  assert.match(m.seen[0].messages[0].content, /A2UI Express/);
});

test("Express that fails twice is asked for again as JSON, within the call limit", async () => {
  const m = scripted(call({ express: `root = Nope()` }), call({ express: `root = StillNope()` }, "c2"),
    call({ components: [{ id: "root", component: "Text", text: "ok", colour: "red" }] }, "c3"));
  const events = await collect(runTurn({ chat: m.chat, model: "Qwen3.8-Flash-Next", format: "express", history }));
  assert.deepEqual(events.map((e) => e.type), ["source", "rejected", "source", "rejected", "fallback", "source", "forgiven", "surface", "done"]);
  assert.equal(events.at(-1).calls, 3);
  assert.equal(events[7].format, "json");
  assert.match(events[6].notes[0], /colour is not a property/);
  assert.match(m.seen[1].messages.at(-1).content, /did not compile/, "the model is told what was wrong");
  assert.match(m.seen[2].messages[0].content, /`components`/, "the third call carries the JSON instructions");
  assert.deepEqual(m.seen[2].tools[0].function.parameters.required, ["components"]);
  assert.deepEqual(m.seen[0].chat_template_kwargs, { enable_thinking: false });
});

test("a model that never gets it right stops at the call limit and shows nothing", async () => {
  const m = scripted(...Array.from({ length: 6 }, (_, i) => call({ components: [{ id: "root", component: "Bogus" }] }, `c${i}`)));
  const events = await collect(runTurn({ chat: m.chat, model: "GLM-5.3-Flash", format: "json", history, maxCalls: 4 }));
  assert.equal(m.seen.length, 4);
  assert.equal(events.filter((e) => e.type === "surface").length, 0);
  assert.deepEqual(events.at(-1), { type: "done", calls: 4, shown: 0, ms: events.at(-1).ms });
});

test("an action updates the surface it came from instead of opening a new one", async () => {
  const m = scripted(call({ express: `root = Text("Count: 2")` }));
  const events = await collect(runTurn({ chat: m.chat, model: "GLM-5.3-Flash", format: "express", history: [...history, { role: "assistant", content: "[You showed surface \"s1\"]" }], action: { name: "more", surfaceId: "s1", context: { n: 1 } } }));
  const surface = events.find((e) => e.type === "surface");
  assert.deepEqual(surface.messages.map((x) => Object.keys(x)[1]), ["updateComponents", "updateDataModel"]);
  assert.ok(surface.messages.every((x) => (x.updateComponents ?? x.updateDataModel).surfaceId === "s1"));
  assert.match(m.seen[0].messages.at(-1).content, /event "more" with context \{"n":1\}/);
  assert.deepEqual(inPlace([{ version: "1.0", updateDataModel: { surfaceId: "s1", path: "/n", value: 2 } }], "s1").length, 1);
});

test("plain text, fenced text, an oversized surface and a failing model", async () => {
  let events = await collect(runTurn({ chat: scripted({ role: "assistant", content: "<think>hm</think>Hello there." }).chat, model: "m", format: "json", history }));
  assert.deepEqual(events.map((e) => e.type), ["text", "done"]); assert.equal(events[0].delta, "Hello there.");
  events = await collect(runTurn({ chat: scripted({ role: "assistant", content: `Sure.\n<a2ui>\nroot = Text("hi")\n</a2ui>` }).chat, model: "m", format: "express", history }));
  assert.deepEqual(events.map((e) => e.type), ["text", "surface", "done"]);
  const many = `root = Column([${Array.from({ length: 12 }, (_, i) => `Text("t${i}")`).join(", ")}])`;
  events = await collect(runTurn({ chat: scripted(call({ express: many }), { role: "assistant", content: "Too much, sorry." }).chat, model: "m", format: "express", history, maxComponents: 10 }));
  assert.deepEqual(events.map((e) => e.type), ["source", "rejected", "text", "done"]);
  assert.match(events[1].message, /limit is 10/);
  events = await collect(runTurn({ chat: scripted(Object.assign(new Error("boom"), { status: 503 })).chat, model: "m", format: "json", history }));
  assert.deepEqual(events.map((e) => e.type), ["error", "done"]); assert.match(events[0].message, /503/);
});

test("run budget: an hourly and a daily cap per caller", () => {
  let now = 0;
  const b = createBudget({ perHour: 2, perDay: 3, now: () => now });
  assert.equal(b.take("a").ok, true); assert.equal(b.take("a").ok, true);
  assert.deepEqual(b.take("a"), { ok: false, window: "hour", retryAfterSeconds: 3600 });
  assert.equal(b.take("b").ok, true, "another caller has its own budget");
  now += 3_600_001; assert.equal(b.take("a").ok, true);
  now += 3_600_001; assert.equal(b.take("a").window, "day");
  now += 86_400_000; assert.equal(b.take("a").ok, true);
});

test("zip: a readable archive of the skill files", () => {
  const z = zip({ "a/SKILL.md": "# hello", "b.txt": "한글" });
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  assert.equal(z.readUInt32LE(z.length - 22), 0x06054b50);
  assert.equal(z.readUInt16LE(z.length - 22 + 10), 2);
  assert.ok(z.includes(Buffer.from("# hello")) && z.includes(Buffer.from("한글")));
});

test("a streaming model reports the surface as it is written, then shows it", async () => {
  const args = JSON.stringify({ express: `root = Column([Title("Regions"), ${Array.from({ length: 30 }, (_, i) => `Text("row ${i}")`).join(", ")}])` });
  const chunks = [{ choices: [{ delta: { content: "Here it is." } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "render_ui", arguments: "" } }] } }] },
    ...args.match(/.{1,90}/gs).map((piece) => ({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: piece } }] } }] }))];
  const chat = async (body) => { assert.equal(body.stream, true); return (async function* () { yield* chunks; })(); };
  const events = await collect(runTurn({ chat, model: "Qwen3.8-Flash-Next", format: "express", history }));
  const types = events.map((e) => e.type);
  assert.ok(types.filter((t) => t === "writing").length >= 2, types.join(","));
  assert.deepEqual(types.filter((t) => t !== "writing"), ["text", "source", "surface", "done"]);
  assert.ok(events.find((e) => e.type === "writing").source.startsWith('{"express"'));
  assert.equal(events.find((e) => e.type === "surface").messages[0].createSurface.components.length, 32);
});
