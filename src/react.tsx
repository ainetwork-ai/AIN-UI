"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { A2uiSurface, MarkdownContext, basicCatalog, createBinderlessComponentImplementation, useSignalValue } from "@a2ui/react/v0_9";
import { Catalog, CommonSchemas, MessageProcessor, type ComponentContext } from "@a2ui/web_core/v0_9";
import { z } from "zod";
import { renderMarkdown } from "@a2ui/markdown-it";
import { AINUI_CATALOG, AINUI_UPLOAD_MAX_BYTES, type AssetRef } from "./ainui.js";
import type { A2uiAction, A2uiMessage } from "./basic.js";

export type AssetResolver = (asset: AssetRef["$asset"], options?: { download?: boolean }) => string;
const Assets = createContext<AssetResolver>(() => "");
const box: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };
const button: React.CSSProperties = { padding: "8px 12px", border: "1px solid #8885", borderRadius: 8, color: "inherit", background: "transparent" };

function useValue<T = unknown>(ctx: ComponentContext, raw: unknown): T {
  const signal = useMemo(() => ctx.dataContext.resolveSignal<T>(raw as never), [ctx, raw]);
  return useSignalValue(signal);
}

function urlOf(value: unknown, resolver: AssetResolver, download = false): string {
  const raw = value && typeof value === "object" && "$asset" in value
    ? resolver((value as AssetRef).$asset, { download }) : value;
  if (typeof raw !== "string") return "";
  if (/^\/(?!\/)/.test(raw) || /^https?:\/\//i.test(raw) || /^blob:/i.test(raw)) return raw;
  return "";
}

async function fire(ctx: ComponentContext, extra: Record<string, unknown> = {}) {
  const raw = ctx.componentModel.properties.action;
  if (!raw) return;
  const action = ctx.dataContext.resolveAction(raw as never);
  if (action?.event) await ctx.dispatchAction({ event: { ...action.event, context: { ...action.event.context, ...extra } } });
}

// A2UI owns state, bindings, action validation and surface lifecycle. These
// implementations add only AIN-UI's component views to the official catalog.
const api = (name: string, shape: z.ZodRawShape) => ({ name, schema: z.object(shape).passthrough() });
const dynamic = z.union([CommonSchemas.DynamicValue, z.object({ $asset: z.object({
  drive_id: z.string(), path: z.string(), variant: z.enum(["thumb", "original"]), mime: z.string(), v: z.number().optional(),
}) }), z.null()]).optional();

const Grid = createBinderlessComponentImplementation(api("Grid", { children: CommonSchemas.ChildList, minItemWidth: z.number().optional(), gap: z.number().optional() }), ({ context, buildChild }) => {
  const p = context.componentModel.properties;
  const spec = p.children as string[] | { componentId: string; path: string };
  const rows = useValue<unknown[]>(context, !Array.isArray(spec) && spec ? { path: spec.path } : []);
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${Math.max(64, Number(p.minItemWidth) || 128)}px),1fr))`, gap: Number(p.gap) || 8 }}>
    {Array.isArray(spec) ? spec.map((id) => <React.Fragment key={id}>{buildChild(id)}</React.Fragment>) :
      (Array.isArray(rows) ? rows : []).map((_, i) => <React.Fragment key={i}>{buildChild(spec.componentId, `${spec.path}/${i}`)}</React.Fragment>)}
  </div>;
});

const Tile = createBinderlessComponentImplementation(api("Tile", { media: dynamic, label: dynamic, caption: dynamic, kind: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const p = context.componentModel.properties;
  const media = useValue(context, p.media);
  const label = useValue<string>(context, p.label);
  const caption = useValue<string>(context, p.caption);
  const kind = useValue<string>(context, p.kind);
  const resolver = useContext(Assets);
  const src = urlOf(media, resolver);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <button style={{ ...box, ...button, textAlign: "left" }} onClick={() => void fire(context)}>
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} /> :
      <span style={{ fontSize: 40, padding: 24 }}>{kind === "folder" ? "📁" : "📄"}</span>}
    <span style={{ overflowWrap: "anywhere" }}>{label}</span><small>{caption}</small>
  </button>;
});

const FileView = createBinderlessComponentImplementation(api("FileView", { src: dynamic, name: dynamic, mime: dynamic, size: dynamic }), ({ context }) => {
  const p = context.componentModel.properties;
  const asset = useValue(context, p.src);
  const name = useValue<string>(context, p.name);
  const mime = useValue<string>(context, p.mime) || "";
  const resolver = useContext(Assets);
  const src = urlOf(asset, resolver);
  return <div style={box}>
    {src && (mime.startsWith("image/") ? <img src={src} alt={name} style={{ maxHeight: "70vh", objectFit: "contain" }} /> :
      mime.startsWith("video/") ? <video controls src={src} /> : mime.startsWith("audio/") ? <audio controls src={src} /> :
        mime === "application/pdf" ? <iframe title={name} src={src} style={{ height: "70vh", border: 0 }} /> : null)}
    <strong>{name}</strong><a href={urlOf(asset, resolver, true)} download={name}>Download</a>
  </div>;
});

const Breadcrumbs = createBinderlessComponentImplementation(api("Breadcrumbs", { items: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const items = useValue<Array<{ label: string; path: string }>>(context, context.componentModel.properties.items) || [];
  return <nav aria-label="Folder path" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{items.map((item, i) =>
    i === items.length - 1 ? <span key={i} aria-current="page">{item.label}</span> :
      <button key={i} style={button} onClick={() => void fire(context, { path: item.path })}>{item.label}</button>)}</nav>;
});

const Segmented = createBinderlessComponentImplementation(api("Segmented", { options: z.array(z.object({ value: z.string(), label: z.string() })), value: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const p = context.componentModel.properties;
  const value = useValue<string>(context, p.value);
  return <div role="group" style={{ display: "flex", gap: 4 }}>{(p.options as Array<{ value: string; label: string }>).map((o) =>
    <button key={o.value} style={{ ...button, fontWeight: value === o.value ? "bold" : "normal" }} aria-pressed={value === o.value} onClick={() => {
      const binding = p.value as { path?: string };
      if (binding?.path) context.dataContext.set(binding.path, o.value);
      void fire(context, { value: o.value });
    }}>{o.label}</button>)}</div>;
});

const FileUpload = createBinderlessComponentImplementation(api("FileUpload", { label: dynamic, maxBytes: z.number().optional(), action: CommonSchemas.Action.optional() }), ({ context }) => {
  const p = context.componentModel.properties;
  const label = useValue<string>(context, p.label) || "Upload file";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const limit = Math.min(Number(p.maxBytes) || AINUI_UPLOAD_MAX_BYTES, AINUI_UPLOAD_MAX_BYTES);
  return <label style={box}>{label}<input type="file" disabled={busy} onChange={async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > limit) { setError(`Maximum file size: ${limit / 1024 / 1024} MiB`); return; }
    setBusy(true); setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await fire(context, { name: file.name, content: btoa(binary), encoding: "base64" });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }} />{busy && <small>Uploading…</small>}{error && <small role="alert">{error}</small>}</label>;
});

const X402Payment = createBinderlessComponentImplementation(api("X402Payment", { amount: dynamic, currency: dynamic, network: dynamic, payTo: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const p = context.componentModel.properties;
  const amount = useValue<string>(context, p.amount);
  const currency = useValue<string>(context, p.currency);
  const network = useValue<string>(context, p.network);
  const payTo = useValue<string>(context, p.payTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div style={box}>
    <strong>{amount} {currency}</strong><small>Network: {network}</small><small style={{ overflowWrap: "anywhere" }}>To: {payTo}</small>
    <button style={button} disabled={busy} onClick={async () => {
      if (busy) return;
      setBusy(true); setError("");
      try { await fire(context); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? "Confirm in your wallet…" : `Pay ${amount} ${currency}`}</button>
    {error && <small role="alert">{error}</small>}
  </div>;
});

// Preserve AIN-UI's confirmation extension on the basic Button.
const Button = createBinderlessComponentImplementation(api("Button", { child: CommonSchemas.ComponentId, action: CommonSchemas.Action.optional(), confirm: dynamic, variant: dynamic, tone: dynamic }), ({ context, buildChild }) => {
  const p = context.componentModel.properties;
  const confirm = useValue<string>(context, p.confirm);
  return <button style={button} onClick={() => { if (!confirm || window.confirm(confirm)) void fire(context); }}>{buildChild(String(p.child))}</button>;
});

export const ainuiCatalog = new Catalog(AINUI_CATALOG,
  [...basicCatalog.components.values()].filter((c) => c.name !== "Button").concat([Button, Grid, Tile, FileView, Breadcrumbs, Segmented, FileUpload, X402Payment]),
  [...basicCatalog.functions.values()]);

export function AinuiSurface({ messages, onAction, resolveAsset }: {
  messages: A2uiMessage[];
  onAction: (action: A2uiAction) => void | Promise<void>;
  resolveAsset?: AssetResolver;
}) {
  const handler = useRef(onAction);
  handler.current = onAction;
  const [processor, setProcessor] = useState<MessageProcessor<typeof Button> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const p = new MessageProcessor([ainuiCatalog, basicCatalog], (action) => handler.current(action));
    try { p.processMessages(messages); setProcessor(p); setError(""); }
    catch (e) { setProcessor(null); setError((e as Error).message); }
    return () => { for (const surface of p.model.surfacesMap.values()) surface.dispose(); };
  }, [messages]);
  if (error) return <div className="ain-ui" role="alert">{error}</div>;
  if (!processor) return <div className="ain-ui" aria-busy="true" />;
  return <MarkdownContext.Provider value={renderMarkdown}><Assets.Provider value={resolveAsset ?? (() => "")}><div className="ain-ui">
    {Array.from(processor.model.surfacesMap.values()).map((surface) => <A2uiSurface key={surface.id} surface={surface} />)}
  </div></Assets.Provider></MarkdownContext.Provider>;
}
