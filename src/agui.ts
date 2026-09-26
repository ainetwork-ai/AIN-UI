import type { A2uiMessage } from "./basic.js";

/** AIN-UI uses standard AG-UI activity events; no parallel event protocol. */
export function ainuiActivity(activityId: string, messages: A2uiMessage[]) {
  return { type: "ACTIVITY_SNAPSHOT" as const, messageId: activityId, activityType: "a2ui-surface", content: { a2ui_operations: messages } };
}

export function messagesFromActivity(event: unknown): A2uiMessage[] | null {
  if (!event || typeof event !== "object") return null;
  const e = event as { type?: unknown; activityType?: unknown; content?: { a2ui_operations?: unknown } };
  return e.type === "ACTIVITY_SNAPSHOT" && e.activityType === "a2ui-surface" && Array.isArray(e.content?.a2ui_operations)
    ? e.content.a2ui_operations as A2uiMessage[] : null;
}
