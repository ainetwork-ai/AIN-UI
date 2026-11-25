import React, { useEffect, useMemo, useRef, useState } from "react";
import { AinuiSurface, ainuiCapabilities } from "ain-ui/react";
import { historyOf, useConversation, type Turn } from "./conversation";
import { run } from "./run";
import { THEMES, useSettings } from "./settings";

const SUGGESTIONS = [
  "A dashboard for a small online shop: four KPIs, a revenue chart for the last six months and the top products",
  "Compare three laptops for a developer in a table, with a recommendation",
  "A sign-up form for a workshop with validation",
  "A weekend trip plan for Seoul with a map and a timeline",
  "Show a folder of files as a grid with an upload button",
  "A pricing page with three plans",
];

/** The component the pointer is over: which turn and surface it is drawn in, and its id there. */
export type Hovered = { turnId: string; surfaceKey: string; id: string };

/** A component as the surface received it (after the model's repairs), found by id in that surface's messages. */
export function componentOf(messages: readonly any[], id: string): Record<string, unknown> | null {
  let found: Record<string, unknown> | null = null;
  for (const m of messages) for (const c of m?.createSurface?.components ?? m?.updateComponents?.components ?? []) if (c?.id === id) found = c;
  return found;
}

export function Stage({ turns, theme, onAction, onSend, showSource, onHover, hovered }: {
  turns: Turn[]; theme: string; showSource: boolean;
  onAction?: (action: any) => void; onSend?: (text: string) => void;
  /** With this, the surfaces are drawn in inspect mode and hovering a component reports it. */
  onHover?: (hovered: Hovered | null) => void; hovered?: Hovered | null;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = turns.reduce((n, t) => n + t.surfaces.length + t.sources.length + (t.text ? 1 : 0), turns.length);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [count]);
  return <div className="pg-thread">
    {turns.map((t) => t.role === "user"
      ? <div key={t.id} className={`pg-msg pg-user${t.action ? " pg-action" : ""}`}>{t.action ? <><span className="pg-chip">action</span> {t.action.name}</> : t.text}</div>
      : <div key={t.id} className="pg-msg pg-assistant">
        {t.text && <p className="pg-text">{t.text}</p>}
        {t.surfaces.map((s) => <div key={s.key} className="pg-surface"
          onMouseOver={onHover && ((e) => {
            const el = (e.target as Element).closest?.("[data-ainui-id]");
            const id = el?.getAttribute("data-ainui-id");
            if (id && !(hovered?.surfaceKey === s.key && hovered.id === id)) onHover({ turnId: t.id, surfaceKey: s.key, id });
          })}
          onMouseLeave={onHover && (() => onHover(null))}>
          {hovered?.surfaceKey === s.key && <style>{`.pg-surface [data-ainui-id="${CSS.escape(hovered.id)}"] > * { outline: 2px solid var(--accent, #6b5cff); outline-offset: 2px; border-radius: 4px; }`}</style>}
          <AinuiSurface messages={s.messages} theme={theme} onAction={(a) => onAction?.(a)} sendMessage={onSend} inspect={!!onHover}
            resolveAsset={(asset) => `/sample/${asset.path}`} />
        </div>)}
        {t.notes.map((n, i) => <p key={i} className="pg-note">{n}</p>)}
        {showSource && t.sources.map((s, i) => <details key={i} className={`pg-source pg-source-inline${s.rejected ? " pg-rejected" : ""}`} open={i === t.sources.length - 1}>
          <summary><span className="pg-chip">{s.format}</span> {s.rejected ? "rejected" : "accepted"} · {(s.ms / 1000).toFixed(1)} s · {s.source.length.toLocaleString()} chars</summary>
          {s.rejected && <p className="pg-reason">{s.rejected}</p>}
          <pre><code>{s.source}</code></pre>
        </details>)}
        {t.error && <p className="pg-error" role="alert">{t.error}</p>}
        {t.busy && <p className="pg-busy" aria-live="polite"><span className="pg-dot" /> {t.writing ? `Writing the surface… ${t.writing.chars.toLocaleString()} characters of ${t.writing.format === "express" ? "Express" : "JSON"}` : "Thinking…"}</p>}
        {t.busy && t.writing && showSource && <pre className="pg-writing" aria-hidden="true"><code>{t.writing.source}</code></pre>}
        {t.stats && !t.busy && !t.error && <p className="pg-stats">{t.stats.model} · {t.stats.format} · {t.stats.calls} model call{t.stats.calls === 1 ? "" : "s"} · {(t.stats.ms / 1000).toFixed(1)} s</p>}
      </div>)}
    <div ref={end} />
  </div>;
}

/** Lines of the model's source that write this component: those naming its id, for Express and JSON alike. */
function linesOf(source: string, id: string): Set<number> {
  const hit = new Set<number>();
  // A repair may have renamed it (f-name → f_name): the model's spelling may have either.
  const esc = [...new Set([id, id.replace(/_/g, "-")])].map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|").replace(/^(.*)$/, "(?:$1)");
  const express = new RegExp(`^\\s*${esc}\\s*=`), json = new RegExp(`\\\\?"id\\\\?"\\s*:\\s*\\\\?"${esc}\\\\?"`);
  source.split("\n").forEach((l, i) => { if (express.test(l) || json.test(l)) hit.add(i); });
  return hit;
}

/** The hovered component: what the renderer received for it, as JSON. */
function ComponentCard({ component, id }: { component: Record<string, unknown> | null; id: string }) {
  return <section className="pg-inspect" aria-live="polite">
    <header className="pg-pane-head"><strong>{String(component?.component ?? "Component")}</strong><span className="pg-pane-meta">id {id}</span></header>
    {component ? <pre className="pg-pane-code pg-inspect-code"><code>{JSON.stringify(component, null, 2)}</code></pre>
      : <p className="pg-note pg-pane-note">Not found in this surface's messages.</p>}
  </section>;
}

/** What the model wrote for the latest answer, beside the conversation: every attempt, the rejected ones with why. */
function SourcePane({ turn, hovered, component }: { turn?: Turn; hovered?: Hovered | null; component?: Record<string, unknown> | null }) {
  const [pick, setPick] = useState<number | null>(null);
  const sources = turn?.sources ?? [];
  useEffect(() => setPick(null), [turn?.id, sources.length]);
  const at = pick ?? sources.length - 1;
  const shown = sources[at];
  const lines = shown ? shown.source.split("\n") : [];
  const marked = hovered && shown ? linesOf(shown.source, hovered.id) : new Set<number>();
  const code = useRef<HTMLPreElement>(null);
  useEffect(() => { code.current?.querySelector(".pg-pane-hit")?.scrollIntoView?.({ block: "nearest" }); }, [hovered?.id, hovered?.surfaceKey]);
  return <aside className="pg-pane" aria-label="What the model wrote">
    {hovered && <ComponentCard component={component ?? null} id={hovered.id} />}
    <header className="pg-pane-head">
      <strong>{turn?.stats?.model ?? "The model"} wrote</strong>
      {shown && <span className="pg-pane-meta">{shown.format === "express" ? "A2UI Express" : "A2UI JSON"} · {lines.length} lines · {(shown.ms / 1000).toFixed(1)} s</span>}
    </header>
    {sources.length > 1 && <div className="pg-pane-tabs" role="tablist">{sources.map((s, i) =>
      <button key={i} type="button" role="tab" aria-selected={i === at} className={s.rejected ? "pg-pane-tab-rejected" : ""} onClick={() => setPick(i)}>
        Try {i + 1}{s.rejected ? " ✕" : " ✓"}</button>)}</div>}
    {turn?.writing && !shown && <p className="pg-note pg-pane-note">Writing… {turn.writing.chars.toLocaleString()} characters</p>}
    {shown?.rejected && <p className="pg-pane-reason">{shown.rejected}</p>}
    {shown ? <pre ref={code} className="pg-pane-code"><code>{lines.map((l, i) => <span key={i} className={`pg-pane-line${marked.has(i) ? " pg-pane-hit" : ""}`}><span className="pg-pane-no">{i + 1}</span>{l}{"\n"}</span>)}</code></pre>
      : !turn?.writing && <p className="pg-note pg-pane-note">Nothing yet. Ask for a UI and the source appears here.</p>}
    {turn?.notes.length ? <ul className="pg-pane-notes">{turn.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
  </aside>;
}

export function Playground({ embed }: { embed: boolean }) {
  const [settings, set] = useSettings();
  const { turns, say, apply, stop, reset } = useConversation();
  const [models, setModels] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const pending = useRef<AbortController | null>(null);
  const capabilities = useMemo(() => ainuiCapabilities(), []);

  useEffect(() => { fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models ?? [])).catch(() => setModels([])); }, []);
  const model = models.includes(settings.model) ? settings.model : models[0] ?? "";

  const start = async (request: { text: string; action?: { name: string; surfaceId?: string; context?: unknown } }) => {
    if (busy) return;
    const history = historyOf(turns);
    say(request.text, request.action ? { name: request.action.name, surfaceId: request.action.surfaceId } : undefined);
    const controller = new AbortController(); pending.current = controller; setBusy(true);
    try {
      await run({ messages: request.action ? history : [...history, { role: "user", content: request.text }], model, format: settings.format, action: request.action, capabilities }, apply, controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) apply({ type: "RUN_ERROR", message: "The connection to the playground was lost." });
    } finally { stop(); setBusy(false); pending.current = null; }
  };
  const send = (text: string) => { const t = text.trim(); if (t) { setDraft(""); void start({ text: t }); } };

  const latest = [...turns].reverse().find((t) => t.role === "assistant" && (t.sources.length || t.writing));
  const pane = settings.source && turns.length > 0;
  // Hovering a component shows that turn's source (not only the latest) with the component's lines marked.
  const hoveredTurn = hovered ? turns.find((t) => t.id === hovered.turnId) : undefined;
  const hoveredComponent = hovered && hoveredTurn ? componentOf(hoveredTurn.surfaces.find((x) => x.key === hovered.surfaceKey)?.messages ?? [], hovered.id) : null;
  return <div className={`pg${embed ? " pg-embed" : ""}${pane ? " pg-with-pane" : ""}`}>
    <div className="pg-column">
    <div className="pg-main">
      {turns.length === 0 ? <div className="pg-empty">
        <h1>Ask for a UI.</h1>
        <p>A model writes <a href="https://a2ui.org" target="_blank" rel="noopener noreferrer">A2UI 1.0</a>, the open protocol for agent-made interfaces, and AIN-UI draws it with your design system.</p>
        <div className="pg-suggestions">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={!model}>{s}</button>)}</div>
        {!model && <p className="pg-note">No model is connected to this playground right now. The recorded runs under <a href="/watch">Watch</a> still play.</p>}
      </div> : <Stage turns={turns} theme={settings.theme} showSource={settings.source}
        onHover={pane ? setHovered : undefined} hovered={hovered}
        onAction={(a) => void start({ text: a.name, action: { name: a.name, surfaceId: a.surfaceId, context: a.context } })} onSend={send} />}
    </div>
    <form className="pg-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Describe the interface you want…" rows={2} aria-label="Your request"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }} />
      <div className="pg-controls">
        <label>Model <select value={model} onChange={(e) => set({ model: e.target.value })} disabled={!models.length}>{models.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Format <select value={settings.format} onChange={(e) => set({ format: e.target.value })}><option value="express">Express</option><option value="json">JSON</option></select></label>
        <label>Design <select value={settings.theme} onChange={(e) => set({ theme: e.target.value })}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="pg-check"><input type="checkbox" checked={settings.source} onChange={(e) => set({ source: e.target.checked })} /> Show what the model wrote</label>
        <span className="pg-spacer" />
        {turns.length > 0 && !busy && <button type="button" className="pg-button" onClick={reset}>New</button>}
        {busy ? <button type="button" className="pg-button" onClick={() => pending.current?.abort()}>Stop</button>
          : <button type="submit" className="pg-button pg-primary" disabled={!draft.trim() || !model}>Send</button>}
      </div>
    </form>
    </div>
    {pane && <SourcePane turn={hoveredTurn ?? latest} hovered={hovered} component={hoveredComponent} />}
  </div>;
}
