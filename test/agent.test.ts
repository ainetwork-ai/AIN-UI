import { test } from "node:test";
import assert from "node:assert/strict";
import { UiError, catalogGuide, catalogsFor, createUiAuthor, defineMacro, expandMacros, exportSkills, ainuiCatalogDocument, toExpress } from "../src/agent.js";
import { AINUI_MACROS } from "../src/macros.js";
import { AINUI_CATALOG } from "../src/index.js";

const components = (messages: any[]) => messages[0].createSurface.components as any[];

test("express: one line per component compiles to a validated 1.0 surface, each call its own surface", () => {
  const author = createUiAuthor({ format: "express" });
  assert.equal(author.tool.function.name, "render_ui");
  assert.deepEqual(author.tool.function.parameters.required, ["express"]);
  assert.match(author.prompt, /A2UI Express/);
  const source = `title = Title("Quarterly numbers")
tbl = Table(columns=["Region","Revenue"], rows=[["APAC","$1.2M"],["EMEA","$0.9M"]])
go = Button("Refresh", onClick=Event("refresh", {period: "q3"}))
root = Column([title, tbl, go])`;
  const a = author.fromToolCall({ express: source }) as any[], b = author.fromToolCall(JSON.stringify({ express: source })) as any[];
  assert.equal(a[0].version, "1.0"); assert.equal(a[0].createSurface.catalogId, AINUI_CATALOG);
  assert.notEqual(a[0].createSurface.surfaceId, b[0].createSurface.surfaceId);
  const byId = Object.fromEntries(components(a).map((c) => [c.id, c]));
  assert.deepEqual(byId.root.children, ["title", "tbl", "go"]);
  assert.deepEqual(byId.go.onClick, { event: { name: "refresh", context: { period: "q3" } } });
  assert.match(toExpress(a), /Table\(/);
});

test("what a model gets wrong comes back as a message it can act on, never as a surface", () => {
  const express = createUiAuthor({ format: "express" });
  assert.throws(() => express.fromToolCall({ express: `root = Nope("x")` }), (e: any) => e instanceof UiError && /Nope/.test(e.message) && /render_ui/.test(e.message));
  assert.deepEqual((express.fromToolCall({ express: `root = Column([missing])` }) as any[])[0].createSurface.components[0].children, [], "a list child never written is left out");
  assert.throws(() => express.fromToolCall({}), /needs `express`/);
  assert.throws(() => createUiAuthor({ format: "json" }).fromToolCall({ components: [{ id: "top", component: "Text", text: "x" }] }), /id "root"/);
  assert.throws(() => createUiAuthor({ format: "json" }).fromToolCall({ components: "[{not json" }), /not valid JSON/);
  const json = createUiAuthor({ format: "json" });
  assert.throws(() => json.fromToolCall({ messages: [{ createSurface: { surfaceId: "x", components: [{ id: "root", component: "Columnn" }] } }] }), (e: any) => e instanceof UiError && /Columnn/.test(e.message));
  assert.throws(() => json.fromToolCall({ messages: [{ createSurface: { surfaceId: "x", components: [{ id: "root", component: "Card", child: "ghost" }] } }] }), UiError, "a single child that was never written is still refused");
  assert.throws(() => json.fromToolCall({ messages: "not json" }), /not valid JSON/);
});

test("json: the prompt is a compact guide, and a model that omits the catalog or version still means ours", () => {
  const author = createUiAuthor({ format: "json" });
  assert.ok(author.prompt.length < 45_000, `the JSON prompt is ${author.prompt.length} chars`);
  assert.ok(createUiAuthor({ format: "express" }).prompt.length < 60_000);
  assert.match(author.prompt, /- Table — /);
  assert.match(author.prompt, /"@path"/);
  assert.deepEqual(author.tool.function.parameters.required, ["components"]);
  // the shape the tool asks for: components and data, no envelope
  const notes: string[] = [];
  const shown = author.fromToolCall({ components: [
    { id: "root", component: "Column", children: ["t", "tbl"], spacing: "lots" },
    { id: "t", component: "Text", text: { "@path": "/n" }, maxLines: "2" },
    { id: "tbl", component: "Table", columns: [{ label: "Name", key: "name" }], rows: [["Ada"]] },
  ], data: { n: "hi" } }, notes) as any[];
  assert.equal(shown[0].createSurface.catalogId, AINUI_CATALOG); assert.deepEqual(shown[0].createSurface.dataModel, { n: "hi" });
  const byId = Object.fromEntries(shown[0].createSurface.components.map((c: any) => [c.id, c]));
  assert.equal("spacing" in byId.root, false, "a prop the component does not have is dropped, not fatal");
  assert.equal(byId.t.maxLines, 2, "a number written as a string is a number");
  assert.deepEqual(byId.tbl.columns, [{ label: "Name" }]);
  assert.equal(notes.length, 2, notes.join(" | "));
  const loose: string[] = [];
  const tree = author.fromToolCall({ components: [
    { id: "root", component: "Column", children: ["rec-title", "tabs"] },
    { id: "rec-title", component: "Title", text: "Pick" },
    { id: "tabs", component: "Tabs", tabs: [{ title: "One", child: "p-1" }] },
    { id: "p-1", component: "Text", text: "rec-title" },
    { id: "stray", component: "Caption", text: "nobody shows me" },
  ] }, loose) as any[];
  const ids = tree[0].createSurface.components.map((c: any) => c.id);
  assert.deepEqual(ids, ["root", "rec_title", "tabs", "p_1"], "ids become identifiers, references follow, an orphan is left out");
  assert.deepEqual(tree[0].createSurface.components[0].children, ["rec_title", "tabs"]);
  assert.equal(tree[0].createSurface.components[2].tabs[0].child, "p_1");
  assert.equal(tree[0].createSurface.components[3].text, "rec-title", "text that happens to equal an id is not a reference");
  assert.equal(loose.length, 2, loose.join(" | "));
  const changed = author.fromToolCall({ surfaceId: "s9", components: [{ id: "t", component: "Text", text: "new" }], data: { n: 1 } }) as any[];
  assert.deepEqual(changed.map((m) => Object.keys(m)[1]), ["updateComponents", "updateDataModel"]);
  assert.equal(changed[0].updateComponents.surfaceId, "s9");
  // the built-in example in each prompt is itself valid
  for (const format of ["express", "json"] as const) {
    const a = createUiAuthor({ format });
    const body = /### Example: a small surface\n([\s\S]*)$/.exec(a.prompt)![1];
    assert.ok(a.fromToolCall(format === "express" ? { express: body } : JSON.parse(body)).length >= 1, format);
  }
  const out = author.fromToolCall({ messages: [{ createSurface: { components: [{ id: "root", component: "Column", children: ["t"] }, { id: "t", component: "Text", text: { "@path": "/n" } }], dataModel: { n: "hi" } } }] }) as any[];
  assert.equal(out[0].version, "1.0"); assert.equal(out[0].createSurface.catalogId, AINUI_CATALOG); assert.ok(out[0].createSurface.surfaceId);
  const update = author.fromToolCall({ messages: [{ version: "1.0", updateDataModel: { surfaceId: "s1", path: "/n", value: 2 } }] }) as any[];
  assert.deepEqual(update[0].updateDataModel, { surfaceId: "s1", path: "/n", value: 2 }, "an update to an earlier surface passes through");
  assert.match(catalogGuide(ainuiCatalogDocument({ components: ["Text"] })), /^### Components\n- Text — /);
});

test("text with fenced blocks, for a model without tool calling", () => {
  const parts = createUiAuthor({ format: "express" }).fromText(`Here you go.\n<a2ui>\nroot = Text("hello")\n</a2ui>\nAnything else?`);
  assert.deepEqual(parts.map((p) => p.type), ["text", "a2ui", "text"]);
  assert.equal((parts[1] as any).messages[0].createSurface.components[0].text, "hello");
  const json = createUiAuthor({ format: "json" }).fromText(`<a2ui-json>[{"createSurface":{"components":[{"id":"root","component":"Text","text":"hi"}]}}]</a2ui-json>`);
  assert.equal((json[0] as any).messages[0].createSurface.components[0].component, "Text");
});

test("macros: the model writes one component, the renderer receives only standard ones", () => {
  const author = createUiAuthor({ format: "express", macros: AINUI_MACROS });
  assert.match(author.prompt, /FileCard/);
  const out = author.fromToolCall({ express: `card = FileCard(name="report.pdf", path="docs/report.pdf", detail="2 MB")\nagent = AgentCard(name="Gallery guide", agentKey="https://ainize.ai#guide", skills=["tour","faq"])\nroot = Column([card, agent])` }) as any[];
  const list = components(out);
  assert.ok(!list.some((c) => ["FileCard", "AgentCard"].includes(c.component)));
  const card = list.find((c) => c.id === "card");
  assert.equal(card.component, "Card");
  const open = list.find((c) => c.id === "card__open");
  assert.deepEqual(open.onClick.event, { name: "aindrive.open", context: { drive_id: "", path: "docs/report.pdf", is_dir: false } });
  assert.equal(list.filter((c) => /^agent__skill\d$/.test(c.id)).length, 2);
  // a macro that uses another macro, and one that never ends
  const outer = defineMacro({ name: "Outer", description: "", props: {}, expand: (_p, id) => [{ component: "Column", children: [id("f")] }, { id: id("f"), component: "FileCard", name: "a", path: "a" }] });
  assert.ok(expandMacros([{ id: "root", component: "Outer" }], [outer, ...AINUI_MACROS]).every((c) => !["Outer", "FileCard"].includes(c.component)));
  const loop = defineMacro({ name: "Loop", description: "", props: {}, expand: (_p, id) => [{ component: "Column", children: [id("x")] }, { id: id("x"), component: "Loop" }] });
  assert.throws(() => expandMacros([{ id: "root", component: "Loop" }], [loop]), /nest deeper/);
});

test("capabilities choose the catalog, and skills are exported for both formats", () => {
  assert.equal(catalogsFor(undefined).length, 0, "a renderer that did not ask for A2UI gets text");
  assert.equal(catalogsFor({ "1.0": { supportedCatalogIds: ["https://example.test/other.json"] } }).length, 0);
  assert.equal(catalogsFor({ "1.0": { supportedCatalogIds: [AINUI_CATALOG] } })[0].catalogId, AINUI_CATALOG);
  const mine = { ...ainuiCatalogDocument({ components: ["Column", "Text"] }), catalogId: "https://example.test/mine.json" };
  const inline = catalogsFor({ "1.0": { supportedCatalogIds: [mine.catalogId], inlineCatalogs: [mine] } });
  assert.equal(inline[0].catalogId, mine.catalogId, "a catalog the browser sends is the one written for");
  const author = createUiAuthor({ format: "express", catalogs: inline });
  assert.throws(() => author.fromToolCall({ express: `root = Table(columns=["a"], rows=[["b"]])` }), UiError, "a component outside the renderer's catalog is refused");
  assert.equal((author.fromToolCall({ express: `root = Text("ok")` }) as any[])[0].createSurface.catalogId, mine.catalogId);
  for (const format of ["express", "json"] as const) {
    const files = exportSkills({ format, macros: AINUI_MACROS });
    assert.ok(Object.keys(files).some((f) => f.endsWith("SKILL.md")));
    assert.ok(Object.values(files).join("\n").includes("FileCard"));
  }
});

test("components passed as text, closed one bracket too many, are still read (seen 11-25 from Qwen)", () => {
  const author = createUiAuthor({ format: "json" });
  const list = [{ id: "root", component: "Column", children: ["t"] }, { id: "t", component: "Title", text: "Shop Dashboard" }];
  const notes: string[] = [];
  const out = author.fromToolCall({ components: JSON.stringify(list) + "}]" }, notes) as any[];
  assert.equal(out[0].createSurface.components.length, 2);
  assert.match(notes[0], /unmatched bracket/);
  const middle = JSON.stringify(list).replace('"children":["t"]}', '"children":["t"]}}');
  assert.equal((author.fromToolCall({ components: middle }) as any[])[0].createSurface.components.length, 2, "a stray closer inside the array (seen 11-25 from Qwen) is dropped too");
  const short = '[{"id":"root","component":"Column","children":["t"],"x":{"y":{"@path":"/a"}},\n {"id":"t","component":"Title","text":"Hi"}]';
  assert.equal((author.fromToolCall({ components: short }) as any[])[0].createSurface.components.length, 2, "an object left open before the next item is closed (seen 11-25 from Qwen)");
  assert.equal((author.fromToolCall({ components: JSON.stringify(list) }) as any[]).length, 1, "a string with nothing after it is read as before");
  assert.throws(() => author.fromToolCall({ components: JSON.stringify(list) + " and then some words" }), /not valid JSON/, "anything else after it is not guessed at");
});

test("small schema slips a model makes are repaired, not refused (seen 11-25 from Qwen)", () => {
  const notes: string[] = [];
  const out = createUiAuthor({ format: "json" }).fromToolCall({ components: [
    { id: "root", component: "Column", children: ["card", "tbl", "f", "ghost"] },
    { id: "card", component: "EntityCard", title: "Pro", badge: null },
    { id: "tbl", component: "Table", columns: ["Name", "Action"], rows: [["Ada", { componentId: "b" }]], cellComponents: [{ componentId: "b" }] },
    { id: "b", component: "Button", label: "Open" },
    { id: "f", component: "TextField", label: "Email", value: { "@path": "/email" }, checks: [{ "@call": "email", args: { value: { "@path": "/email" } } }] },
  ], data: { email: "" } }, notes) as any[];
  const byId = Object.fromEntries(out[0].createSurface.components.map((c: any) => [c.id, c]));
  assert.equal("badge" in byId.card, false);
  assert.deepEqual(byId.tbl.cellComponents, ["b"]);
  assert.equal(byId.f["checks"]?.[0]?.message ?? byId.f["@checks"]?.[0]?.message, "Enter a valid email address");
  assert.deepEqual(byId.root.children, ["card", "tbl", "f"]);
  assert.ok(notes.some((n) => /ghost/.test(n)));
});

test("Express: names and values the compiler refuses, and components used as list items, are repaired (evaluation 11-25)", () => {
  const author = createUiAuthor({ format: "express" });
  const notes: string[] = [];
  const out = author.fromToolCall({ express: [
    `h = Heading(eyebrow="Growth", title="Weekly, \\"quoted\\" (yes)")`,
    `bar = Toolbar([Text("a")], justify="end")`,
    `kpis = StatGroup([Stat("Signups", "1,284", delta="+12%"), Stat("Churn", "2.1%")])`,
    `plan = EntityCard(title="Starter", badge="Popular", actions=[Button("Choose", onClick=Event("select_plan", {plan: "starter"}))])`,
    `root = Column([h, bar, kpis, plan, Text("small", size="2xl")])`,
  ].join("\n") }, notes) as any[];
  const byComponent = (name: string) => out[0].createSurface.components.find((c: any) => c.component === name);
  assert.equal(byComponent("Heading").text, 'Weekly, "quoted" (yes)');
  assert.equal("justify" in byComponent("Toolbar"), false);
  assert.deepEqual(byComponent("StatGroup").items, [{ label: "Signups", value: "1,284", delta: "+12%" }, { label: "Churn", value: "2.1%" }]);
  assert.equal(out[0].createSurface.components.filter((c: any) => c.component === "Stat").length, 0, "the inlined Stats are not left as components");
  const card = byComponent("EntityCard");
  assert.deepEqual(card.badge, { label: "Popular" });
  assert.deepEqual(card.actions, [{ label: "Choose" }]);
  assert.equal(card.onAction.event.name, "select_plan");
  assert.ok(notes.length >= 5, notes.join(" | "));
});

test("a Table's cell components are listed in cellComponents when a model forgot (evaluation 11-25)", () => {
  const notes: string[] = [];
  const out = createUiAuthor({ format: "json" }).fromToolCall({ components: [
    { id: "root", component: "Table", columns: ["Model", "Pick"], rows: [[{ componentId: "cell_model" }, "yes"]] },
    { id: "cell_model", component: "Badge", label: "MacBook Pro" },
  ] }, notes) as any[];
  assert.deepEqual(out[0].createSurface.components[0].cellComponents, ["cell_model"]);
  assert.equal(out[0].createSurface.components.length, 2);
});
