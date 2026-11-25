import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";

const components = [
  { id: "root", component: "Column", children: ["title", "go"] },
  { id: "title", component: "Heading", text: "Hello" },
  { id: "go", component: "Button", label: "Go", onClick: { event: { name: "go" } } },
];

test("inspect tags every drawn component with its id and name, without adding a box", async () => {
  const drawn = await draw(surface(components), { inspect: true });
  const tagged = [...drawn.container.querySelectorAll("[data-ainui-id]")];
  assert.deepEqual(tagged.map((el) => `${el.getAttribute("data-ainui-id")}:${el.getAttribute("data-ainui-component")}`), ["root:Column", "title:Heading", "go:Button"]);
  for (const el of tagged) assert.equal((el as HTMLElement).style.display, "contents");
  const button = drawn.container.querySelector("button");
  assert.equal(button?.closest("[data-ainui-id]")?.getAttribute("data-ainui-id"), "go", "a host finds the component under the pointer with closest()");
});

test("without inspect a surface has no extra elements", async () => {
  const drawn = await draw(surface(components));
  assert.equal(drawn.container.querySelectorAll("[data-ainui-id]").length, 0);
});
