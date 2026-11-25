"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { A2uiSurface, MarkdownContext } from "@a2ui/react";
import { MessageProcessor, STRICT_VALIDATION } from "@a2ui/web_core";
import { basicCatalog, injectBasicCatalogStyles } from "@a2ui/web_core/catalogs/basic/v1";
import { renderMarkdown } from "@a2ui/markdown-it";
import { upgradeMessages, type A2uiAction, type A2uiMessage } from "../protocol.js";
import { ainuiFolderChat, type ChatUpdate, type FolderChatAgent, type FolderChatMessage } from "../chat.js";
import { ainuiCatalog } from "./catalog.js";
import { HostContext, InspectContext, type AssetResolver, type FileViewRenderer, type Host } from "./core.js";

const catalogs = [ainuiCatalog, basicCatalog] as never;

/**
 * What this renderer can draw, in the form an agent reads it (`a2uiRendererCapabilities`): the catalog ids, and
 * with `inline` the catalogs themselves so an agent that has never seen AIN-UI can still write for it.
 */
export function ainuiCapabilities(options: { inline?: boolean } = {}): Record<string, unknown> {
  const p = new MessageProcessor(catalogs);
  try { return p.getRendererCapabilities({ versions: ["1.0"], includeInlineCatalogs: !!options.inline } as never) as Record<string, unknown>; }
  finally { p.dispose?.(); }
}

export type AinuiSurfaceProps = {
  /** A2UI messages, 1.0 or v0.9. Appending to the list updates the surfaces in place; any other change redraws. */
  messages: readonly A2uiMessage[];
  onAction: (action: A2uiAction) => void | Promise<void>;
  /** Every renderer→agent message as the 1.0 envelope: actions, errors, function calls and responses. */
  onMessage?: (message: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  resolveAsset?: AssetResolver;
  renderFile?: FileViewRenderer;
  /** A follow-up suggestion was chosen: send its text as the user's next message. */
  sendMessage?: (text: string) => void;
  openUrl?: (href: string) => void;
  /** Design system: "ain" (default), "plain" or "material", or any name the host styles via `[data-ainui-theme]`. */
  theme?: string;
  className?: string;
  /** Tag each drawn component with its id (`data-ainui-id`), for tools that show a component's source on hover. */
  inspect?: boolean;
};

export function AinuiSurface({ messages, onAction, onMessage, onError, resolveAsset, renderFile, sendMessage, openUrl, theme, className, inspect = false }: AinuiSurfaceProps) {
  const handlers = useRef({ onAction, onMessage, onError });
  handlers.current = { onAction, onMessage, onError };
  const live = useRef<{ processor: MessageProcessor<never>; seen: readonly A2uiMessage[] } | null>(null);
  const [state, setState] = useState<{ processor: MessageProcessor<never> | null; error: string; tick: number }>({ processor: null, error: "", tick: 0 });

  useEffect(() => { injectBasicCatalogStyles?.(); }, []);

  useEffect(() => {
    const fail = (e: unknown) => { const error = e instanceof Error ? e : new Error(String(e)); handlers.current.onError?.(error); return error.message; };
    const current = live.current;
    const appended = current && messages.length >= current.seen.length && current.seen.every((m, i) => m === messages[i]);
    if (current && appended) {
      // The same conversation grew: apply only what is new, so the surface keeps its state (inputs, scroll, tabs).
      const tail = messages.slice(current.seen.length);
      current.seen = messages;
      if (!tail.length) return;
      try { current.processor.processMessages(upgradeMessages(tail) as never); setState((s) => ({ ...s, error: "", tick: s.tick + 1 })); }
      catch (e) { setState((s) => ({ ...s, error: fail(e) })); }
      return;
    }
    current?.processor.dispose?.();
    const processor = new MessageProcessor(catalogs, undefined, {
      version: "1.0",
      // What an agent sent is checked against the catalog before it is drawn: a wrong component is an error
      // the host hears about, not a blank space.
      validationConfig: STRICT_VALIDATION,
      unifiedOutbound: true,
      outboundListener: (message: Record<string, unknown>) => {
        handlers.current.onMessage?.(message);
        const action = message.action as A2uiAction | undefined;
        if (action && typeof action.name === "string") return handlers.current.onAction(action);
      },
    } as never) as MessageProcessor<never>;
    live.current = { processor, seen: messages };
    try { processor.processMessages(upgradeMessages(messages) as never); setState((s) => ({ processor, error: "", tick: s.tick + 1 })); }
    catch (e) { setState((s) => ({ processor: null, error: fail(e), tick: s.tick + 1 })); }
  }, [messages]);

  useEffect(() => () => { live.current?.processor.dispose?.(); live.current = null; }, []);

  const host = useMemo<Host>(() => ({ resolveAsset: resolveAsset ?? (() => ""), renderFile, sendMessage, openUrl }), [resolveAsset, renderFile, sendMessage, openUrl]);
  const shell = `ain-ui${className ? ` ${className}` : ""}`;
  if (state.error) return <div className={shell} data-ainui-theme={theme} role="alert">{state.error}</div>;
  if (!state.processor) return <div className={shell} data-ainui-theme={theme} aria-busy="true" />;
  return <InspectContext.Provider value={inspect}><MarkdownContext.Provider value={renderMarkdown}><HostContext.Provider value={host}><div className={shell} data-ainui-theme={theme}>
    {Array.from(state.processor.model.surfacesMap.values()).map((surface) => <A2uiSurface key={surface.id} surface={surface as never} />)}
  </div></HostContext.Provider></MarkdownContext.Provider></InspectContext.Provider>;
}

export type FolderChatSend = (turn: { q: string; agentId: string; contextId?: string; signal: AbortSignal; onUpdate: (update: ChatUpdate) => void }) => Promise<ChatUpdate>;
/** Scope changes unmount the old chat, abort its request and drop its context ids. */
export function AinuiFolderChat(props: { driveId: string; path: string; agents: FolderChatAgent[]; onSend: FolderChatSend; theme?: string; className?: string }) {
  return <FolderChatSession key={`${props.driveId}:${props.path}`} {...props} />;
}
function FolderChatSession({ driveId, path, agents, onSend, theme, className }: { driveId: string; path: string; agents: FolderChatAgent[]; onSend: FolderChatSend; theme?: string; className?: string }) {
  const [agentId, select] = useState(agents[0]?.id ?? "");
  const [messages, setMessages] = useState<FolderChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const contexts = useRef(new Map<string, string>());
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  const selected = agents.some(a => a.id === agentId) ? agentId : agents[0]?.id ?? "";
  const surface = ainuiFolderChat({ driveId, path, agents, agentId: selected, messages, busy });
  return <AinuiSurface messages={surface} theme={theme} className={className} onAction={async action => {
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
