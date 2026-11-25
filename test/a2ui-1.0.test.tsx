import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";
import {
  A2UI_BASIC_CATALOG, A2UI_BASIC_CATALOG_V09, A2UI_VERSION, AINUI_CATALOG, AINUI_CATALOG_V1, AINUI_CATALOG_DOCUMENT, STANDARD_COMPONENT_NAMES,
  ainuiFolder, ainuiPayment, flattenMessages, toItem, upgradeMessages,
} from "../src/index.js";
import { ainuiCapabilities, ainuiCatalog, missingStandardViews } from "../src/react.js";
import { createA2uiRenderer } from "../src/renderer.js";
import { installDom } from "./support/dom.js";

test("v0.9 → 1.0: bindings, checks and headings move position by position; data paths and templates stay", () => {
  const out = upgradeMessages([
    { version: "v0.9", createSurface: { surfaceId: "s", catalogId: AINUI_CATALOG_V1, theme: { primaryColor: "#f00" } } },
    { version: "v0.9", updateComponents: { surfaceId: "s", components: [
      { id: "root", component: "Column", children: ["h", "list", "f", "b"] },
      { id: "h", component: "Text", variant: "h2", text: { path: "/title" } },
      { id: "list", component: "List", children: { componentId: "row", path: "/items" } },
      { id: "row", component: "Text", text: { path: "name" }, accessibility: { label: { path: "name" } } },
      { id: "f", component: "TextField", label: "Name", value: { path: "/name" }, checks: [{ condition: { call: "required", args: { value: { path: "/name" } } }, message: "Required" }] },
      { id: "b", component: "Button", child: "h", action: { event: { name: "go", context: { n: { path: "/name" }, crumb: { label: "Docs", path: "docs" } } } } },
    ] } },
    { version: "v0.9", updateDataModel: { surfaceId: "s", path: "/name" } },
  ]) as any[];
  assert.ok(out.every((m) => m.version === A2UI_VERSION));
  assert.equal(out[0].createSurface.catalogId, AINUI_CATALOG);
  assert.equal("theme" in out[0].createSurface, false, "1.0 has no theme on createSurface");
  const c = Object.fromEntries(out[1].updateComponents.components.map((x: any) => [x.id, x]));
  assert.deepEqual(c.h, { id: "h", component: "Title", size: "xl", text: { "@path": "/title" } });
  assert.deepEqual(c.list.children, { componentId: "row", path: "/items" }, "a child template keeps `path`");
  assert.deepEqual(c.row["@accessibility"], { label: { "@path": "name" } });
  assert.deepEqual(c.f["@checks"][0].condition, { "@call": "required", args: { value: { "@path": "/name" } } });
  assert.deepEqual(c.b.action.event.context, { n: { "@path": "/name" }, crumb: { label: "Docs", path: "docs" } }, "an object that merely has a `path` key is data, not a binding");
  assert.deepEqual(out[2].updateDataModel, { surfaceId: "s", path: "/name", value: null }, "an absent value becomes null (delete)");

  const basic = upgradeMessages([
    { version: "v0.9", createSurface: { surfaceId: "b", catalogId: A2UI_BASIC_CATALOG_V09 } },
    { version: "v0.9", updateComponents: { surfaceId: "b", components: [{ id: "root", component: "Text", variant: "h1", text: "Hello" }, { id: "t", component: "Text", variant: "h3", text: { path: "/t" } }] } },
  ]) as any[];
  assert.equal(basic[0].createSurface.catalogId, A2UI_BASIC_CATALOG);
  assert.equal(basic[1].updateComponents.components[0].text, "# Hello", "the 1.0 basic Text writes a heading as Markdown");
  assert.deepEqual(basic[1].updateComponents.components[1].text, { "@call": "formatString", args: { value: "### ${/t}" } });

  const again = upgradeMessages(out);
  assert.deepEqual(again, out, "1.0 messages pass through untouched");
});

test("the catalog: one 1.0 document with every standard and AIN component, each with a view", () => {
  assert.equal(AINUI_CATALOG_DOCUMENT.protocolVersion, "1.0");
  assert.equal(AINUI_CATALOG_DOCUMENT.catalogId, AINUI_CATALOG);
  assert.equal(STANDARD_COMPONENT_NAMES.length, 69);
  assert.equal(Object.keys(AINUI_CATALOG_DOCUMENT.components).length, 79);
  assert.deepEqual(missingStandardViews, [], "no component falls back to the placeholder view");
  assert.equal(ainuiCatalog.components.size, 79);
  assert.equal(typeof AINUI_CATALOG_DOCUMENT.instructions, "string");
  const caps = ainuiCapabilities() as any;
  assert.ok(caps["1.0"].supportedCatalogIds.includes(AINUI_CATALOG), JSON.stringify(caps).slice(0, 200));
  const inline = ainuiCapabilities({ inline: true }) as any;
  assert.ok(inline["1.0"].inlineCatalogs.some((c: any) => c.catalogId === AINUI_CATALOG && c.components.Table), "the renderer can send its catalog to an agent that has never seen it");
});

test("a click goes out as a 1.0 action and the answer updates the same surface in place", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["count", "name", "more"] },
    { id: "count", component: "Text", text: { "@call": "formatString", args: { value: "Count: ${/n}" } } },
    { id: "name", component: "TextField", label: "Name", value: { "@path": "/name" } },
    { id: "more", component: "Button", label: "More", onClick: { event: { name: "more", context: { n: { "@path": "/n" }, name: { "@path": "/name" } } } } },
  ], { n: 1, name: "" }));
  assert.deepEqual(d.errors, []);
  await d.type("input", "Ada");
  await d.click("button");
  assert.equal(d.actions.length, 1);
  assert.equal(d.actions[0].name, "more"); assert.equal(d.actions[0].surfaceId, "s");
  assert.deepEqual(d.actions[0].context, { n: 1, name: "Ada" });
  assert.equal(d.outbound[0].version, "1.0"); assert.equal(d.outbound[0].action.name, "more");
  const input = d.$<HTMLInputElement>("input")!;
  await d.append({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/n", value: 2 } });
  assert.match(d.container.textContent!, /Count: 2/);
  assert.equal(d.$<HTMLInputElement>("input"), input, "the same DOM node: the surface was updated, not redrawn");
  assert.equal(input.value, "Ada", "what the user typed survived the update");
  await d.append({ version: "1.0", updateComponents: { surfaceId: "s", components: [{ id: "more", component: "Button", label: "Again", onClick: { event: { name: "again" } } }] } });
  assert.match(d.$("button")!.textContent!, /Again/);
  await d.unmount();
});

test("a surface in the 1.0 basic catalog is drawn too, and an invalid one is reported, not thrown", async () => {
  const basic = await draw([{ version: "1.0", createSurface: { surfaceId: "b", catalogId: A2UI_BASIC_CATALOG, components: [{ id: "root", component: "Text", text: "plain A2UI" }] } }]);
  assert.deepEqual(basic.errors, []);
  assert.match(basic.container.textContent!, /plain A2UI/);
  await basic.unmount();
  const bad = await draw(surface([{ id: "root", component: "NoSuchThing" }]));
  assert.equal(bad.errors.length, 1);
  assert.ok(bad.$("[role=alert]"));
  await bad.unmount();
});

test("the dependency-free DOM renderer reads 1.0 messages from the builders", () => {
  installDom("<!doctype html><div id='dom'></div>");
  const container = document.getElementById("dom")!;
  const actions: any[] = [];
  const r = createA2uiRenderer(container, { onAction: (a: any) => actions.push(a), resolveAsset: (a: any) => `/files/${a.path}` });
  const items = [toItem("d1", "notes.txt", { name: "notes.txt", isDir: false, size: 12 }, {}), toItem("d1", "Photos", { name: "Photos", isDir: true }, {})];
  const folder = ainuiFolder({ driveId: "d1", path: "", items, env: { view: "list" } });
  assert.ok(folder.every((m) => m.version === "1.0"));
  r.replace(folder);
  assert.match(container.textContent!, /notes\.txt/);
  assert.match(container.textContent!, /Photos/);
  const required = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453" as const, amount: "10000", asset: "0xasset", payTo: "0xseller", maxTimeoutSeconds: 300 }] };
  r.replace(ainuiPayment({ shareToken: "sale", title: "Report", required: required as never, paymentRequired: "quote", symbol: "USDC", decimals: 6 }));
  assert.match(container.querySelector(".a2ui-text-h3, h3, .a2ui-text")!.textContent!, /Report/, "Title from the 1.0 catalog is drawn as a heading");
  assert.match(container.textContent!, /0\.01/);
  // a createSurface that carries components and data in one message
  r.replace([{ version: "1.0", createSurface: { surfaceId: "one", catalogId: AINUI_CATALOG, components: [{ id: "root", component: "Text", text: { "@path": "/hello" } }], dataModel: { hello: "inline surface" } } }]);
  assert.match(container.textContent!, /inline surface/);
  assert.deepEqual(flattenMessages([{ version: "1.0", createSurface: { surfaceId: "x", components: [{ id: "root", component: "Text", text: { "@path": "/a" } }], dataModel: { a: 1 } } }]).map((m) => Object.keys(m)[1]),
    ["createSurface", "updateComponents", "updateDataModel"]);
});
