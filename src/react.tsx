"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { A2uiSurface, MarkdownContext, basicCatalog, createBinderlessComponentImplementation, useSignalValue } from "@a2ui/react/v0_9";
import { Catalog, CommonSchemas, MessageProcessor, type ComponentContext } from "@a2ui/web_core/v0_9";
import { z } from "zod";
import { renderMarkdown } from "@a2ui/markdown-it";
import { AINUI_CATALOG, AINUI_UPLOAD_MAX_BYTES, type AssetRef } from "./ainui.js";
import { ainuiFolderChat, type FolderChatState, type FolderChatAgent, type FolderChatMessage, type ChatUpdate } from "./chat.js";
import {
  AGENT_SCOPES, AGENT_STATUS_LABEL, AVAILABILITY_LABEL, FILE_SCOPES, MORE_LABEL, PAID_BADGE, ROLE_LABEL, SHARE_ORIGIN_LABEL, VISIBILITY_LABEL,
  agentKey, agentPickReason, capabilityLines, fileKey, filePickReason, type AgentListItem, type FileListItem,
} from "./pickers.js";
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
      {state.messages.map((m, i) => <div key={i} role={m.role === "error" ? "alert" : undefined} className={`ainui-chat-message ainui-chat-message-${m.role}`}><strong>{m.role === "user" ? "You" : m.role === "error" ? "Error" : state.agents.find(a => a.id === state.agentId)?.label || "Agent"}</strong><div>{m.text}</div></div>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); if (input.trim() && !state.busy) { void fire(context, { operation: "send", q: input.trim(), agentId: state.agentId }); setInput(""); } }} style={box}>
      <textarea aria-label="Message" placeholder="Ask about the files in this folder…" rows={3} disabled={state.busy} value={input} onChange={e => setInput(e.target.value)} />
      {state.busy ? <button type="button" className="ainui-button" onClick={() => void fire(context, { operation: "cancel" })}>Stop</button> : <button className="ainui-button ainui-button-primary" disabled={!input.trim() || !state.agentId}>Send</button>}
    </form>
  </section>;
});

// ── Pickers (docs §3 FilePicker / AgentPicker) ─────────────────────────────
// Every action is a fixed `ainui.picker.*` name (PICKER_ACTIONS) with the
// component's `context` merged in. Refs are dispatched whole, as listed.
const dynRecord = z.union([z.record(z.any()), CommonSchemas.DynamicValue]).optional();

function usePickerContext(ctx: ComponentContext): Record<string, unknown> {
  const raw = ctx.componentModel.properties.context;
  const bound = useValue<unknown>(ctx, raw && typeof raw === "object" && "path" in (raw as object) ? raw : undefined);
  const value = bound ?? (raw && typeof raw === "object" && !("path" in (raw as object)) ? raw : {});
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickerDispatch(ctx: ComponentContext, base: Record<string, unknown>, name: string, context: Record<string, unknown>) {
  return ctx.dispatchAction({ event: { name, context: { ...base, ...context } } });
}

function PickerHeader({ ctx, base, kind, scopes, scope, query, asOf, cursorExpired }: {
  ctx: ComponentContext; base: Record<string, unknown>; kind: "file" | "agent"; scopes: ReadonlyArray<{ value: string; label: string }>;
  scope: string; query: string; asOf?: string; cursorExpired: boolean;
}) {
  // Uncontrolled on purpose: the query is only read on submit; a new listing (new `query`) remounts the field.
  const field = useRef<HTMLInputElement>(null);
  return <>
    <div role="tablist" aria-label={kind === "file" ? "파일 범위" : "에이전트 범위"} className="ainui-picker-scopes">
      {scopes.map((s) => <button key={s.value} type="button" role="tab" aria-selected={scope === s.value} className="ainui-picker-scope"
        onClick={() => { if (scope !== s.value) void pickerDispatch(ctx, base, "ainui.picker.scope", { kind, scope: s.value }); }}>{s.label}</button>)}
    </div>
    <form role="search" className="ainui-picker-search" onSubmit={(e) => { e.preventDefault(); void pickerDispatch(ctx, base, "ainui.picker.search", { kind, query: (field.current?.value ?? "").trim() }); }}>
      <input key={query} ref={field} type="search" aria-label="검색" placeholder={kind === "file" ? "파일 이름 검색" : "에이전트 검색"} defaultValue={query} />
      <button type="submit" className="ainui-button">검색</button>
    </form>
    {(asOf || cursorExpired) && <div className="ainui-picker-asof">
      {asOf && <small>기준 시각: <time dateTime={asOf}>{asOf}</time></small>}
      {cursorExpired && <button type="button" className="ainui-button" onClick={() => void pickerDispatch(ctx, base, "ainui.picker.more", { kind, cursor: null })}>목록이 만료됨 — 처음부터 다시 불러오기</button>}
    </div>}
  </>;
}

function PickerMore({ ctx, base, kind, cursor }: { ctx: ComponentContext; base: Record<string, unknown>; kind: "file" | "agent"; cursor: unknown }) {
  if (typeof cursor !== "string" || !cursor) return null;
  return <button type="button" className="ainui-button ainui-picker-more" onClick={() => void pickerDispatch(ctx, base, "ainui.picker.more", { kind, cursor })}>{MORE_LABEL}</button>;
}

const Badge = ({ tone, children }: { tone?: "warn" | "muted" | "danger"; children: React.ReactNode }) =>
  <span className={`ainui-picker-badge${tone ? ` ainui-picker-badge-${tone}` : ""}`}>{children}</span>;

const FilePicker = createBinderlessComponentImplementation(api("FilePicker", {
  items: dynamic, scope: dynamic, query: dynamic, cursor: dynamic, asOf: dynamic, cursorExpired: dynamic,
  selection: dynamic, selected: dynamic, context: dynRecord,
}), ({ context: ctx }) => {
  const p = ctx.componentModel.properties;
  const items = useValue<FileListItem[]>(ctx, p.items);
  const scope = useValue<string>(ctx, p.scope) ?? "mine";
  const query = useValue<string>(ctx, p.query) ?? "";
  const cursor = useValue<unknown>(ctx, p.cursor);
  const asOf = useValue<string>(ctx, p.asOf);
  const cursorExpired = useValue<boolean>(ctx, p.cursorExpired) === true;
  const selection = useValue<string>(ctx, p.selection) === "multiple" ? "multiple" : "single";
  const preselected = useValue<string[]>(ctx, p.selected);
  const base = usePickerContext(ctx);
  const [chosen, setChosen] = useState<string[]>(() => Array.isArray(preselected) ? preselected : []);
  useEffect(() => { setChosen(Array.isArray(preselected) ? preselected : []); }, [preselected]);
  const rows = Array.isArray(items) ? items.filter((i): i is FileListItem => !!i && !!i.ref) : [];
  const pick = (refs: FileListItem["ref"][]) => pickerDispatch(ctx, base, "ainui.picker.pick", { kind: "file", refs });
  const toggle = (key: string) => setChosen((c) => c.includes(key) ? c.filter((k) => k !== key) : [...c, key]);
  const chosenRows = rows.filter((r) => chosen.includes(fileKey(r.ref)) && !filePickReason(r));
  return <section aria-label="파일 선택" className="ainui-picker ainui-picker-file">
    <PickerHeader ctx={ctx} base={base} kind="file" scopes={FILE_SCOPES} scope={scope} query={query} asOf={asOf} cursorExpired={cursorExpired} />
    {rows.length === 0 && <p className="ainui-picker-empty">표시할 파일이 없습니다</p>}
    <ul className="ainui-picker-list" aria-label="파일 목록">
      {rows.map((item) => {
        const key = fileKey(item.ref);
        const reason = filePickReason(item);
        const state = item.ref.availability?.state ?? "unknown";
        const unentitled = !!item.paid && !item.paid.entitled;
        const isChosen = chosen.includes(key);
        const pickLabel = selection === "multiple" ? (isChosen ? "선택 해제" : "선택") : "선택";
        return <li key={key} className={`ainui-picker-row${reason ? " ainui-picker-row-unavailable" : ""}${isChosen ? " ainui-picker-row-selected" : ""}`}
          aria-selected={isChosen} aria-disabled={!!reason} data-file-key={key}>
          <span className="ainui-picker-icon" aria-hidden="true"><Glyph kind={item.ref.kind === "folder" ? "folder" : "file"} /></span>
          <span className="ainui-picker-main">
            <span className="ainui-picker-name" title={item.ref.displayName}>{item.ref.displayName}</span>
            <span className="ainui-picker-meta">
              <Badge>{SHARE_ORIGIN_LABEL[item.shareOrigin] ?? item.shareOrigin}</Badge>
              <Badge tone="muted">{ROLE_LABEL[item.role] ?? item.role}</Badge>
              <Badge tone={state === "online" ? undefined : state === "unknown" ? "muted" : "danger"}>{AVAILABILITY_LABEL[state] ?? state}</Badge>
              {unentitled && <Badge tone="warn">{PAID_BADGE}</Badge>}
            </span>
            {reason && <small className="ainui-picker-reason">{reason}</small>}
          </span>
          <span className="ainui-picker-actions">
            <button type="button" className={`ainui-button ainui-picker-pick${isChosen ? "" : " ainui-button-primary"}`} disabled={!!reason}
              aria-label={reason ? `${item.ref.displayName}: ${reason}` : `${item.ref.displayName} ${pickLabel}`} title={reason ?? undefined}
              onClick={() => { if (reason) return; if (selection === "multiple") toggle(key); else void pick([item.ref]); }}>{pickLabel}</button>
            {item.ref.sourceUrl && <button type="button" className="ainui-button ainui-picker-open" aria-label={`${item.ref.displayName} 원본 열기`}
              onClick={() => void pickerDispatch(ctx, base, "ainui.picker.open", { kind: "file", sourceUrl: item.ref.sourceUrl })}>열기</button>}
          </span>
        </li>;
      })}
    </ul>
    <div className="ainui-picker-footer">
      <PickerMore ctx={ctx} base={base} kind="file" cursor={cursor} />
      {selection === "multiple" && <button type="button" className="ainui-button ainui-button-primary ainui-picker-done" disabled={chosenRows.length === 0}
        onClick={() => void pick(chosenRows.map((r) => r.ref))}>{chosenRows.length}개 선택 완료</button>}
    </div>
  </section>;
});

const AgentPicker = createBinderlessComponentImplementation(api("AgentPicker", {
  items: dynamic, scope: dynamic, query: dynamic, cursor: dynamic, asOf: dynamic, cursorExpired: dynamic,
  selected: dynamic, renders: dynamic, context: dynRecord,
}), ({ context: ctx }) => {
  const p = ctx.componentModel.properties;
  const items = useValue<AgentListItem[]>(ctx, p.items);
  const scope = useValue<string>(ctx, p.scope) ?? "mine";
  const query = useValue<string>(ctx, p.query) ?? "";
  const cursor = useValue<unknown>(ctx, p.cursor);
  const asOf = useValue<string>(ctx, p.asOf);
  const cursorExpired = useValue<boolean>(ctx, p.cursorExpired) === true;
  const selected = useValue<string>(ctx, p.selected) ?? "";
  const renders = useValue<string[]>(ctx, p.renders);
  const base = usePickerContext(ctx);
  const rows = Array.isArray(items) ? items.filter((i): i is AgentListItem => !!i && !!i.ref) : [];
  return <section aria-label="에이전트 선택" className="ainui-picker ainui-picker-agent">
    <PickerHeader ctx={ctx} base={base} kind="agent" scopes={AGENT_SCOPES} scope={scope} query={query} asOf={asOf} cursorExpired={cursorExpired} />
    {rows.length === 0 && <p className="ainui-picker-empty">표시할 에이전트가 없습니다</p>}
    <ul className="ainui-picker-list" aria-label="에이전트 목록">
      {rows.map((item) => {
        const a = item.ref;
        const key = agentKey(a);
        const reason = agentPickReason(item);
        const caps = capabilityLines(a, Array.isArray(renders) ? renders : []);
        const isSelected = selected === key;
        return <li key={key} className={`ainui-picker-row${reason ? " ainui-picker-row-unavailable" : ""}${isSelected ? " ainui-picker-row-selected" : ""}`}
          aria-selected={isSelected} aria-disabled={!!reason} data-agent-key={key}>
          <span className="ainui-picker-main">
            <span className="ainui-picker-name" title={a.displayName}>{a.displayName}</span>
            {a.description && <span className="ainui-picker-description">{a.description}</span>}
            <span className="ainui-picker-meta">
              <Badge tone={a.status === "active" ? undefined : "danger"}>{AGENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
              <Badge tone="muted">{VISIBILITY_LABEL[a.visibility] ?? a.visibility}</Badge>
              {(a.skills ?? []).slice(0, 3).map((s) => <Badge key={s.id} tone="muted">{s.name}</Badge>)}
            </span>
            <small className="ainui-picker-capabilities">
              {caps.enabled.length > 0 && <span className="ainui-picker-enabled">지원: {caps.enabled.join(", ")}</span>}
              {caps.fallbacks.length > 0 && <span className="ainui-picker-fallbacks">대체: {caps.fallbacks.join(", ")}</span>}
            </small>
            {reason && <small className="ainui-picker-reason">{reason}</small>}
          </span>
          <span className="ainui-picker-actions">
            <button type="button" className="ainui-button ainui-button-primary ainui-picker-pick" disabled={!!reason}
              aria-label={reason ? `${a.displayName}: ${reason}` : `${a.displayName} 선택`} title={reason ?? undefined}
              onClick={() => { if (!reason) void pickerDispatch(ctx, base, "ainui.picker.pick", { kind: "agent", ref: a }); }}>선택</button>
            <button type="button" className="ainui-button ainui-picker-card" aria-label={`${a.displayName} 에이전트 카드`}
              onClick={() => void pickerDispatch(ctx, base, "ainui.picker.card", { kind: "agent", agentCardUrl: a.agentCardUrl })}>카드</button>
          </span>
        </li>;
      })}
    </ul>
    <div className="ainui-picker-footer"><PickerMore ctx={ctx} base={base} kind="agent" cursor={cursor} /></div>
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
  [...basicCatalog.components.values()].filter((c) => c.name !== "Button").concat([Button, Toolbar, Grid, Tile, FileView, Breadcrumbs, Segmented, FileUpload, X402Payment, FolderChat, FilePicker, AgentPicker]),
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
