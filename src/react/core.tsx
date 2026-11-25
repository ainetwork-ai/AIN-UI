"use client";

/**
 * What every AIN-UI React component is built from.
 *
 * A2UI owns state, bindings, validation and the surface lifecycle (`@a2ui/web_core`); `@a2ui/react` turns a
 * component's properties into resolved React props. A view here receives `props` with every binding already
 * resolved, a `setX` for each bindable `x`, an action as a function, and children as ids to hand to `buildChild`.
 */
import React, { createContext, useContext } from "react";
import { Catalog, type ComponentContext } from "@a2ui/web_core";
import { createComponentImplementation, type ReactComponentImplementation } from "@a2ui/react";
import { AINUI_CATALOG_DOCUMENT } from "../catalog/standard.gen.js";
import type { AssetRef } from "../ainui.js";

/** The AINUI catalog as published: names, props and descriptions. Views are attached in ./catalog.ts. */
export const STANDARD = Catalog.fromJson(AINUI_CATALOG_DOCUMENT, "1.0");

export type ChildRef = string | { id: string; basePath?: string };
export type BuildChild = (id: string, basePath?: string) => React.ReactNode;
export type ViewProps<P = Record<string, any>> = {
  props: P & Record<string, any>;
  buildChild: BuildChild;
  /** For an action that needs extra context (see `fire`) or the raw, unresolved properties. */
  context: ComponentContext;
  accessibilityRef?: (element: Element | null) => void;
  validationErrorsRef?: (element: Element | null) => void;
};

/**
 * Inspect mode (`<AinuiSurface inspect>`): every component is drawn inside an element that names it —
 * `data-ainui-id` and `data-ainui-component` on a `display: contents` span, so it adds no box and moves nothing —
 * letting a host find which component the pointer is over (`event.target.closest("[data-ainui-id]")`).
 * Off by default: a surface drawn for people has no extra elements.
 */
export const InspectContext = createContext(false);

/** A view for one component of the catalog. The name must exist in standard.json or ain.json. */
export function standard<P = Record<string, any>>(name: string, View: React.FC<ViewProps<P>>): ReactComponentImplementation {
  const api = STANDARD.components.get(name);
  if (!api) throw new Error(`"${name}" is not in the AINUI catalog`);
  View.displayName = name;
  const Tagged: React.FC<ViewProps<P>> = (props) => {
    const inspect = useContext(InspectContext);
    if (!inspect) return <View {...props} />;
    const id = props.context?.componentModel?.id;
    return <span data-ainui-id={id} data-ainui-component={name} style={{ display: "contents" }}><View {...props} /></span>;
  };
  Tagged.displayName = name;
  return createComponentImplementation(api as never, Tagged as never);
}

/** One child, by the reference the binder resolved: an id, or a template instance `{id, basePath}`. */
export const kid = (buildChild: BuildChild, ref: ChildRef | undefined | null): React.ReactNode =>
  ref == null || ref === "" ? null : typeof ref === "string" ? buildChild(ref) : buildChild(ref.id, ref.basePath);

/** A resolved child list, in order. */
export function Kids({ of, buildChild }: { of: unknown; buildChild: BuildChild }) {
  const list = Array.isArray(of) ? (of as ChildRef[]) : [];
  return <>{list.map((ref, i) => <React.Fragment key={typeof ref === "string" ? ref : `${ref.id}:${ref.basePath ?? i}`}>{kid(buildChild, ref)}</React.Fragment>)}</>;
}

export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

/** Spacing: a number is 4px steps, a string is CSS as written. */
export const space = (v: unknown): string | undefined => (typeof v === "number" ? `${v * 4}px` : typeof v === "string" && v ? v : undefined);
/** Size: a number is pixels, a string is CSS as written. */
export const px = (v: unknown): string | undefined => (typeof v === "number" ? `${v}px` : typeof v === "string" && v ? v : undefined);

const RADIUS: Record<string, string> = { "2xs": "2px", xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px", "2xl": "20px", "3xl": "24px", "4xl": "32px", full: "9999px" };
export function radius(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return `${v}px`;
  if (typeof v === "string") return RADIUS[v] ?? v;
  const r = v as Record<string, string>;
  const one = (x?: string) => (x ? RADIUS[x] ?? x : "0");
  return `${one(r.topLeft)} ${one(r.topRight)} ${one(r.bottomRight)} ${one(r.bottomLeft)}`;
}

const TONES = ["info", "success", "warning", "caution", "danger", "discovery", "primary", "secondary"];
/** A colour token (`success`, `danger`, `muted`, `surface-secondary`, `info-solid`, …) or any CSS colour. */
export function color(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  if (v === "default" || v === "surface") return "var(--ainui-surface)";
  if (v === "surface-secondary" || v === "subtle") return "var(--ainui-surface-2)";
  if (v === "strong") return "var(--ainui-border-strong)";
  if (v === "muted" || v === "tertiary") return "var(--ainui-muted)";
  if (v.endsWith("-solid") && TONES.includes(v.slice(0, -6))) return `var(--ainui-${v.slice(0, -6)})`;
  if (TONES.includes(v)) return `var(--ainui-${v})`;
  return v;
}
/** Background for a tone: the soft tint, or the solid colour for `x-solid`. */
export function surfaceColor(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  if (TONES.includes(v)) return `var(--ainui-${v}-soft)`;
  return color(v);
}

const ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", baseline: "baseline", stretch: "stretch" };
const JUSTIFY: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", spaceBetween: "space-between", spaceAround: "space-around", spaceEvenly: "space-evenly", stretch: "stretch" };

/**
 * The layout props every container shares (gap, padding, background, border, radius, sizes, flex, scrolling) as
 * inline style. Containers pass their own defaults first: `{ ...defaults, ...boxStyle(props) }`.
 */
export function boxStyle(p: Record<string, any>): React.CSSProperties {
  const s: React.CSSProperties = {};
  const set = (k: keyof React.CSSProperties, v: unknown) => { if (v !== undefined && v !== null && v !== "") (s as Record<string, unknown>)[k] = v; };
  set("alignItems", ALIGN[p.align]); set("justifyContent", JUSTIFY[p.justify]); set("flexWrap", p.wrap);
  set("gap", space(p.gap)); set("rowGap", space(p.rowGap)); set("columnGap", space(p.columnGap)); set("padding", space(p.padding));
  set("background", surfaceColor(p.background));
  if (p.border) set("border", `1px solid ${color(p.borderColor) && p.borderColor !== "default" ? color(p.borderColor) : "var(--ainui-border)"}`);
  set("borderRadius", radius(p.radius));
  set("width", px(p.width)); set("height", px(p.height)); set("minWidth", px(p.minWidth ?? p.minSize)); set("maxWidth", px(p.maxWidth ?? p.maxSize));
  set("minHeight", px(p.minHeight)); set("maxHeight", px(p.maxHeight));
  if (typeof (p.flex ?? p.weight) === "number") { set("flex", `${p.flex ?? p.weight} 1 0%`); if (s.minWidth === undefined) s.minWidth = 0; }
  set("aspectRatio", p.aspectRatio);
  if (p.scrollable) set("overflow", "auto"); else if (p.clip) set("overflow", "hidden");
  if (p.shadow) set("boxShadow", "var(--ainui-shadow)");
  if (p.inline) set("display", "inline-flex");
  return s;
}

/**
 * Sends the component's action with extra context merged in — a follow-up's text, the id of the row that was
 * clicked. For an action that needs nothing extra, call the resolved prop (`props.onClick?.()`) instead.
 */
export async function fire(context: ComponentContext, prop: string, extra: Record<string, unknown> = {}): Promise<void> {
  const raw = (context.componentModel.properties as Record<string, unknown>)[prop];
  if (!raw) return;
  const action = context.dataContext.resolveAction(raw as never, { userActivation: true } as never) as { event?: { name: string; context?: Record<string, unknown> } } | undefined;
  const resolved = action && typeof (action as { then?: unknown }).then === "function" ? await (action as unknown as Promise<typeof action>) : action;
  if (resolved?.event) await context.dispatchAction({ event: { ...resolved.event, context: { ...resolved.event.context, ...extra } } } as never);
}

/** The data-model path a property is bound to, or undefined for a literal. */
export function boundPath(context: ComponentContext, prop: string): string | undefined {
  const raw = (context.componentModel.properties as Record<string, unknown>)[prop] as { "@path"?: string; path?: string } | undefined;
  return raw && typeof raw === "object" ? raw["@path"] ?? (typeof raw.path === "string" && Object.keys(raw).length === 1 ? raw.path : undefined) : undefined;
}

export type AssetResolver = (asset: AssetRef["$asset"], options?: { download?: boolean }) => string;
export type FileViewRenderer = (file: { src: string; download: string; name: string; mime: string; size?: number }) => React.ReactNode;
/** What the host application lends to components. Everything is optional; a missing one degrades quietly. */
export type Host = {
  /** Turns a private asset reference into a URL the viewer is authorized to load. */
  resolveAsset: AssetResolver;
  renderFile?: FileViewRenderer;
  /** A follow-up pill or suggestion: send this text as the user's next message. */
  sendMessage?: (text: string) => void;
  /** Open a link. Defaults to a new tab with `noopener`. */
  openUrl?: (href: string) => void;
};
export const HostContext = createContext<Host>({ resolveAsset: () => "" });
export const useHost = () => useContext(HostContext);

/** Only http(s), site-relative and blob URLs are drawn; anything else (javascript:, data:) is dropped. */
export function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v) || /^blob:/i.test(v) ? v : "";
}
/** A media value: a URL, or a private asset reference resolved by the host. */
export function mediaUrl(value: unknown, host: Host, download = false): string {
  const raw = value && typeof value === "object" && "$asset" in value ? host.resolveAsset((value as AssetRef).$asset, { download }) : value;
  return safeUrl(raw);
}
export function openUrl(host: Host, href: unknown) {
  const url = safeUrl(href);
  if (!url) return;
  if (host.openUrl) host.openUrl(url); else globalThis.open?.(url, "_blank", "noopener,noreferrer");
}
