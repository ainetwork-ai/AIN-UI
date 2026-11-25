/**
 * The playground's conversation: turns, the surfaces each assistant turn showed, and what the model wrote for
 * them. Run events (live or recorded) are folded into it the same way.
 */
import { useCallback, useReducer } from "react";
import type { RunEvent } from "./run";

export type Source = { format: string; source: string; ms: number; attempt: number; rejected?: string };
export type Shown = { key: string; surfaceId: string; messages: any[]; format: string; ms: number };
export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  surfaces: Shown[];
  sources: Source[];
  notes: string[];
  error?: string;
  busy?: boolean;
  /** While the model is still writing a surface: how much so far, and the end of it. */
  writing?: { format: string; chars: number; source: string };
  stats?: { calls: number; ms: number; model?: string; format?: string };
  /** A user turn that is a click on a surface rather than typed words. */
  action?: { name: string; surfaceId?: string };
};
export type Conversation = { turns: Turn[] };

type Step = { kind: "user"; text: string; action?: Turn["action"] } | { kind: "event"; event: RunEvent } | { kind: "reset" } | { kind: "stop" };

let seq = 0;
const id = () => `t${++seq}`;
const surfaceIdOf = (ops: any[]) => ops.map((m) => m.deleteSurface?.surfaceId ?? m.createSurface?.surfaceId ?? m.updateComponents?.surfaceId ?? m.updateDataModel?.surfaceId).find(Boolean) as string | undefined;

function reduce(state: Conversation, step: Step): Conversation {
  if (step.kind === "reset") return { turns: [] };
  if (step.kind === "user") {
    return { turns: [...state.turns, { id: id(), role: "user", text: step.text, surfaces: [], sources: [], notes: [], action: step.action },
      { id: id(), role: "assistant", text: "", surfaces: [], sources: [], notes: [], busy: true }] };
  }
  const turns = state.turns.slice();
  const at = turns.length - 1;
  const last = turns[at];
  if (!last || last.role !== "assistant") return state;
  if (step.kind === "stop") { turns[at] = { ...last, busy: false, writing: undefined }; return { turns }; }
  const e = step.event;
  if (e.type === "RUN_STARTED") turns[at] = { ...last, stats: { calls: 0, ms: 0, model: e.model, format: e.format } };
  else if (e.type === "TEXT_MESSAGE_CONTENT") turns[at] = { ...last, text: last.text ? `${last.text}\n\n${e.delta}` : e.delta };
  else if (e.type === "ACTIVITY_SNAPSHOT") {
    const ops = e.content?.a2ui_operations ?? [];
    const target = surfaceIdOf(ops);
    // A surface replaced in answer to a click starts with deleteSurface: it belongs where that surface is shown.
    const creates = ops.some((m: any) => m.createSurface) && !ops.some((m: any) => m.deleteSurface);
    // An update goes to the surface it names, wherever in the conversation that surface was shown.
    const owner = creates ? -1 : turns.findIndex((t) => t.surfaces.some((s) => s.surfaceId === target));
    if (owner >= 0) {
      turns[owner] = { ...turns[owner], surfaces: turns[owner].surfaces.map((s) => (s.surfaceId === target ? { ...s, messages: [...s.messages, ...ops], format: e.format, ms: e.ms } : s)) };
      turns[at] = { ...turns[at], notes: [...turns[at].notes, "Updated the surface above."] };
    } else {
      turns[at] = { ...last, surfaces: [...last.surfaces, { key: id(), surfaceId: target ?? id(), messages: ops, format: e.format, ms: e.ms }] };
    }
  } else if (e.type === "CUSTOM" && e.name === "ainui.writing") turns[at] = { ...last, writing: e.value };
  else if (e.type === "CUSTOM" && e.name === "ainui.source") turns[at] = { ...last, writing: undefined, sources: [...last.sources, e.value] };
  else if (e.type === "CUSTOM" && e.name === "ainui.rejected") {
    const sources = last.sources.slice();
    if (sources.length) sources[sources.length - 1] = { ...sources[sources.length - 1], rejected: e.value.message };
    turns[at] = { ...last, sources };
  } else if (e.type === "CUSTOM" && e.name === "ainui.fallback") turns[at] = { ...last, notes: [...last.notes, `Express did not compile twice; asked again as JSON.`] };
  else if (e.type === "CUSTOM" && e.name === "ainui.forgiven") turns[at] = { ...last, notes: [...last.notes, ...e.value.notes.map((n) => `Tidied: ${n}`)] };
  else if (e.type === "RUN_ERROR") turns[at] = { ...last, error: e.message, busy: false };
  else if (e.type === "RUN_FINISHED") turns[at] = { ...last, busy: false, stats: { ...last.stats, calls: e.calls, ms: e.ms } };
  return { turns };
}

export function useConversation() {
  const [state, dispatch] = useReducer(reduce, { turns: [] });
  return {
    turns: state.turns,
    say: useCallback((text: string, action?: Turn["action"]) => dispatch({ kind: "user", text, action }), []),
    apply: useCallback((event: RunEvent) => dispatch({ kind: "event", event }), []),
    stop: useCallback(() => dispatch({ kind: "stop" }), []),
    reset: useCallback(() => dispatch({ kind: "reset" }), []),
  };
}

/** What the model is told about earlier turns: the words, and for each surface the source it wrote. */
export function historyOf(turns: Turn[]): Array<{ role: "user" | "assistant"; content: string }> {
  return turns.filter((t) => !t.busy && !t.error).map((t) => {
    if (t.role === "user") return { role: "user" as const, content: t.text };
    const shown = t.surfaces.map((s) => {
      const src = [...t.sources].reverse().find((x) => !x.rejected);
      return `[You showed surface "${s.surfaceId}"${src ? ` written as ${src.format}:\n${src.source.slice(0, 4000)}` : ""}]`;
    });
    return { role: "assistant" as const, content: [t.text, ...shown].filter(Boolean).join("\n\n") || "(shown)" };
  });
}
