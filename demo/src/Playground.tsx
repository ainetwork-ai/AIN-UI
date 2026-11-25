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

export function Stage({ turns, theme, onAction, onSend, showSource }: {
  turns: Turn[]; theme: string; showSource: boolean;
  onAction?: (action: any) => void; onSend?: (text: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = turns.reduce((n, t) => n + t.surfaces.length + t.sources.length + (t.text ? 1 : 0), turns.length);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [count]);
  return <div className="pg-thread">
    {turns.map((t) => t.role === "user"
      ? <div key={t.id} className={`pg-msg pg-user${t.action ? " pg-action" : ""}`}>{t.action ? <><span className="pg-chip">action</span> {t.action.name}</> : t.text}</div>
      : <div key={t.id} className="pg-msg pg-assistant">
        {t.text && <p className="pg-text">{t.text}</p>}
        {t.surfaces.map((s) => <div key={s.key} className="pg-surface">
          <AinuiSurface messages={s.messages} theme={theme} onAction={(a) => onAction?.(a)} sendMessage={onSend}
            resolveAsset={(asset) => `/sample/${asset.path}`} />
        </div>)}
        {t.notes.map((n, i) => <p key={i} className="pg-note">{n}</p>)}
        {showSource && t.sources.map((s, i) => <details key={i} className={`pg-source${s.rejected ? " pg-rejected" : ""}`} open={i === t.sources.length - 1}>
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

export function Playground({ embed }: { embed: boolean }) {
  const [settings, set] = useSettings();
  const { turns, say, apply, stop, reset } = useConversation();
  const [models, setModels] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
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

  return <div className={`pg${embed ? " pg-embed" : ""}`}>
    <div className="pg-main">
      {turns.length === 0 ? <div className="pg-empty">
        <h1>Ask for a UI.</h1>
        <p>A model writes <a href="https://a2ui.org" target="_blank" rel="noopener noreferrer">A2UI 1.0</a>, the open protocol for agent-made interfaces, and AIN-UI draws it with your design system.</p>
        <div className="pg-suggestions">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={!model}>{s}</button>)}</div>
        {!model && <p className="pg-note">No model is connected to this playground right now. The recorded runs under <a href="/watch">Watch</a> still play.</p>}
      </div> : <Stage turns={turns} theme={settings.theme} showSource={settings.source}
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
  </div>;
}
