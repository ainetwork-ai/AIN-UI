import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, fill, series } from "../src/expression.js";
import { draw, surface } from "./support/harness.js";

test("expressions: arithmetic, comparisons, functions and names — and nothing else", () => {
  assert.equal(evaluate("1 + 2 * 3"), 7);
  assert.equal(evaluate("(1 + 2) * 3 ^ 2"), 27);
  assert.equal(evaluate("price * qty", { price: 2.5, qty: 4 }), 10);
  assert.equal(evaluate("round(total / 3, 2)", { total: 10 }), 3.33);
  assert.equal(evaluate("n > 3 && n <= 5 ? 'mid' : 'out'", { n: 4 }), "mid");
  assert.equal(evaluate("'Total: ' + n", { n: 3 }), "Total: 3");
  assert.equal(evaluate("max(a, b) - min(a, b)", { a: 7, b: 2 }), 5);
  assert.equal(evaluate("-x % 3", { x: -7 }), 1);
  assert.throws(() => evaluate("constructor"), /unknown name/);
  assert.throws(() => evaluate("alert(1)"), /unknown function/);
  assert.throws(() => evaluate("1 +"), /unexpected end/);
  assert.throws(() => evaluate("a.constructor", { a: {} }), /unknown name/);
});

test("series: copies of an item with the loop variable filled in, types kept for whole expressions", () => {
  assert.deepEqual(series({ count: 3, item: { month: "${i}", cost: "${i * monthlyCost}", label: "M${i}" }, monthlyCost: 20 }),
    [{ month: 1, cost: 20, label: "M1" }, { month: 2, cost: 40, label: "M2" }, { month: 3, cost: 60, label: "M3" }]);
  assert.deepEqual(series({ count: 2, item: "${k * 2}", variable: "k", start: 0 }), [0, 2]);
  assert.equal(series({ count: 5000, item: 1 }).length, 1000);
  assert.deepEqual(fill(["${1+1}", "a${2}"], {}), [2, "a2"]);
});

test("catalog functions run in the renderer: formatString, calc and series feed components", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "list"] },
    { id: "a", component: "Text", text: { "@call": "formatString", args: { value: "Hello ${/name}" } } },
    { id: "b", component: "Text", text: { "@call": "calc", args: { expression: "price * qty", price: { "@path": "/price" }, qty: 3 } } },
    { id: "list", component: "Column", children: { componentId: "row", path: "/rows" } },
    { id: "row", component: "Text", text: { "@path": "label" } },
  ], { name: "Ada", price: 4, rows: [{ label: "r1" }, { label: "r2" }] }));
  assert.deepEqual(d.errors, []);
  const text = d.container.textContent!;
  assert.match(text, /Hello Ada/);
  assert.match(text, /12/);
  assert.match(text, /r1.*r2/s);
  await d.append({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/price", value: 10 } });
  assert.match(d.container.textContent!, /30/, "a function result follows the data it reads");
  await d.unmount();
});
