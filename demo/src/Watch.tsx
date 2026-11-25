import React, { useEffect, useRef, useState } from "react";
import { useConversation } from "./conversation";
import { replay, type RunEvent } from "./run";
import { Stage } from "./Playground";
import { THEMES, useSettings } from "./settings";

type Recording = { id: string; title: string; prompt: string; model: string; format: string; recordedAt: string; steps?: number; events?: Array<{ at: number; event: RunEvent }> };

/** Recorded runs, replayed event by event. No model is called. */
export function Watch() {
  const [list, setList] = useState<Recording[] | null>(null);
  const [current, setCurrent] = useState<string>("");
  const [settings, set] = useSettings();
  const { turns, say, apply, stop, reset } = useConversation();
  const playing = useRef<AbortController | null>(null);

  useEffect(() => { fetch("/api/watch").then((r) => r.json()).then((d) => setList(d.recordings ?? [])).catch(() => setList([])); return () => playing.current?.abort(); }, []);

  const play = async (id: string) => {
    playing.current?.abort();
    const controller = new AbortController(); playing.current = controller;
    setCurrent(id); reset();
    const rec: Recording = await fetch(`/api/watch/${encodeURIComponent(id)}`).then((r) => r.json());
    if (controller.signal.aborted) return;
    say(rec.prompt);
    await replay(rec.events ?? [], apply, controller.signal);
    if (!controller.signal.aborted) stop();
  };

  return <main className="doc watch">
    <h1>Watch</h1>
    <p>Runs recorded on this playground, replayed as they happened: what the model wrote, what was rejected, what was drawn. Nothing is sent to a model here.</p>
    {list === null ? <p className="pg-note">Loading…</p> : list.length === 0 ? <p className="pg-note">No recordings yet.</p> : <div className="watch-list">
      {list.map((r) => <button key={r.id} type="button" aria-pressed={current === r.id} onClick={() => void play(r.id)}>
        <strong>{r.title}</strong><span>{r.model} · {r.format} · {r.steps} events</span>
      </button>)}
    </div>}
    {current && <>
      <div className="pg-controls watch-controls">
        <label>Design <select value={settings.theme} onChange={(e) => set({ theme: e.target.value })}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <button type="button" className="pg-button" onClick={() => void play(current)}>Replay</button>
      </div>
      <Stage turns={turns} theme={settings.theme} showSource />
    </>}
  </main>;
}
