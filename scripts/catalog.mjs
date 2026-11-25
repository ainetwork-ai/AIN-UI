// dist/catalog.json: the AINUI catalog document for A2UI 1.0, as agents and other renderers read it.
import { writeFileSync } from "node:fs";
import { AINUI_CATALOG_DOCUMENT } from "../dist/catalog/standard.gen.js";
writeFileSync(new URL("../dist/catalog.json", import.meta.url), JSON.stringify(AINUI_CATALOG_DOCUMENT, null, 2) + "\n");
