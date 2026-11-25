/**
 * The agent side of AIN-UI: what a model is told, the `render_ui` tool it calls, and the check and compilation of
 * what it writes — built on Google's `@a2ui/agent`.
 *
 * Two formats. "express" is one line per component (`root = Column([Title("Hi"), Button("Go", onClick=Event("go"))])`),
 * compiled here into A2UI 1.0 messages; "json" is the messages themselves. Either way nothing reaches a renderer
 * before it has been validated against the catalog the renderer said it draws.
 *
 * Node or any server runtime; no DOM, no React.
 */
import {
  A2uiGenerator, Catalog, CatalogConfig, DirectJsonFormatFactory, ExpressFormatFactory, SkillGenerator,
  readRendererCapabilities, validatePayload, type A2uiRequestProcessor,
} from "@a2ui/agent";
import { AINUI_CATALOG_DOCUMENT } from "./catalog/standard.gen.js";
import { A2UI_VERSION, AINUI_CATALOG, type A2uiComponent, type A2uiMessage } from "./protocol.js";

export type UiFormat = "express" | "json";
export const RENDER_UI_TOOL = "render_ui";
/** Where a renderer's capabilities travel in request metadata (A2A `metadata`, AG-UI `forwardedProps`, MCP `_meta`). */
export const RENDERER_CAPABILITIES_KEY = "a2uiRendererCapabilities";

type Doc = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// ── macros ─────────────────────────────────────────────────────────────────

/**
 * A macro is one component the model writes that the server expands into several standard ones before anything is
 * sent: `WeatherReport("Lisbon")` instead of twenty lines. The renderer never sees the macro's name.
 */
export type Macro = {
  name: string;
  description: string;
  /** JSON Schema `properties` of the macro's own props. */
  props: Record<string, Doc>;
  required?: string[];
  /**
   * The components that replace the macro. The first one returned is the root and takes the macro's id; name the
   * others with `id(key)` — the same key gives the same id, so a parent can refer to a child it lists later.
   */
  expand: (props: Record<string, any>, id: (type: string) => string) => Array<Omit<A2uiComponent, "id"> & { id?: string }>;
};
export const defineMacro = (macro: Macro): Macro => macro;

const MACRO_DEPTH = 16;

/** Replaces every macro in a component list with its expansion, repeatedly, so a macro may use another. */
export function expandMacros(components: A2uiComponent[], macros: readonly Macro[]): A2uiComponent[] {
  if (!macros.length) return components;
  const byName = new Map(macros.map((m) => [m.name, m]));
  let list = components;
  for (let depth = 0; depth < MACRO_DEPTH; depth++) {
    if (!list.some((c) => byName.has(c.component))) return list;
    list = list.flatMap((c) => {
      const macro = byName.get(c.component);
      if (!macro) return [c];
      const { id, component: _component, ...props } = c;
      let n = 0;
      const made = macro.expand(props, (key) => `${id}__${key}`);
      if (!made.length) return [];
      return made.map((part, i) => ({ ...part, id: i === 0 ? id : part.id ?? `${id}__${part.component}_${++n}` }) as A2uiComponent);
    });
  }
  throw new Error(`macros nest deeper than ${MACRO_DEPTH} levels`);
}

function withMacros(doc: Doc, macros: readonly Macro[]): Doc {
  if (!macros.length) return doc;
  const next = clone(doc);
  for (const m of macros) {
    next.components[m.name] = { type: "object", description: m.description, properties: { component: { const: m.name }, ...m.props }, required: ["component", ...(m.required ?? [])] };
  }
  next.$defs = { ...next.$defs, anyComponent: { oneOf: Object.keys(next.components).map((name) => ({ $ref: `#/components/${name}` })) } };
  return next;
}

// ── catalogs ───────────────────────────────────────────────────────────────

/** The AINUI catalog document, optionally narrowed to some components (a smaller prompt, a stricter check). */
export function ainuiCatalogDocument(options: { components?: readonly string[] } = {}): Doc {
  const doc = clone(AINUI_CATALOG_DOCUMENT);
  if (options.components) {
    const keep = new Set(options.components);
    doc.components = Object.fromEntries(Object.entries(doc.components).filter(([name]) => keep.has(name)));
    doc.$defs.anyComponent = { oneOf: Object.keys(doc.components).map((name) => ({ $ref: `#/components/${name}` })) };
  }
  return doc;
}

/**
 * What the renderer on the other end said it can draw, read from request metadata. `undefined` means it did not
 * ask for A2UI: answer in text.
 */
export function rendererCapabilities(metadata: unknown): Record<string, any> | undefined {
  return readRendererCapabilities(metadata) as Record<string, any> | undefined;
}

/**
 * The catalog documents to write for, given a renderer's capabilities: the catalogs it sent inline (a browser that
 * brings its own design system), else AIN-UI's own when the renderer lists its id.
 */
export function catalogsFor(capabilities: Record<string, any> | undefined): Doc[] {
  const v1 = capabilities?.[A2UI_VERSION] ?? capabilities;
  const inline = Array.isArray(v1?.inlineCatalogs) ? (v1.inlineCatalogs as Doc[]).filter((c) => c && typeof c === "object" && c.components) : [];
  if (inline.length) return inline;
  const ids: unknown[] = Array.isArray(v1?.supportedCatalogIds) ? v1.supportedCatalogIds : [];
  return ids.includes(AINUI_CATALOG) ? [ainuiCatalogDocument()] : [];
}

// ── what the model is shown, and what it is forgiven ───────────────────────

const BOX_RARE = ["onVisible", "wrap", "rowGap", "columnGap", "borderColor", "minWidth", "maxWidth", "minHeight", "maxHeight", "weight", "aspectRatio",
  "scrollable", "clip", "shadow", "inline", "role", "flush", "minSize", "maxSize", "disableAutoSpacing"];

/**
 * The catalog as the model is told it: container components lose the twenty layout props almost no surface
 * needs (the same list on fourteen components is a third of the prompt). The renderer's catalog is unchanged, so
 * a surface that does use one of them is still valid.
 */
export function compactCatalogDocument(doc: Doc): Doc {
  const next = clone(doc);
  for (const c of Object.values<Doc>(next.components ?? {})) {
    const props = c.properties ?? {};
    if (BOX_RARE.filter((k) => k in props).length < 15) continue;
    for (const k of BOX_RARE) delete props[k];
  }
  return next;
}

const isObj = (v: unknown): v is Doc => !!v && typeof v === "object" && !Array.isArray(v);
const isDynamic = (v: unknown) => isObj(v) && (typeof v["@path"] === "string" || typeof v["@call"] === "string" || typeof v.event === "object" || typeof v.componentId === "string");
const alternatives = (schema: Doc | undefined): Doc[] => (!schema ? [] : schema.anyOf || schema.oneOf ? (schema.anyOf ?? schema.oneOf).flatMap(alternatives) : [schema]);
const typesOf = (schema: Doc) => (Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []);

/**
 * Forgives the two mistakes models make most and a renderer would reject outright: a key the schema does not
 * have (dropped) and a number written as a string (converted). Everything else is left for validation to refuse.
 */
function tidy(value: unknown, schema: Doc | undefined, notes: string[], where: string): unknown {
  const alts = alternatives(schema);
  if (!alts.length || isDynamic(value)) return value;
  if (Array.isArray(value)) {
    const list = alts.find((a) => typesOf(a).includes("array") && a.items);
    return list ? value.map((item, i) => tidy(item, list.items, notes, `${where}[${i}]`)) : value;
  }
  if (typeof value === "string" && !alts.some((a) => typesOf(a).includes("string") || "const" in a || a.enum)) {
    const shape = alts.find((a) => typesOf(a).includes("object") && a.properties && (a.required ?? []).length === 1);
    const only = shape?.required?.[0] as string | undefined;
    if (shape && only && alternatives(shape.properties[only]).some((a) => typesOf(a).includes("string"))) { notes.push(`${where} was text; read as {${only}}`); return { [only]: value }; }
  }
  if (isObj(value)) {
    const shapes = alts.filter((a) => typesOf(a).includes("object") && a.properties);
    const shape = shapes.find((a) => (a.required ?? []).every((k: string) => k in value)) ?? shapes[0];
    if (!shape) return value;
    const out: Doc = {};
    for (const [k, v] of Object.entries(value)) {
      if (!(k in shape.properties)) { if (shape.additionalProperties === false) { notes.push(`${where}.${k} is not a property; ignored`); continue; } out[k] = v; continue; }
      out[k] = tidy(v, shape.properties[k], notes, `${where}.${k}`);
    }
    return out;
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    const types = alts.flatMap(typesOf);
    if (!types.includes("string") && (types.includes("number") || types.includes("integer")) && !alts.some((a) => a.enum || "const" in a)) return Number(value);
  }
  return value;
}

/**
 * Reads JSON a model wrote as a string, repairing the one mistake it makes most: a closing bracket that does
 * not match (`…"/x"}}}}, {"id": …` inside an array, or `…}]}]` at the end). Such a closer is dropped and
 * counted; closers missing at the end are added. Strings are never touched, and anything else that does not
 * parse still fails.
 */
export function leadingJson(text: string): { value: unknown; trailing: number } | undefined {
  const src = text.trim();
  try { return { value: JSON.parse(src), trailing: 0 }; } catch { /* repair below */ }
  if (src[0] !== "[" && src[0] !== "{") return undefined;
  const stack: string[] = [];
  let out = "", dropped = 0, inString = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) out += src[++i];
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === "[" || ch === "{") {
      if (!stack.length && out.trim()) { dropped += src.length - i; break; }
      // `{` where an object expects a key (`…}}}, {"id": …`): the object before it was never closed. Close
      // objects up to the array the new item belongs in.
      if (ch === "{" && stack[stack.length - 1] === "}" && /,\s*$/.test(out) && stack.includes("]")) {
        while (stack[stack.length - 1] === "}") { out = out.replace(/,\s*$/, "") + stack.pop()!; dropped++; }
        out += ",";
      }
      stack.push(ch === "[" ? "]" : "}"); out += ch; continue;
    }
    if (ch === "]" || ch === "}") {
      if (stack[stack.length - 1] === ch) { stack.pop(); out += ch; } else dropped++;
      continue;
    }
    if (!stack.length && out.trim() && ch.trim()) { if (/^[\s,]*$/.test(src.slice(i))) break; return undefined; }
    out += ch;
  }
  while (stack.length) out += stack.pop();
  try { return { value: JSON.parse(out.replace(/,(\s*[\]}])/g, "$1")), trailing: dropped || 1 }; } catch { return undefined; }
}

/**
 * Messages that replace a surface the renderer already shows with a whole new one under the same id: delete it,
 * then create it again (1.0 allows the id again once it was deleted).
 */
export function replaceSurface(surfaceId: string, catalogId: string, components: A2uiComponent[], dataModel?: Record<string, unknown>): A2uiMessage[] {
  return [
    { version: A2UI_VERSION, deleteSurface: { surfaceId } },
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId, components, ...(dataModel ? { dataModel } : {}) } },
  ];
}

/** Names models use for a prop the catalog calls something else. Only applied when the component has the target. */
const PROP_ALIASES: Record<string, string[]> = { title: ["text", "label"], text: ["label", "title"], label: ["text", "title"], content: ["text"], name: ["label", "title"] };

/**
 * One keyword argument `name=` in the call of component `component`, removed or renamed. Calls are found by
 * `Component(`; arguments are split at top-level commas, so nested lists, maps and calls are skipped whole.
 */
function editExpressArgument(source: string, component: string, name: string, rename?: string): string | null {
  const edits: Array<{ from: number; to: number; text: string }> = [];
  const call = new RegExp(`\\b${component}\\(`, "g");
  const key = new RegExp(`^(\\s*)${name}(\\s*=)`);
  let match: RegExpExecArray | null;
  while ((match = call.exec(source))) {
    const args: Array<[number, number]> = [];
    let depth = 0, quote: string | null = null, from = match.index + match[0].length;
    for (let i = from; i < source.length; i++) {
      const ch = source[i];
      if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === "(" || ch === "[" || ch === "{") { depth++; continue; }
      if ((ch === ")" || ch === "]" || ch === "}") && depth > 0) { depth--; continue; }
      if (depth === 0 && (ch === "," || ch === ")")) { args.push([from, i]); from = i + 1; if (ch === ")") break; }
    }
    args.forEach(([a, b], n) => {
      const arg = source.slice(a, b);
      if (!key.test(arg)) return;
      if (rename) edits.push({ from: a, to: b, text: arg.replace(key, `$1${rename}$2`) });
      // drop the argument with the comma before it, or after it when it is the first one
      else if (n > 0) edits.push({ from: args[n - 1][1], to: b, text: "" });
      else edits.push({ from: a, to: args.length > 1 ? args[1][0] : b, text: "" });
    });
  }
  if (!edits.length) return null;
  let out = source;
  for (const e of edits.sort((x, y) => y.from - x.from)) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

/** A compiler complaint the source can be edited past, and the edited source. */
function repairExpress(source: string, error: string, docs: Doc[]): { source: string; note: string } | null {
  const props = (component: string) => Object.keys(docs.map((d) => d.components?.[component]).find(Boolean)?.properties ?? {});
  let m = /Property '(\w+)' is not a valid property of component '(\w+)'/.exec(error);
  if (m) {
    const [, prop, component] = m;
    const known = props(component);
    const target = (PROP_ALIASES[prop] ?? []).find((t) => known.includes(t));
    const next = editExpressArgument(source, component, prop, target);
    return next ? { source: next, note: target ? `${component}: ${prop}= read as ${target}=` : `${component}: ${prop}= is not a property; left out` } : null;
  }
  m = /Value '[^']*' is not a valid enum choice for property '(\w+)' of component '(\w+)'/.exec(error);
  if (m) {
    const next = editExpressArgument(source, m[2], m[1]);
    return next ? { source: next, note: `${m[2]}: ${m[1]}= had a value it does not take; left unset` } : null;
  }
  m = /Component '(\w+)' does not accept checks/.exec(error);
  if (m) {
    const next = editExpressArgument(source, m[1], "checks");
    return next ? { source: next, note: `${m[1]}: checks are not taken there; left out` } : null;
  }
  return null;
}

/**
 * A component written where the schema wants a list of plain objects: `actions=[Button("Buy", onClick=…)]`,
 * `StatGroup([Stat(…), Stat(…)])`. Express makes each a component of its own and leaves its id in the list,
 * which the renderer refuses. The component's own props become the list item, and the component goes.
 */
function inlineItemComponents(list: A2uiComponent[], docs: Doc[], notes: string[]): A2uiComponent[] {
  const byId = new Map(list.map((c) => [c.id, c]));
  const inlined = new Set<string>();
  const next = list.map((c) => {
    const schema = docs.map((d) => d.components?.[c.component]).find(Boolean) as Doc | undefined;
    if (!schema?.properties) return c;
    let changed: A2uiComponent | null = null;
    for (const [key, value] of Object.entries(c)) {
      if (!Array.isArray(value) || !value.some((v) => typeof v === "string" && byId.has(v))) continue;
      const prop = schema.properties[key] as Doc | undefined;
      if (!prop || /ChildList$|ComponentId$/.test(String(prop.$ref ?? ""))) continue;
      const list = alternatives(prop).find((a) => typesOf(a).includes("array") && a.items);
      const wantsObjects = list && alternatives(list.items).some((a) => typesOf(a).includes("object") && a.properties);
      if (!wantsObjects) continue;
      const item = alternatives(list.items).find((a) => typesOf(a).includes("object") && a.properties)!;
      changed ??= { ...c };
      (changed as Doc)[key] = value.map((v) => {
        const ref = typeof v === "string" ? byId.get(v) : undefined;
        if (!ref) return v;
        inlined.add(ref.id);
        const { id: _id, component: _component, ...props } = ref;
        // what the component called its words, the item may call label/title/text
        const own = Object.keys(item.properties);
        const out: Doc = {};
        for (const [k, x] of Object.entries(props)) {
          const target = own.includes(k) ? k : (PROP_ALIASES[k] ?? []).find((t) => own.includes(t));
          if (target && !(target in out)) out[target] = x; else if (k === "onClick" || k === "action") out[k] = x;
        }
        return out;
      });
    }
    return changed ?? c;
  });
  if (inlined.size) notes.push(`components used as list items became the items: ${[...inlined].slice(0, 6).join(", ")}`);
  return next.filter((c) => !inlined.has(c.id));
}

/** Where one component names another. */
const REF_KEYS = new Set(["children", "child", "trigger", "content", "componentId", "cellComponents"]);
const IDENT = /^[\p{ID_Start}_][\p{ID_Continue}]*$/u;

function mapRefs(value: unknown, key: string | undefined, fn: (id: string) => string): unknown {
  if (typeof value === "string") return key && REF_KEYS.has(key) ? fn(value) : value;
  if (Array.isArray(value)) return value.map((v) => mapRefs(v, key, fn));
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapRefs(v, k, fn)]));
  return value;
}

/**
 * Ids must be identifiers in 1.0 (`rec-title` is not); a model that writes one otherwise means the obvious thing.
 * Then components nothing refers to are left out — a renderer refuses a surface with an orphan in it.
 */
function tidyTree(list: A2uiComponent[], notes: string[], whole: boolean): A2uiComponent[] {
  const renamed = new Map<string, string>();
  const taken = new Set(list.map((c) => c.id));
  for (const c of list) {
    if (typeof c.id !== "string" || IDENT.test(c.id)) continue;
    let next = c.id.replace(/[^\p{ID_Continue}]/gu, "_").replace(/^(?![\p{ID_Start}_])/u, "_") || "_";
    while (taken.has(next)) next += "_";
    taken.add(next); renamed.set(c.id, next);
  }
  let out = list;
  if (renamed.size) {
    notes.push(`ids renamed to identifiers: ${[...renamed].slice(0, 4).map(([a, b]) => `${a} → ${b}`).join(", ")}${renamed.size > 4 ? ", …" : ""}`);
    out = list.map((c) => ({ ...(mapRefs(c, undefined, (id) => renamed.get(id) ?? id) as A2uiComponent), id: renamed.get(c.id) ?? c.id }));
  }
  if (!whole || !out.some((c) => c.id === "root")) return out;
  // A child named in a list that was never written is left out of the list, not fatal.
  const ids = new Set(out.map((c) => c.id));
  const missing = new Set<string>();
  out = out.map((c) => Array.isArray(c.children) && c.children.some((x) => typeof x === "string" && !ids.has(x))
    ? { ...c, children: (c.children as unknown[]).filter((x) => typeof x !== "string" || ids.has(x) || (missing.add(x), false)) } : c);
  if (missing.size) notes.push(`children never written, left out: ${[...missing].slice(0, 6).join(", ")}`);
  const byId = new Map(out.map((c) => [c.id, c]));
  const reached = new Set<string>();
  const visit = (id: string) => {
    const c = byId.get(id);
    if (!c || reached.has(id)) return;
    reached.add(id);
    mapRefs(c, undefined, (ref) => { visit(ref); return ref; });
  };
  visit("root");
  const orphans = out.filter((c) => !reached.has(c.id));
  if (orphans.length) notes.push(`not used by any parent, left out: ${orphans.map((c) => c.id).slice(0, 6).join(", ")}`);
  return orphans.length ? out.filter((c) => reached.has(c.id)) : out;
}

/**
 * Buttons inside a list prop (an EntityCard's `actions`) have no event of their own: the component sends one
 * `onAction` with the item that was pressed. Models write `onClick` on each item anyway; dropped, the buttons
 * would do nothing when clicked. So the first such event becomes the component's `onAction`.
 */
function hoistItemEvents(c: A2uiComponent, schema: Doc, notes: string[]): A2uiComponent {
  if (!("onAction" in (schema.properties ?? {})) || c.onAction) return c;
  for (const [key, value] of Object.entries(c)) {
    if (!Array.isArray(value)) continue;
    const item = value.find((v) => isObj(v) && ["onClick", "action", "onAction"].some((k) => isObj(v[k]) && isObj((v[k] as Doc).event)));
    if (!item) continue;
    const event = (["onClick", "action", "onAction"].map((k) => (item as Doc)[k]).find((v) => isObj(v) && isObj((v as Doc).event))) as Doc;
    notes.push(`${c.component} "${c.id}": the ${key} buttons' event became its onAction (the pressed one is in the context)`);
    return { ...c, onAction: { event: { name: event.event.name, ...(isObj(event.event.context) ? { context: event.event.context } : {}) } } };
  }
  return c;
}

const CHECK_MESSAGES: Record<string, string> = { required: "Required", email: "Enter a valid email address", regex: "Check the format", length: "Check the length", numeric: "Enter a number in range" };

/** The name a function call is written with: `@call`, or `call` as models also write it. */
const callName = (x: unknown): string | null => (isObj(x) && typeof (x["@call"] ?? x.call) === "string" ? String(x["@call"] ?? x.call) : null);

/** One `checks` entry as the catalog wants it: `{ condition, message }`, the condition a bare call or a path. */
function checkRule(x: unknown, where: string, notes: string[]): unknown {
  if (!isObj(x)) return x;
  const name = callName(x);
  if (name && !("condition" in x)) {
    const { message, ...call } = x;
    notes.push(`${where}: a check was written as the call itself; it became the check's condition`);
    return { condition: call, message: typeof message === "string" && message.trim() ? message : CHECK_MESSAGES[name] ?? "Check this value" };
  }
  if (isObj(x.condition) && callName(x.condition) && "message" in x.condition) {
    const { message, ...call } = x.condition;
    return { ...x, condition: call, message: typeof x.message === "string" && x.message.trim() ? x.message : typeof message === "string" ? message : CHECK_MESSAGES[callName(call)!] ?? "Check this value" };
  }
  return x;
}

/**
 * A Table's cells may hold components (`{"componentId": "b"}` in rows or columns), and the renderer counts them as
 * the table's only when they are also listed in `cellComponents`. Models list them in the rows and forget the list.
 */
function listTableCells(c: A2uiComponent, notes: string[]): A2uiComponent {
  if (c.component !== "Table") return c;
  const used: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v)) { if (typeof v.componentId === "string" && Object.keys(v).length <= 2) used.push(v.componentId); else Object.values(v).forEach(walk); }
  };
  walk(c.rows); walk(c.columns);
  const listed = Array.isArray(c.cellComponents) ? (c.cellComponents as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const missing = [...new Set(used)].filter((id) => !listed.includes(id));
  if (!missing.length) return c;
  notes.push(`Table "${c.id}": cell components added to cellComponents: ${missing.slice(0, 6).join(", ")}`);
  return { ...c, cellComponents: [...listed, ...missing] };
}

function tidyComponent(c: A2uiComponent, docs: Doc[], notes: string[]): A2uiComponent {
  const schema = docs.map((d) => d.components?.[c.component]).find(Boolean) as Doc | undefined;
  if (!schema?.properties) return c;
  c = listTableCells(c, notes);
  c = hoistItemEvents(c, schema, notes);
  const out: Doc = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === "id" || k === "component" || k.startsWith("@")) { out[k] = v; continue; }
    if (!(k in schema.properties)) { notes.push(`${c.component} "${c.id}": ${k} is not a property; ignored`); continue; }
    const prop = schema.properties[k] as Doc;
    // null for a prop that is optional and cannot be null means "not set"
    if (v === null && !(schema.required ?? []).includes(k) && !alternatives(prop).some((a) => typesOf(a).includes("null"))) { notes.push(`${c.component} "${c.id}": ${k} was null; left unset`); continue; }
    // children named as {componentId: "x"} or {id: "x"} instead of "x"
    if (Array.isArray(v) && /ChildList$/.test(String(prop.$ref ?? ""))) {
      out[k] = v.map((x) => (isObj(x) && typeof (x.componentId ?? x.id) === "string" && Object.keys(x).length === 1 ? (x.componentId ?? x.id) : x));
      continue;
    }
    // A validation check written as the bare function call — often with its message beside the call
    // ({"@call": "email", args, message}) — is the condition; the message belongs to the check, not to the call,
    // whose arguments the catalog checks strictly. A condition that itself carries the message is moved the same way.
    if (k === "checks" && Array.isArray(v)) {
      out[k] = v.map((x) => checkRule(x, `${c.component} "${c.id}"`, notes));
      continue;
    }
    out[k] = tidy(v, prop, notes, `${c.component} "${c.id}".${k}`);
  }
  return out as A2uiComponent;
}

// ── a compact catalog guide for the JSON format ────────────────────────────

function brief(schema: Doc | undefined, depth = 0): string {
  if (!schema || typeof schema !== "object") return "any";
  if (schema.$ref) return String(schema.$ref).split("/").pop()!;
  if ("const" in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((v: unknown) => JSON.stringify(v)).join("|");
  const alts: Doc[] | undefined = schema.anyOf ?? schema.oneOf;
  if (alts) {
    const parts = [...new Set(alts.map((a) => brief(a, depth + 1)).filter((p) => p !== "DataBinding" && p !== "FunctionCall"))];
    return parts.length > 1 ? parts.join(" | ") : parts[0] ?? "any";
  }
  if (schema.type === "array") { const item = brief(schema.items, depth + 1); return item.includes(" | ") ? `(${item})[]` : `${item}[]`; }
  if (schema.type === "object") {
    const props = Object.entries<Doc>(schema.properties ?? {});
    if (!props.length || depth > 6) return "object";
    const required = new Set<string>(schema.required ?? []);
    return `{ ${props.map(([k, v]) => `${k}${required.has(k) ? "" : "?"}: ${brief(v, depth + 1)}`).join(", ")} }`;
  }
  return Array.isArray(schema.type) ? schema.type.join("|") : String(schema.type ?? "any");
}

/** One line per component: name, what it is for, and its props with types. A fraction of the full JSON Schema. */
export function catalogGuide(doc: Doc): string {
  const lines: string[] = [];
  for (const [name, c] of Object.entries<Doc>(doc.components ?? {})) {
    const required = new Set<string>(c.required ?? []);
    const props = Object.entries<Doc>(c.properties ?? {}).filter(([k]) => k !== "component")
      .map(([k, v]) => `${k}${required.has(k) ? "" : "?"}: ${brief(v)}`).join("; ");
    lines.push(`- ${name} — ${String(c.description ?? "").replace(/\s+/g, " ").trim()}\n  props: ${props || "(none)"}`);
  }
  const functions = Object.entries<Doc>(doc.functions ?? {}).map(([name, f]) => `- ${name} — ${String(f.description ?? "").replace(/\s+/g, " ").trim()}`);
  return `### Components\n${lines.join("\n")}${functions.length ? `\n\n### Functions ({"@call": name, "args": {...}})\n${functions.join("\n")}` : ""}`;
}

const JSON_RULES = `## How to show UI

Call the \`${RENDER_UI_TOOL}\` tool with \`components\` (and \`data\` when values are bound). It shows one surface.

- \`components\` is a FLAT JSON array, never a string. Each item is {"id": "...", "component": "<Name>", ...props}. Exactly one has id "root". A parent names its children by id: "children": ["a","b"] or "child": "a". Never nest a component inside another.
- A value that comes from \`data\` is {"@path": "/pointer"} (inside a template, a relative name like {"@path": "name"}). To repeat a component for each item of a list in data: "children": {"componentId": "<id of the template>", "path": "/items"}.
- An input writes what the user types to the path its value is bound to. A button's event is "onClick": {"event": {"name": "<name>", "context": {"key": {"@path": "/x"}}}}; you receive it as the user's next message.
- Use only the components and props listed below, spelled exactly. Do not invent props; leave a prop out rather than guess its value.
- To change a surface you showed earlier instead of showing a new one, pass its \`surfaceId\` with the new \`components\` and/or \`data\`.`;

const EXPRESS_EXAMPLE = `title = Title("Team capacity")
note = Caption("Illustrative numbers")
tbl = Table(columns=["Person", "Role", "Load"], rows=[["Mina", "Design", "80%"], ["Jun", "Backend", "95%"]])
name = TextField(label="Add a person", value=$/draft/name)
add = Button("Add", variant="primary", onClick=Event("add_person", {name: $/draft/name}))
form = Row([name, add])
next = FollowUp(items=["Who is overloaded?", "Show it as a chart"])
root = Column([title, tbl, form, note, next])`;

const JSON_EXAMPLE = `{"components": [
 {"id": "root", "component": "Column", "children": ["title", "tbl", "form", "note", "next"]},
 {"id": "title", "component": "Title", "text": "Team capacity"},
 {"id": "tbl", "component": "Table", "columns": ["Person", "Role", "Load"], "rows": [["Mina", "Design", "80%"], ["Jun", "Backend", "95%"]]},
 {"id": "form", "component": "Row", "children": ["name", "add"]},
 {"id": "name", "component": "TextField", "label": "Add a person", "value": {"@path": "/draft/name"}},
 {"id": "add", "component": "Button", "label": "Add", "variant": "primary", "onClick": {"event": {"name": "add_person", "context": {"name": {"@path": "/draft/name"}}}}},
 {"id": "note", "component": "Caption", "text": "Illustrative numbers"},
 {"id": "next", "component": "FollowUp", "items": ["Who is overloaded?", "Show it as a chart"]}
], "data": {"draft": {"name": ""}}}`;

// ── the author ─────────────────────────────────────────────────────────────

export type UiAuthorOptions = {
  format?: UiFormat;
  /** Catalog documents to write for. Defaults to the AINUI catalog. Usually `catalogsFor(capabilities)`. */
  catalogs?: Doc[];
  macros?: readonly Macro[];
  /** Short worked examples, by name, appended to the prompt after the built-in one. */
  examples?: Record<string, string>;
  /** Tell the model the compact catalog (default). `false` lists every prop of every component. */
  compact?: boolean;
};

export type RenderUiCall = { express?: unknown; components?: unknown; data?: unknown; surfaceId?: unknown; messages?: unknown; ui?: unknown };
export type UiPart = { type: "text"; text: string } | { type: "a2ui"; messages: A2uiMessage[] };

export class UiError extends Error {
  /** Written for the model: what was wrong and how to say it again. */
  constructor(message: string, readonly cause?: unknown) { super(message); this.name = "UiError"; }
}

export type UiAuthor = {
  format: UiFormat;
  /** Append to the system prompt. */
  prompt: string;
  /** The `render_ui` tool in OpenAI function-calling shape. */
  tool: { type: "function"; function: { name: string; description: string; parameters: Doc } };
  /**
   * Validated A2UI 1.0 messages from a `render_ui` call. Throws `UiError` with a message to hand back to the model.
   * `notes` collects what was forgiven on the way (an unknown prop dropped, a number written as a string).
   */
  fromToolCall(args: RenderUiCall | string, notes?: string[]): A2uiMessage[];
  /** For models without tool calling: text with fenced UI blocks (`<a2ui>…</a2ui>`, `<a2ui-json>…</a2ui-json>`). */
  fromText(text: string): UiPart[];
  /** Ids of the catalogs this author writes for. */
  catalogIds: string[];
};

const surfaceIds = () => `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function describe(error: unknown): string {
  const e = error as { message?: string; issues?: unknown; errors?: unknown };
  const detail = Array.isArray(e?.errors) ? e.errors.map((x: any) => x?.message ?? String(x)).slice(0, 6).join("; ") : "";
  return [e?.message ?? String(error), detail].filter(Boolean).join(" — ").slice(0, 1600);
}

/** Everything one agent turn needs to let a model show UI in the given catalogs and format. */
export function createUiAuthor(options: UiAuthorOptions = {}): UiAuthor {
  const format = options.format ?? "express";
  const macros = options.macros ?? [];
  const full = options.catalogs?.length ? options.catalogs : [ainuiCatalogDocument()];
  /** What the model is told and what Express is parsed against: compact, with the macros. */
  const docs = full.map((d) => withMacros(options.compact === false ? d : compactCatalogDocument(d), macros));
  const catalogs = docs.map((d) => Catalog.fromJson(d, A2UI_VERSION));
  /** What the renderer will check against: the full catalogs, without the macros. */
  const wire = full.map((d) => Catalog.fromJson(d, A2UI_VERSION));
  const lenient = full.map((d) => withMacros(d, macros));
  const capabilities = { [A2UI_VERSION]: { supportedCatalogIds: catalogs.map((c) => c.id) } };
  const configs = catalogs.map((c) => new CatalogConfig(c as never));
  const express = new A2uiGenerator(configs, undefined, new ExpressFormatFactory({ version: A2UI_VERSION })).createProcessor(capabilities as never);
  const json = new A2uiGenerator(configs, undefined, new DirectJsonFormatFactory()).createProcessor(capabilities as never);
  const examples = Object.entries({ "a small surface": format === "express" ? EXPRESS_EXAMPLE : JSON_EXAMPLE, ...options.examples }).map(([name, body]) => `### Example: ${name}\n${body}`).join("\n\n");

  const finish = (messages: A2uiMessage[], notes: string[] = []): A2uiMessage[] => {
    const settle = (list: A2uiComponent[], whole: boolean) => expandMacros(tidyTree(inlineItemComponents(list, lenient, notes).map((c) => tidyComponent(c, lenient, notes)), notes, whole), macros);
    const expanded = messages.map((m) => {
      const anyM = m as Doc;
      if (anyM.createSurface?.components) return { ...anyM, createSurface: { ...anyM.createSurface, components: settle(anyM.createSurface.components, true) } };
      if (anyM.updateComponents?.components) return { ...anyM, updateComponents: { ...anyM.updateComponents, components: settle(anyM.updateComponents.components, false) } };
      return anyM;
    }) as A2uiMessage[];
    try { validatePayload(wire as never, expanded); }
    catch (e) { throw new UiError(`The UI was not valid for the catalog: ${describe(e)}. Fix it and call ${RENDER_UI_TOOL} again.`, e); }
    return expanded;
  };

  const compileExpress = (source: string, notes: string[] = []): A2uiMessage[] => {
    let body = source.replace(/^\s*<a2ui>\s*/, "").replace(/\s*<\/a2ui>\s*$/, "").replace(/^```[a-z0-9]*\n?/i, "").replace(/\n?```\s*$/, "");
    // The compiler is stricter than the renderer: an unknown or wrongly valued keyword argument stops the whole
    // surface. Such an argument is renamed when the meaning is plain (Heading title= → text=) or left out, and
    // the source compiled again; anything else is the model's to fix.
    for (let round = 0; ; round++) {
      try { return express.parser.compile(body, true) as unknown as A2uiMessage[]; }
      catch (e) {
        const fixed = round < 12 ? repairExpress(body, describe(e), docs) : null;
        if (!fixed) throw new UiError(`The A2UI Express did not compile: ${describe(e)}. Correct the syntax and call ${RENDER_UI_TOOL} again.`, e);
        notes.push(fixed.note);
        body = fixed.source;
      }
    }
  };
  const readJson = (value: unknown): A2uiMessage[] => {
    let parsed = value;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed.replace(/^\s*<a2ui-json>\s*/, "").replace(/\s*<\/a2ui-json>\s*$/, "").replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/, "")); }
      catch (e) { throw new UiError(`messages was not valid JSON: ${describe(e)}. Send a JSON array of A2UI messages.`, e); }
    }
    const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : null;
    if (!list?.length) throw new UiError("messages must be a non-empty JSON array of A2UI messages.");
    return list.map((m: Doc) => {
      const withVersion: Doc = { version: A2UI_VERSION, ...m };
      // A model that forgets the catalog still means the one it was told to use.
      if (withVersion.createSurface && !withVersion.createSurface.catalogId) withVersion.createSurface = { ...withVersion.createSurface, catalogId: catalogs[0].id };
      if (withVersion.createSurface && !withVersion.createSurface.surfaceId) withVersion.createSurface = { ...withVersion.createSurface, surfaceId: surfaceIds() };
      return withVersion as A2uiMessage;
    });
  };

  /** `{components, data, surfaceId?}` → one new surface, or an update of the surface named. */
  const fromParts = (args: RenderUiCall, notes: string[] = []): A2uiMessage[] => {
    const parse = (v: unknown, what: string) => {
      if (typeof v !== "string") return v;
      const lenient = leadingJson(v);
      if (lenient !== undefined) { if (lenient.trailing) notes.push(`${what} was sent as text with ${lenient.trailing} unmatched bracket(s); repaired`); return lenient.value; }
      try { return JSON.parse(v); } catch (e) { throw new UiError(`${what} was a string that is not valid JSON (${describe(e)}). Pass ${what} as a JSON ${what === "data" ? "object" : "array"}, not as text.`, e); }
    };
    const components = parse(args.components, "components"), data = parse(args.data, "data");
    if (components !== undefined && !Array.isArray(components)) throw new UiError("components must be a JSON array of {id, component, ...props}.");
    if (data !== undefined && data !== null && !isObj(data)) throw new UiError("data must be a JSON object.");
    const list = (components as Doc[] | undefined)?.map((c) => (isObj(c) ? c : {})) as A2uiComponent[] | undefined;
    if (typeof args.surfaceId === "string" && args.surfaceId) {
      const surfaceId = args.surfaceId;
      // A whole new screen for that surface (it has a root): the old one is replaced, not patched — what the
      // new root no longer reaches would be left behind as orphans, which a renderer refuses.
      if (list?.some((c) => c.id === "root")) return replaceSurface(surfaceId, catalogs[0].id, list, data as Doc | undefined);
      return [
        ...(list?.length ? [{ version: A2UI_VERSION, updateComponents: { surfaceId, components: list } }] : []),
        ...(data ? [{ version: A2UI_VERSION, updateDataModel: { surfaceId, path: "/", value: data } }] : []),
      ];
    }
    if (!list?.length) throw new UiError("components must have at least the root component.");
    if (!list.some((c) => c.id === "root")) throw new UiError(`One component must have the id "root" (the top of the surface). Yours are: ${list.map((c) => c.id).slice(0, 12).join(", ")}.`);
    return [{ version: A2UI_VERSION, createSurface: { surfaceId: surfaceIds(), catalogId: catalogs[0].id, components: list, ...(data ? { dataModel: data as Doc } : {}) } }];
  };

  const unique = (messages: A2uiMessage[]): A2uiMessage[] => {
    // Express compiles every block to the same default surface id, and a renderer rejects a second createSurface
    // with an id it already has: each call gets its own.
    const renamed = new Map<string, string>();
    return messages.map((m) => {
      const anyM = m as Doc;
      const key = ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"].find((k) => anyM[k]);
      if (!key) return m;
      const id = anyM[key].surfaceId as string;
      if (key === "createSurface" && format === "express") renamed.set(id, surfaceIds());
      return renamed.has(id) ? ({ ...anyM, [key]: { ...anyM[key], surfaceId: renamed.get(id) } } as A2uiMessage) : m;
    });
  };

  const prompt = format === "express"
    ? `${express.promptSnippet}\n\nShow UI by calling the \`${RENDER_UI_TOOL}\` tool with \`express\`: the A2UI Express source, without the <a2ui> tags.${examples ? `\n\n${examples}` : ""}`
    : `${JSON_RULES}\n\n${docs.map((d) => `## Catalog ${d.catalogId}\n\n${d.instructions ? `${d.instructions}\n\n` : ""}${catalogGuide(d)}`).join("\n\n")}${examples ? `\n\n${examples}` : ""}`;

  const tool = {
    type: "function" as const,
    function: {
      name: RENDER_UI_TOOL,
      description: "Show the user an interactive UI surface (cards, tables, charts, forms, files, payment) instead of describing it in text. Call it once per surface; say a sentence of text before or after, not instead.",
      parameters: format === "express"
        ? { type: "object", properties: { express: { type: "string", description: "A2UI Express source. One statement per line; the entry point is assigned to `root`." } }, required: ["express"], additionalProperties: false }
        : { type: "object", properties: {
          // `items` is left open on purpose: a model held to a schema writes only the properties the schema names.
          components: { type: "array", items: { type: "object", additionalProperties: true }, description: "The flat list of components: {\"id\": ..., \"component\": ..., ...props}. One has id \"root\"." },
          data: { type: "object", description: "The data model that {\"@path\": ...} bindings read and inputs write." },
          surfaceId: { type: "string", description: "Only to change a surface you showed earlier: its id." },
        }, required: ["components"] },
    },
  };

  return {
    format, prompt, tool, catalogIds: catalogs.map((c) => c.id),
    fromToolCall(raw, notes) {
      let args: RenderUiCall;
      if (typeof raw === "string") { try { args = JSON.parse(raw); } catch { args = format === "express" ? { express: raw } : { messages: raw }; } }
      else args = raw ?? {};
      const source = args.express ?? args.ui;
      if (typeof source === "string" && source.trim() && !/^\s*[[{]/.test(source)) return finish(unique(compileExpress(source, notes)), notes);
      if (args.components !== undefined || args.data !== undefined) return finish(fromParts(args, notes), notes);
      const payload = args.messages ?? args.ui ?? args.express;
      if (payload === undefined || payload === null || payload === "") throw new UiError(`${RENDER_UI_TOOL} needs ${format === "express" ? "`express`" : "`components`"}.`);
      return finish(readJson(payload), notes);
    },
    fromText(text) {
      const parts: UiPart[] = [];
      const pattern = /<a2ui>([\s\S]*?)<\/a2ui>|<a2ui-json>([\s\S]*?)<\/a2ui-json>/g;
      let last = 0, m: RegExpExecArray | null;
      while ((m = pattern.exec(text))) {
        const before = text.slice(last, m.index).trim();
        if (before) parts.push({ type: "text", text: before });
        parts.push({ type: "a2ui", messages: m[1] !== undefined ? finish(unique(compileExpress(m[1], []))) : finish(readJson(m[2])) });
        last = m.index + m[0].length;
      }
      const rest = text.slice(last).trim();
      if (rest) parts.push({ type: "text", text: rest });
      return parts;
    },
  };
}

/** The Express source that compiles to these messages — for showing both forms side by side. */
export function toExpress(messages: readonly A2uiMessage[], catalogs: Doc[] = [ainuiCatalogDocument()]): string {
  const list = catalogs.map((d) => new CatalogConfig(Catalog.fromJson(d, A2UI_VERSION) as never));
  const processor: A2uiRequestProcessor = new A2uiGenerator(list, undefined, new ExpressFormatFactory({ version: A2UI_VERSION }))
    .createProcessor({ [A2UI_VERSION]: { supportedCatalogIds: list.map((c) => c.catalog.id) } } as never);
  return processor.parser.decompile(messages as never);
}

/**
 * Agent skill files (Markdown) that teach a coding agent or another model to write for these catalogs:
 * `{ filename: content }`.
 */
export function exportSkills(options: { format?: UiFormat; catalogs?: Doc[]; macros?: readonly Macro[] } = {}): Record<string, string> {
  const docs = (options.catalogs?.length ? options.catalogs : [ainuiCatalogDocument()]).map((d) => withMacros(d, options.macros ?? []));
  const catalogs = docs.map((d) => Catalog.fromJson(d, A2UI_VERSION));
  const factory = options.format === "json" ? new DirectJsonFormatFactory() : new ExpressFormatFactory({ version: A2UI_VERSION });
  const generator = new SkillGenerator(factory.createFormat(catalogs as never));
  return generator.generateSkillSet({ catalogs: catalogs as never }).toDict();
}
