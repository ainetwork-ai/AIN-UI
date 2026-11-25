import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";

test("layout: containers apply the shared box props and render their children in order", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", gap: 3, padding: 4, children: ["row", "grid", "card", "div", "tabs"] },
    { id: "row", component: "Row", justify: "spaceBetween", children: ["a", "sp", "b"] },
    { id: "a", component: "Text", text: "left" }, { id: "sp", component: "Spacer" }, { id: "b", component: "Text", text: "right" },
    { id: "grid", component: "Grid", columns: 2, children: { componentId: "cell", path: "/items" } },
    { id: "cell", component: "GridItem", children: ["cellText"] }, { id: "cellText", component: "Text", text: { "@path": "name" } },
    { id: "card", component: "Card", variant: "outline", child: "inCard" }, { id: "inCard", component: "Text", text: "in card" },
    { id: "div", component: "Divider" },
    { id: "tabs", component: "Tabs", tabs: [{ title: "One", child: "p1" }, { title: "Two", child: "p2" }] },
    { id: "p1", component: "Text", text: "panel one" }, { id: "p2", component: "Text", text: "panel two" },
  ], { items: [{ name: "x" }, { name: "y" }] }));
  assert.deepEqual(d.errors, []);
  const col = d.$(".ainui-column")!;
  assert.equal(col.style.gap, "12px"); assert.equal(col.style.padding, "16px");
  assert.equal(d.$(".ainui-row")!.style.justifyContent, "space-between");
  assert.equal(d.$(".ainui-grid")!.style.gridTemplateColumns, "repeat(2, minmax(0, 1fr))");
  assert.equal(d.$$(".ainui-grid-item").length, 2);
  assert.match(d.$(".ainui-card.ainui-card-outline")!.textContent!, /in card/);
  assert.ok(d.$("[role=separator]"));
  assert.match(d.$("[role=tabpanel]")!.textContent!, /panel one/);
  await d.click("[role=tab]:nth-child(2)");
  assert.match(d.$("[role=tabpanel]")!.textContent!, /panel two/);
  await d.unmount();
});

test("layout: a carousel moves with its arrows and writes the slide index back", async () => {
  const d = await draw(surface([
    { id: "root", component: "Carousel", label: "Photos", activeIndex: { "@path": "/i" }, children: ["s1", "s2"] },
    { id: "s1", component: "CarouselItem", children: ["t1"] }, { id: "t1", component: "Text", text: "one" },
    { id: "s2", component: "CarouselMediaItem", url: "https://example.test/a.jpg", description: "A" },
  ], { i: 0 }));
  assert.deepEqual(d.errors, []);
  assert.equal(d.$$(".ainui-carousel-item").length, 2);
  assert.equal(d.$<HTMLImageElement>(".ainui-carousel-media img")!.getAttribute("src"), "https://example.test/a.jpg");
  assert.equal(d.$<HTMLButtonElement>(".ainui-carousel-prev")!.disabled, true);
  await d.click(".ainui-carousel-next");
  assert.equal(d.$<HTMLButtonElement>(".ainui-carousel-next")!.disabled, true, "the bound index moved to the last slide");
  await d.unmount();
});
