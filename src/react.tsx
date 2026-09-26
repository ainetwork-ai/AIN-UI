"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { A2uiSurface, MarkdownContext, basicCatalog, createBinderlessComponentImplementation, useSignalValue } from "@a2ui/react/v0_9";
import { Catalog, CommonSchemas, MessageProcessor, type ComponentContext } from "@a2ui/web_core/v0_9";
import { z } from "zod";
import { renderMarkdown } from "@a2ui/markdown-it";
import { AINUI_CATALOG, AINUI_UPLOAD_MAX_BYTES, type AssetRef } from "./ainui.js";
import { ainuiFolderChat, type FolderChatState, type FolderChatAgent, type FolderChatMessage, type ChatUpdate } from "./chat.js";
import type { A2uiAction, A2uiMessage } from "./basic.js";

export type AssetResolver = (asset: AssetRef["$asset"], options?: { download?: boolean }) => string;
export type FileViewRenderer = (file: { src: string; download: string; name: string; mime: string; size?: number }) => React.ReactNode;
const FileRenderer = createContext<FileViewRenderer | undefined>(undefined);
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

function Glyph({ kind }: { kind: "grid" | "list" | "upload" | "folder" | "file" }) {
  const paths = { grid: "M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z", list: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01", upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5", folder: "M3 7V5h6l2 2h10v13H3z", file: "M5 3h9l5 5v13H5z M14 3v6h5" };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

const Toolbar = createBinderlessComponentImplementation(api("Toolbar", { children: CommonSchemas.ChildList }), ({ context, buildChild }) => {
  const spec = context.componentModel.properties.children as string[] | { componentId: string; path: string };
  const rows = useValue<unknown[]>(context, !Array.isArray(spec) && spec ? { path: spec.path } : []);
  return <div className="ainui-toolbar">{Array.isArray(spec) ? spec.map(id => <React.Fragment key={id}>{buildChild(id)}</React.Fragment>) :
    (Array.isArray(rows) ? rows : []).map((_, i) => <React.Fragment key={i}>{buildChild(spec.componentId, `${spec.path}/${i}`)}</React.Fragment>)}</div>;
});

const Grid = createBinderlessComponentImplementation(api("Grid", { children: CommonSchemas.ChildList, minItemWidth: z.number().optional(), gap: z.number().optional() }), ({ context, buildChild }) => {
  const p = context.componentModel.properties;
  const spec = p.children as string[] | { componentId: string; path: string };
  const rows = useValue<unknown[]>(context, !Array.isArray(spec) && spec ? { path: spec.path } : []);
  return <div className="ainui-grid" style={{ display: "grid", width: "100%", minWidth: 0, gridTemplateColumns: `repeat(auto-fill,minmax(min(100%,var(--ainui-tile-min,${Math.max(64, Number(p.minItemWidth) || 176)}px)),1fr))`, gap: Number(p.gap) || 20 }}>
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
  return <button type="button" className="ainui-tile" onClick={() => void fire(context)}>
    <span className="ainui-tile-media">
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> :
        <span className="ainui-tile-placeholder"><Glyph kind={kind === "folder" ? "folder" : "file"} /></span>}
    </span>
    <span className="ainui-tile-name" title={label}>{label}</span>
    <small className="ainui-tile-caption">{caption}</small>
  </button>;
});

const FileView = createBinderlessComponentImplementation(api("FileView", { src: dynamic, name: dynamic, mime: dynamic, size: dynamic }), ({ context }) => {
  const p = context.componentModel.properties;
  const asset = useValue(context, p.src);
  const name = useValue<string>(context, p.name);
  const mime = useValue<string>(context, p.mime) || "";
  const resolver = useContext(Assets);
  const src = urlOf(asset, resolver);
  const render = useContext(FileRenderer);
  const size = useValue<number>(context, p.size);
  if (render && src) return <>{render({ src, download: urlOf(asset, resolver, true), name, mime, size })}</>;
  return <div style={box}>
    {src && (mime.startsWith("image/") ? <img src={src} alt={name} style={{ maxHeight: "70vh", objectFit: "contain" }} /> :
      mime.startsWith("video/") ? <video controls src={src} /> : mime.startsWith("audio/") ? <audio controls src={src} /> :
        mime === "application/pdf" ? <iframe title={name} src={src} style={{ height: "70vh", border: 0 }} /> : null)}
    <strong>{name}</strong><a href={urlOf(asset, resolver, true)} download={name}>Download</a>
  </div>;
});

const Breadcrumbs = createBinderlessComponentImplementation(api("Breadcrumbs", { items: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const items = useValue<Array<{ label: string; path: string }>>(context, context.componentModel.properties.items) || [];
  return <nav aria-label="Folder path" className="ainui-breadcrumbs">{items.map((item, i) => <React.Fragment key={i}>
    {i > 0 && <span className="ainui-breadcrumb-separator" aria-hidden="true">/</span>}
    {i === items.length - 1 ? <span aria-current="page">{item.label}</span> :
      <button onClick={() => void fire(context, { path: item.path })}>{item.label === "/" ? "Drive" : item.label}</button>}
  </React.Fragment>)}</nav>;
});

const Segmented = createBinderlessComponentImplementation(api("Segmented", { options: z.array(z.object({ value: z.string(), label: z.string() })), value: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const p = context.componentModel.properties;
  const value = useValue<string>(context, p.value);
  return <div role="group" aria-label="View options" className="ainui-segmented">{(p.options as Array<{ value: string; label: string }>).map((o) =>
    <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => {
      const binding = p.value as { path?: string };
      if (binding?.path) context.dataContext.set(binding.path, o.value);
      void fire(context, { value: o.value });
    }}>{(o.value === "grid" || o.value === "list") && <Glyph kind={o.value} />}<span>{o.label}</span></button>)}</div>;
});

const FileUpload = createBinderlessComponentImplementation(api("FileUpload", { label: dynamic, maxBytes: z.number().optional(), action: CommonSchemas.Action.optional() }), ({ context }) => {
  const p = context.componentModel.properties;
  const label = useValue<string>(context, p.label) || "Upload file";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const limit = Math.min(Number(p.maxBytes) || AINUI_UPLOAD_MAX_BYTES, AINUI_UPLOAD_MAX_BYTES);
  return <div className="ainui-upload"><button className="ainui-button ainui-button-primary" type="button" disabled={busy} onClick={() => input.current?.click()}><Glyph kind="upload" />{busy ? "Uploading…" : label}</button><input ref={input} hidden tabIndex={-1} aria-label={label} type="file" disabled={busy} onChange={async (e) => {
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
  }} />{busy && <span className="ainui-sr-only" role="status">Uploading…</span>}{error && <small role="alert">{error}</small>}</div>;
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

const FolderChat = createBinderlessComponentImplementation(api("FolderChat", { value: dynamic, action: CommonSchemas.Action.optional() }), ({ context }) => {
  const state = useValue<FolderChatState>(context, context.componentModel.properties.value);
  const [input, setInput] = useState("");
  if (!state) return null;
  return <section aria-label="Folder chat" className="ainui-chat">
    <strong className="ainui-chat-title">{state.path.split("/").filter(Boolean).at(-1) || "Folder chat"}</strong>
    <label className="ainui-chat-agent">Agent <select aria-label="Chat agent" disabled={state.busy} value={state.agentId} onChange={e => void fire(context, { operation: "select", agentId: e.target.value })}>
      {state.agents.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
    </select></label>
    <div role="log" aria-live="polite" className="ainui-chat-log">
      {state.messages.map((m, i) => <div key={i} role={m.role === "error" ? "alert" : undefined} className={`ainui-chat-message ainui-chat-message-${m.role}`}><strong>{m.role === "user" ? "You" : m.role === "error" ? "Error" : state.agents.find(a => a.id === state.agentId)?.label || "Agent"}</strong>{m.role === "agent" ? <AgentText text={m.text} /> : <div className="ainui-chat-text">{m.text}</div>}</div>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); if (input.trim() && !state.busy) { void fire(context, { operation: "send", q: input.trim(), agentId: state.agentId }); setInput(""); } }} style={box}>
      <textarea aria-label="Message" placeholder="Ask about the files in this folder…" rows={3} disabled={state.busy} value={input} onChange={e => setInput(e.target.value)} />
      {state.busy ? <button type="button" className="ainui-button" onClick={() => void fire(context, { operation: "cancel" })}>Stop</button> : <button className="ainui-button ainui-button-primary" disabled={!input.trim() || !state.agentId}>Send</button>}
    </form>
  </section>;
});

// Preserve AIN-UI's confirmation extension on the basic Button.
const Button = createBinderlessComponentImplementation(api("Button", { child: CommonSchemas.ComponentId, action: CommonSchemas.Action.optional(), confirm: dynamic, variant: dynamic, tone: dynamic }), ({ context, buildChild }) => {
  const p = context.componentModel.properties;
  const confirm = useValue<string>(context, p.confirm);
  const variant = useValue<string>(context, p.variant);
  const tone = useValue<string>(context, p.tone);
  return <button className={`ainui-button ${variant === "primary" ? "ainui-button-primary" : variant === "borderless" ? "ainui-button-ghost" : ""} ${tone === "danger" ? "ainui-button-danger" : ""}`} onClick={() => { if (!confirm || window.confirm(confirm)) void fire(context); }}>{buildChild(String(p.child))}</button>;
});

export const ainuiCatalog = new Catalog(AINUI_CATALOG,
  [...basicCatalog.components.values()].filter((c) => c.name !== "Button").concat([Button, Toolbar, Grid, Tile, FileView, Breadcrumbs, Segmented, FileUpload, X402Payment, FolderChat]),
  [...basicCatalog.functions.values()]);

export function AinuiSurface({ messages, onAction, resolveAsset, renderFile }: {
  messages: A2uiMessage[];
  onAction: (action: A2uiAction) => void | Promise<void>;
  resolveAsset?: AssetResolver;
  renderFile?: FileViewRenderer;
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
  return <MarkdownContext.Provider value={renderMarkdown}><Assets.Provider value={resolveAsset ?? (() => "")}><FileRenderer.Provider value={renderFile}><div className="ain-ui">
    {Array.from(processor.model.surfacesMap.values()).map((surface) => <A2uiSurface key={surface.id} surface={surface} />)}
  </div></FileRenderer.Provider></Assets.Provider></MarkdownContext.Provider>;
}

export type FolderChatSend = (turn: { q: string; agentId: string; contextId?: string; signal: AbortSignal; onUpdate: (update: ChatUpdate) => void }) => Promise<ChatUpdate>;
/** Scope changes unmount the old chat, abort its request and drop its context ids. */
/**
 * An agent's message as Markdown — agents answer in it (headings, lists, tables, code). The same
 * markdown-it the A2UI Text component uses (it sanitizes); the plain text shows until the render lands, so a
 * streamed message never flickers to empty. A person's own message stays as typed.
 */
function AgentText({ text }: { text: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // an empty render (no live DOM for the sanitizer, a failure) shows the text as typed rather than nothing
    renderMarkdown(text).then(h => { if (live) setHtml(h && h.trim() ? h : null); }).catch(() => { if (live) setHtml(null); });
    return () => { live = false; };
  }, [text]);
  return html == null
    ? <div className="ainui-chat-text">{text}</div>
    : <div className="ainui-chat-text ainui-chat-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AinuiFolderChat(props: { driveId: string; path: string; agents: FolderChatAgent[]; onSend: FolderChatSend }) {
  return <FolderChatSession key={`${props.driveId}:${props.path}`} {...props} />;
}
function FolderChatSession({ driveId, path, agents, onSend }: { driveId: string; path: string; agents: FolderChatAgent[]; onSend: FolderChatSend }) {
  const [agentId, select] = useState(agents[0]?.id ?? "");
  const [messages, setMessages] = useState<FolderChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const contexts = useRef(new Map<string, string>());
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  const selected = agents.some(a => a.id === agentId) ? agentId : agents[0]?.id ?? "";
  const surface = ainuiFolderChat({ driveId, path, agents, agentId: selected, messages, busy });
  return <AinuiSurface messages={surface} onAction={async action => {
    const c = action.context ?? {};
    if (c.operation === "cancel") { pending.current?.abort(); return; }
    if (c.operation === "select" && !pending.current) { select(String(c.agentId)); setMessages([]); return; }
    if (c.operation !== "send" || pending.current || typeof c.q !== "string" || !selected) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true);
    setMessages(m => [...m.slice(-98), { role: "user", text: c.q as string }, { role: "agent", text: "" }]);
    const onUpdate = (u: ChatUpdate) => {
      if (pending.current !== controller || controller.signal.aborted) return;
      if (u.contextId) contexts.current.set(selected, u.contextId);
      setMessages(m => [...m.slice(0, -1), { role: "agent", text: u.text }]);
    };
    try { onUpdate(await onSend({ q: c.q, agentId: selected, contextId: contexts.current.get(selected), signal: controller.signal, onUpdate })); }
    catch (e) { if (pending.current === controller) setMessages(m => [...m, { role: "error", text: controller.signal.aborted ? "Stopped" : (e as Error).message }]); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }} />;
}
