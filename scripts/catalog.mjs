// dist/catalog.json: the AINUI catalog document for A2UI 1.0, as agents and other renderers read it.
import { writeFileSync } from "node:fs";
import { AINUI_CATALOG_DOCUMENT } from "../dist/catalog/standard.gen.js";
writeFileSync(new URL("../dist/catalog.json", import.meta.url), JSON.stringify(AINUI_CATALOG_DOCUMENT, null, 2) + "\n");
// The AINUI v1 catalog (A2UI v0.9), as ain-ui 0.3.0 published it, for hosts that still serve it.
import { copyFileSync } from "node:fs";
copyFileSync(new URL("../src/catalog/ainui-v1.json", import.meta.url), new URL("../dist/catalog-v1.json", import.meta.url));
