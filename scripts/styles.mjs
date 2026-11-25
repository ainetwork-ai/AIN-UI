// dist/styles.css = the token sheet, the AIN component styles, then one sheet per standard group.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = new URL("../src/styles/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css")).sort();
const tokens = sheets.filter((f) => f.startsWith("00-"));
const rest = sheets.filter((f) => !f.startsWith("00-"));
const read = (f) => readFileSync(new URL(f, dir), "utf8").trim();
writeFileSync(new URL("../dist/styles.css", import.meta.url),
  [...tokens.map(read), readFileSync(new URL("../src/styles.css", import.meta.url), "utf8").trim(), ...rest.map(read)].join("\n\n") + "\n");
