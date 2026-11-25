import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";
import { createUiAuthor } from "../src/agent.js";

test("a click answered with a whole new screen replaces the surface in place, with no orphans left behind", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["t", "go"] },
    { id: "t", component: "Text", text: "list" }, { id: "go", component: "Button", label: "Details", onClick: { event: { name: "open" } } },
  ]));
  const author = createUiAuthor({ format: "json" });
  // the model answers the click with the whole new screen for the same surface
  const update = author.fromToolCall({ surfaceId: "s", components: [
    { id: "root", component: "Column", children: ["detail", "btn_back"] },
    { id: "detail", component: "Text", text: "detail" },
    { id: "btn_back", component: "Button", label: "Back", onClick: { event: { name: "back" } } },
  ] }) as any[];
  assert.deepEqual(update.map((m) => Object.keys(m)[1]), ["deleteSurface", "createSurface"]);
  await d.append(...update);
  assert.deepEqual(d.errors, []);
  assert.match(d.container.textContent!, /detail/);
});

test("buttons a model put inside EntityCard actions with their own onClick still send an event", async () => {
  const notes: string[] = [];
  const out = createUiAuthor({ format: "json" }).fromToolCall({ components: [
    { id: "root", component: "EntityCard", title: "Login fails", actions: [{ label: "View details", onClick: { event: { name: "view_ticket", context: { id: "T-1" } } } }] },
  ] }, notes) as any[];
  const card = out[0].createSurface.components[0];
  assert.deepEqual(card.onAction, { event: { name: "view_ticket", context: { id: "T-1" } } });
  assert.deepEqual(card.actions, [{ label: "View details" }]);
  const d = await draw(out);
  await d.click(".ainui-entity-card-actions button");
  assert.equal(d.actions[0].name, "view_ticket");
  assert.deepEqual(d.actions[0].context, { id: "T-1", action: "View details", label: "View details" });
  await d.unmount();
});
