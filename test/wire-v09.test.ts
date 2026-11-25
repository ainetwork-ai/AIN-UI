import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  A2UI_BASIC_CATALOG_V09, AINUI_CATALOG, AINUI_CATALOG_V1, a2uiForSkill, a2uiWireVersion, ainuiFolder, ainuiPayment, asAinui, setA2uiWireVersion, toItem,
} from "../src/index.js";

test("with the wire set to v0.9, builders emit what ain-ui 0.x did; 1.0 is the default", () => {
  const items = [toItem("d1", "a.txt", { name: "a.txt", isDir: false, size: 3 }, {})];
  assert.equal(a2uiWireVersion(), "1.0");
  const modern = ainuiFolder({ driveId: "d1", path: "", items });
  assert.ok(modern.every((m) => m.version === "1.0"));
  assert.equal((modern[0] as any).createSurface.catalogId, AINUI_CATALOG);
  setA2uiWireVersion("v0.9");
  try {
    const legacy = ainuiFolder({ driveId: "d1", path: "", items }) as any[];
    assert.ok(legacy.every((m) => m.version === "v0.9"));
    assert.deepEqual(legacy.map((m) => Object.keys(m)[1]), ["createSurface", "updateComponents", "updateDataModel"]);
    assert.equal(legacy[0].createSurface.catalogId, AINUI_CATALOG_V1);
    assert.ok(!JSON.stringify(legacy).includes('"@path"'), "bindings are {path}, as in v0.9");
    const basic = a2uiForSkill("list_files", { drive_id: "d1", path: "" }, { kind: "ok", text: "", structured: { entries: [] } }, "d1") as any[];
    assert.equal(basic[0].createSurface.catalogId, A2UI_BASIC_CATALOG_V09);
    assert.equal((asAinui(basic as never) as any[])[0].createSurface.catalogId, AINUI_CATALOG_V1, "asAinui keeps the version it was given");
    const required = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "10000", asset: "0xa", payTo: "0xb", maxTimeoutSeconds: 300 }] };
    const pay = ainuiPayment({ shareToken: "t", title: "Report", required: required as never, paymentRequired: "q", symbol: "USDC", decimals: 6 }) as any[];
    assert.equal(pay[1].updateComponents.components[1].variant, "h3", "a v0.9 heading stays Text with its variant");
  } finally { setA2uiWireVersion("1.0"); }
  assert.throws(() => setA2uiWireVersion("v2" as never));
});

test("the AINUI v1 catalog document ships beside v2", () => {
  const v1 = JSON.parse(readFileSync(new URL("../src/catalog/ainui-v1.json", import.meta.url), "utf8"));
  assert.equal(v1.catalogId, AINUI_CATALOG_V1);
  assert.ok(v1.components.FilePicker && v1.components.Tile);
});
