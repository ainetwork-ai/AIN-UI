import { writeFileSync } from "node:fs";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import { ainuiCatalog } from "../dist/react.js";
const p = new MessageProcessor([ainuiCatalog]);
const catalog = p.getClientCapabilities({ includeInlineCatalogs: true })["v0.9"].inlineCatalogs[0];
writeFileSync(new URL("../dist/catalog.json", import.meta.url), JSON.stringify(catalog, null, 2) + "\n");
