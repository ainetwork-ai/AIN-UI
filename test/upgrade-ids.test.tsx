import { test } from "node:test";
import assert from "node:assert/strict";
import { draw } from "./support/harness.js";
import { A2UI_BASIC_CATALOG_V09, AINUI_CATALOG_V1, upgradeMessages } from "../src/index.js";

test("v0.9 → 1.0: ids that are not identifiers are renamed with their references, null props are left out (seen in ainmem)", async () => {
  const v09 = [
    { version: "v0.9", createSurface: { surfaceId: "album", catalogId: AINUI_CATALOG_V1 } },
    { version: "v0.9", updateComponents: { surfaceId: "album", components: [
      { id: "root", component: "Grid", minItemWidth: 160, gap: 6, children: ["tile-0", "tile-1"] },
      { id: "tile-0", component: "Tile", media: null, label: "A", kind: "image", action: { event: { name: "open", context: { index: 0 } } } },
      { id: "tile-1", component: "Tile", media: "/files/b.jpg", label: "B", kind: "image" },
    ] } },
    { version: "v0.9", updateComponents: { surfaceId: "album", components: [{ id: "tile-1", component: "Tile", label: "B2", kind: "image" }] } },
    { version: "v0.9", createSurface: { surfaceId: "other", catalogId: A2UI_BASIC_CATALOG_V09 } },
    { version: "v0.9", updateComponents: { surfaceId: "other", components: [
      { id: "root", component: "List", listStyle: "bullet", children: { componentId: "row-x", path: "/rows" } },
      { id: "row-x", component: "Text", text: { path: "t" } },
    ] } },
  ];
  const up = upgradeMessages(v09) as any[];
  assert.deepEqual(up[1].updateComponents.components.map((c: any) => c.id), ["root", "tile_0", "tile_1"]);
  assert.deepEqual(up[1].updateComponents.components[0].children, ["tile_0", "tile_1"]);
  assert.equal("media" in up[1].updateComponents.components[1], false);
  assert.equal(up[2].updateComponents.components[0].id, "tile_1", "a later update of the same surface uses the same name");
  assert.deepEqual(up[4].updateComponents.components[0].children, { componentId: "row_x", path: "/rows" });
  assert.equal("listStyle" in up[4].updateComponents.components[0], false);

  const d = await draw(v09);
  assert.deepEqual(d.errors, []);
  assert.equal(d.$$(".ainui-tile").length, 2);
  await d.click(".ainui-tile");
  assert.equal(d.actions[0].name, "open");
  await d.unmount();
});
