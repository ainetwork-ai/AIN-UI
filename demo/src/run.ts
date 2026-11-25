/** The playground's client for /api/run: one POST, a stream of AG-UI events back. */
export type RunEvent =
  | { type: "RUN_STARTED"; runId: string; model: string; format: string }
  | { type: "TEXT_MESSAGE_CONTENT"; delta: string }
  | { type: "ACTIVITY_SNAPSHOT"; activityType: string; content: { a2ui_operations: any[] }; format: string; ms: number }
  | { type: "CUSTOM"; name: "ainui.source"; value: { format: string; source: string; ms: number; attempt: number } }
  | { type: "CUSTOM"; name: "ainui.rejected"; value: { format: string; message: string } }
  | { type: "CUSTOM"; name: "ainui.fallback"; value: { from: string; to: string } }
  | { type: "CUSTOM"; name: "ainui.forgiven"; value: { notes: string[] } }
  | { type: "CUSTOM"; name: "ainui.writing"; value: { format: string; chars: number; source: string } }
  | { type: "RUN_ERROR"; message: string }
  | { type: "RUN_FINISHED"; calls: number; shown: number; ms: number };

export type RunRequest = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  format?: string;
  action?: { name: string; surfaceId?: string; context?: unknown };
  capabilities?: unknown;
};

export async function run(request: RunRequest, onEvent: (event: RunEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    onEvent({ type: "RUN_ERROR", message: body?.error?.message ?? `The playground answered ${res.status}.` });
    return;
  }
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let at: number;
    while ((at = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, at); buffer = buffer.slice(at + 2);
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (data) { try { onEvent(JSON.parse(data)); } catch { /* a broken frame is skipped */ } }
    }
  }
}

/** Replays recorded events at the pace they were recorded, capped so nobody waits on a slow model twice. */
export async function replay(events: Array<{ at: number; event: RunEvent }>, onEvent: (event: RunEvent) => void, signal?: AbortSignal, speed = 1): Promise<void> {
  let last = 0;
  for (const { at, event } of events) {
    const wait = Math.min(1500, Math.max(0, at - last)) / speed; last = at;
    await new Promise((r) => setTimeout(r, wait));
    if (signal?.aborted) return;
    onEvent(event);
  }
}
