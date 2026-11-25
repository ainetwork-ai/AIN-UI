import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";
import { AINUI_CATALOG_DOCUMENT } from "../src/index.js";
import { createUiAuthor } from "../src/agent.js";
import { EXAMPLES, MACRO_EXAMPLES } from "../demo/src/examples.js";

/** The playground's component pages (demo/src/examples.ts): every example must be valid for the catalog and draw. */
const catalogNames = Object.keys((AINUI_CATALOG_DOCUMENT as { components: Record<string, unknown> }).components);
const author = createUiAuthor({ format: "json" });
const all: Array<[string, { components: any[]; data?: Record<string, unknown> }]> = [
  ...Object.entries(EXAMPLES),
  ...MACRO_EXAMPLES.map((m) => [`macro ${m.name}`, { components: m.components }] as [string, { components: any[] }]),
];

test("demo examples: one example for each of the catalog's components, and one per macro", () => {
  assert.equal(catalogNames.length, 92);
  assert.deepEqual(Object.keys(EXAMPLES).sort(), [...catalogNames].sort());
  assert.deepEqual(MACRO_EXAMPLES.map((m) => m.name), ["FileCard", "PaymentCard", "AgentCard"]);
  for (const m of MACRO_EXAMPLES) assert.ok(m.description && m.express.startsWith(`root = ${m.name}(`), m.name);
});

test("demo examples: each example shows its own component and stays a small surface", () => {
  for (const [name, example] of Object.entries(EXAMPLES)) {
    assert.ok(example.components.some((c) => c.component === name), `${name}: the example has no ${name}`);
    assert.ok(example.components.length <= 20, `${name}: ${example.components.length} components`);
    assert.equal(example.components.filter((c) => c.id === "root").length, 1, `${name}: exactly one root`);
    for (const c of example.components) assert.match(String(c.id), /^[A-Za-z0-9_]+$/, `${name}: id ${c.id}`);
  }
});

for (const [name, example] of all) {
  test(`demo examples: ${name} is valid for the catalog as written`, () => {
    const notes: string[] = [];
    const messages = author.fromToolCall({ components: example.components, data: example.data }, notes) as any[];
    assert.deepEqual(notes, [], "the author changed nothing");
    assert.deepEqual(messages[0].createSurface.components, example.components);
  });

  test(`demo examples: ${name} draws`, async () => {
    const d = await draw(surface(example.components, example.data ?? {}));
    try {
      assert.deepEqual(d.errors.map((e) => e.message), []);
      assert.ok(d.container.firstElementChild, "something was drawn");
      assert.ok(d.html().length > 40, "the DOM is not empty");
    } finally { await d.unmount(); }
  });
}
