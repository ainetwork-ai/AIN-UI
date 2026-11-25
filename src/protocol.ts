/**
 * A2UI wire versions and the conversion between them.
 *
 * AIN-UI speaks A2UI 1.0. Producers written against v0.9 (and AINUI v1, its catalog) still work: `upgradeMessages`
 * rewrites what they send into 1.0, position by position — the spec forbids a blanket rename, because `path` in
 * `updateDataModel` and in a child template stays `path` while a data binding becomes `@path`.
 *
 * Pure: no IO, no DOM.
 */

export const A2UI_VERSION = "1.0" as const;
export const A2UI_V09 = "v0.9" as const;
export const A2UI_MIME = "application/a2ui+json";
/** The MIME type v0.9 used; still accepted on input. */
export const A2UI_MIME_V09 = "application/json+a2ui";
export const A2UI_BASIC_CATALOG = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";
export const A2UI_BASIC_CATALOG_V09 = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
/** AIN-UI's catalog for A2UI 1.0: the standard components plus the AIN ones (files, upload, payment, pickers). */
export const AINUI_CATALOG = "https://ainui.ainetwork.xyz/catalogs/ainui/v2/catalog.json";
/** AINUI v1 (A2UI v0.9). Surfaces that name it are upgraded to the v2 catalog. */
export const AINUI_CATALOG_V1 = "https://aindrive.ainetwork.ai/ainui/v1/catalog.json";

export type A2uiComponent = { id: string; component: string } & Record<string, unknown>;
export type A2uiMessage =
  | { version: string; createSurface: { surfaceId: string; catalogId?: string; components?: A2uiComponent[]; dataModel?: Record<string, unknown>; sendDataModel?: boolean; metadata?: Record<string, unknown> } }
  | { version: string; updateComponents: { surfaceId: string; components: A2uiComponent[] } }
  | { version: string; updateDataModel: { surfaceId: string; path?: string; value?: unknown } }
  | { version: string; deleteSurface: { surfaceId: string } };

/** Renderer→agent user action. */
export type A2uiAction = {
  name: string;
  surfaceId?: string;
  sourceComponentId?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const only = (o: Record<string, unknown>, ...keys: string[]) => Object.keys(o).every((k) => keys.includes(k));

/** A v0.9 data binding is `{path}` and nothing else; a child template has `componentId` beside it. */
const isBinding09 = (v: unknown): v is { path: string } => isObject(v) && typeof v.path === "string" && only(v, "path");
const isCall09 = (v: unknown): v is { call: string; args?: unknown; returnType?: unknown } =>
  isObject(v) && typeof v.call === "string" && only(v, "call", "args", "returnType");
const isTemplate = (v: unknown) => isObject(v) && typeof v.componentId === "string" && typeof v.path === "string";

/** Rewrites bindings and function calls inside one property value. Literal data is left as it is. */
function upgradeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(upgradeValue);
  if (!isObject(v)) return v;
  if (isBinding09(v)) return { "@path": v.path };
  if (isCall09(v)) return { "@call": v.call, ...(v.args === undefined ? {} : { args: upgradeValue(v.args) }) };
  if (isTemplate(v)) return v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, upgradeValue(x)]));
}

const HEADING = /^h([1-5])$/;
const TITLE_SIZE: Record<string, string> = { 1: "2xl", 2: "xl", 3: "lg", 4: "md", 5: "sm" };

/** Text in v0.9 carried headings as `variant: h1…h5`; 1.0 keeps only `caption` and `body`. */
function upgradeText(c: A2uiComponent, toAinui: boolean): A2uiComponent {
  const { variant, ...rest } = c;
  const level = typeof variant === "string" ? HEADING.exec(variant)?.[1] : undefined;
  if (toAinui) {
    if (level) return { ...rest, component: "Title", size: TITLE_SIZE[level] };
    if (variant === "caption") return { ...rest, component: "Caption" };
    return rest as A2uiComponent;
  }
  if (level) {
    // The basic catalog renders Markdown in Text.text: a heading is `#` marks before the words.
    const marks = "#".repeat(Number(level)) + " ";
    const t = rest.text;
    const bound = isObject(t) && typeof t["@path"] === "string";
    return { ...rest, text: bound ? { "@call": "formatString", args: { value: `${marks}\${${t["@path"]}}` } } : `${marks}${String(t ?? "")}` } as A2uiComponent;
  }
  return (variant === "caption" || variant === "body" ? { ...rest, variant } : rest) as A2uiComponent;
}

function upgradeComponent(c: A2uiComponent, toAinui: boolean): A2uiComponent {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === "id" || k === "component") out[k] = v;
    else if (k === "checks") out["@checks"] = upgradeValue(v);
    else if (k === "accessibility") out["@accessibility"] = upgradeValue(v);
    else out[k] = upgradeValue(v);
  }
  let next = out as A2uiComponent;
  if (next.component === "Text") next = upgradeText(next, toAinui);
  if (next.component === "TextField") {
    if (typeof next.validationRegexp === "string") {
      const { validationRegexp, ...rest } = next;
      next = { ...rest, "@checks": [...((rest["@checks"] as unknown[]) ?? []), { condition: { "@call": "regex", args: { value: rest.value, pattern: validationRegexp } }, message: "Invalid format" }] } as A2uiComponent;
    }
    if (next.value === undefined) next = { ...next, value: "" };
  }
  return next;
}

const catalogFor = (id: string | undefined) => (id === A2UI_BASIC_CATALOG_V09 ? A2UI_BASIC_CATALOG : id === AINUI_CATALOG_V1 ? AINUI_CATALOG : id);

/** Is this message written for a version before 1.0? */
export const isLegacyMessage = (m: unknown) => isObject(m) && typeof m.version === "string" && m.version !== A2UI_VERSION;

/**
 * v0.9 (and v0.9.1) messages → 1.0. Messages already at 1.0 pass through untouched, so a mixed list is fine.
 * A v0.9 surface that names the basic catalog moves to the 1.0 basic catalog; one that names AINUI v1 moves to v2.
 */
export function upgradeMessages(messages: readonly unknown[]): A2uiMessage[] {
  const ainui = new Map<string, boolean>();
  return messages.map((raw) => {
    if (!isLegacyMessage(raw)) return raw as A2uiMessage;
    const m = raw as Record<string, any>;
    if (m.createSurface) {
      const { theme: _theme, ...rest } = m.createSurface;
      const catalogId = catalogFor(rest.catalogId);
      ainui.set(rest.surfaceId, catalogId === AINUI_CATALOG);
      return { version: A2UI_VERSION, createSurface: { ...rest, ...(catalogId ? { catalogId } : {}),
        ...(rest.components ? { components: rest.components.map((c: A2uiComponent) => upgradeComponent(c, catalogId === AINUI_CATALOG)) } : {}) } };
    }
    if (m.updateComponents) {
      const toAinui = ainui.get(m.updateComponents.surfaceId) ?? false;
      return { version: A2UI_VERSION, updateComponents: { ...m.updateComponents, components: (m.updateComponents.components ?? []).map((c: A2uiComponent) => upgradeComponent(c, toAinui)) } };
    }
    if (m.updateDataModel) {
      // 1.0 requires `value`; null deletes the key, which is what an absent value meant in v0.9.
      return { version: A2UI_VERSION, updateDataModel: { ...m.updateDataModel, value: m.updateDataModel.value === undefined ? null : m.updateDataModel.value } };
    }
    return { ...m, version: A2UI_VERSION } as A2uiMessage;
  });
}

function downgradeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(downgradeValue);
  if (!isObject(v)) return v;
  if (typeof v["@path"] === "string" && only(v, "@path")) return { path: v["@path"] };
  if (typeof v["@call"] === "string") return { call: v["@call"], ...(v.args === undefined ? {} : { args: downgradeValue(v.args) }) };
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k === "@checks" ? "checks" : k === "@accessibility" ? "accessibility" : k, downgradeValue(x)]));
}

/**
 * 1.0 messages in the layout the dependency-free DOM renderer works with: one message per operation, bindings
 * as `{path}`. A `createSurface` that carries its components and data is split into the three operations.
 */
export function flattenMessages(messages: readonly unknown[]): A2uiMessage[] {
  const out: A2uiMessage[] = [];
  for (const raw of upgradeMessages(messages) as Record<string, any>[]) {
    if (raw.createSurface) {
      const { components, dataModel, ...rest } = raw.createSurface;
      out.push({ version: A2UI_VERSION, createSurface: rest });
      if (components) out.push({ version: A2UI_VERSION, updateComponents: { surfaceId: rest.surfaceId, components: components.map(downgradeValue) } });
      if (dataModel !== undefined) out.push({ version: A2UI_VERSION, updateDataModel: { surfaceId: rest.surfaceId, path: "/", value: dataModel } });
    } else if (raw.updateComponents) {
      out.push({ version: A2UI_VERSION, updateComponents: { ...raw.updateComponents, components: raw.updateComponents.components.map(downgradeValue) } });
    } else out.push(raw as A2uiMessage);
  }
  return out;
}

/**
 * Accept the shapes renderers actually send: a client event `{version, action}`, a bare `action` object,
 * `{action}`, or AG-UI/CopilotKit's `{userAction}` (forwardedProps.a2uiAction).
 */
export function parseA2uiAction(input: unknown): A2uiAction | null {
  if (!isObject(input)) return null;
  const candidate = (input.action ?? input.userAction ?? input) as Record<string, unknown>;
  if (typeof candidate?.name !== "string") return null;
  const context = isObject(candidate.context) ? candidate.context : {};
  return { ...candidate, name: candidate.name, context } as A2uiAction;
}

/** The 1.0 envelope a renderer sends for a user action. */
export const actionMessage = (action: A2uiAction) => ({ version: A2UI_VERSION, action: { timestamp: new Date().toISOString(), ...action } });
