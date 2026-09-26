import { A2UI_VERSION, type A2uiMessage } from './basic.js';
import { AINUI_CATALOG } from './ainui.js';

export type FolderChatMessage = { role: 'user' | 'agent' | 'error'; text: string };
export type FolderChatAgent = { id: string; label: string; remote?: boolean };
export type ChatUpdate = { text: string; contextId?: string; state?: string };
export type FolderChatState = { driveId: string; path: string; agents: FolderChatAgent[]; agentId: string; messages: FolderChatMessage[]; busy: boolean };
export function ainuiFolderChat(state: FolderChatState): A2uiMessage[] {
  const surfaceId = 'ainui-folder-chat';
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: AINUI_CATALOG } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components: [{ id: 'root', component: 'FolderChat', value: { path: '/chat' }, action: { event: { name: 'aindrive.chat', context: { drive_id: state.driveId, path: state.path } } } }] } },
    { version: A2UI_VERSION, updateDataModel: { surfaceId, path: '/', value: { chat: state } } },
  ];
}

function textOf(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts.filter(p => p && (p.kind === 'text' || p.type === 'text') && typeof p.text === 'string').map(p => p.text).join('\n');
}
/** A2A snapshots replace; artifact append events append to their own artifact only. */
export class A2aChatAccumulator {
  private statusText = '';
  private artifacts = new Map<string, string>();
  private contextId?: string;
  private state?: string;
  received = false;
  push(raw: unknown): ChatUpdate {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid A2A event');
    const e = raw as Record<string, any>;
    this.received = true;
    if (typeof e.contextId === 'string') this.contextId = e.contextId;
    if (e.kind === 'message') this.statusText = textOf(e.parts);
    if (e.kind === 'task') {
      this.state = e.status?.state;
      if (e.status?.message) this.statusText = textOf(e.status.message.parts);
      if (Array.isArray(e.artifacts)) {
        this.artifacts.clear();
        for (const a of e.artifacts) this.artifacts.set(a.artifactId, textOf(a.parts));
      }
    }
    if (e.kind === 'status-update') {
      this.state = e.status?.state;
      if (e.status?.message) this.statusText = textOf(e.status.message.parts);
    }
    if (e.kind === 'artifact-update' && e.artifact) {
      const id = e.artifact.artifactId;
      if (typeof id !== 'string') throw new Error('A2A artifact has no id');
      const text = textOf(e.artifact.parts);
      this.artifacts.set(id, e.append ? (this.artifacts.get(id) ?? '') + text : text);
    }
    if (this.state === 'failed' || this.state === 'rejected' || this.state === 'canceled')
      throw new Error(this.statusText || `Agent task ${this.state}`);
    return this.value();
  }
  value(): ChatUpdate {
    // Artifacts are the deliverable; status text often repeats the same answer.
    const artifacts = [...this.artifacts.values()].filter(Boolean).join('\n\n');
    return { text: artifacts || this.statusText, contextId: this.contextId, state: this.state };
  }
}

/** Consume AG-UI events, including full AIN-UI surface snapshots. Handles split UTF-8/CRLF frames. */
export async function readChatStream(response: Response, onUpdate: (update: ChatUpdate) => void, signal?: AbortSignal): Promise<ChatUpdate> {
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `HTTP ${response.status}`); }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = await response.json();
    const update = { text: data.answer ?? data.text ?? '', contextId: data.contextId ?? undefined };
    onUpdate(update); return update;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty chat stream');
  const decoder = new TextDecoder();
  let buffer = '', complete = false, value: ChatUpdate = { text: '' };
  const abort = () => { void reader.cancel(); };
  signal?.addEventListener('abort', abort, { once: true });
  const frame = (raw: string) => {
    const data = raw.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    const e = JSON.parse(data);
    if (e.type === 'RUN_ERROR') throw new Error(e.message || 'Agent failed');
    if (e.type === 'TEXT_MESSAGE_CONTENT') { value.text += e.delta ?? ''; onUpdate({ ...value }); }
    if (e.type === 'CUSTOM' && e.name === 'ainui.chat.snapshot') { value = e.value; onUpdate({ ...value }); }
    if (e.type === 'RUN_FINISHED') { complete = true; if (e.result?.contextId) value.contextId = e.result.contextId; }
  };
  try {
    signal?.throwIfAborted();
    while (true) {
      const { value: chunk, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(chunk, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let i: number;
      while ((i = buffer.indexOf('\n\n')) >= 0) { frame(buffer.slice(0, i)); buffer = buffer.slice(i + 2); }
      if (done) break;
    }
    signal?.throwIfAborted();
    if (buffer.trim()) frame(buffer);
    if (!complete) throw new Error('Chat stream ended before completion');
    return value;
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export interface FolderTreeEntry { name: string; path: string; isDir: boolean }
/** Bounded breadth-first traversal. Paths returned by a provider may never escape the selected root. */
export async function listFolderTree<T extends FolderTreeEntry>(list: (path: string) => Promise<T[]>, root = '', options: { maxEntries?: number; maxDepth?: number; maxDirectories?: number; signal?: AbortSignal } = {}) {
  const clean = (p: string) => p.split('/').filter(Boolean).join('/');
  const valid = (p: string) => !p.includes('\\') && !p.includes('\0') && !p.split('/').some(s => s === '.' || s === '..');
  if (!valid(root)) throw new Error('Invalid folder root');
  root = clean(root);
  const max = options.maxEntries ?? 200, depthLimit = options.maxDepth ?? 8, dirLimit = options.maxDirectories ?? 64;
  const queue = [{ path: root, depth: 0 }], seen = new Set<string>();
  const entries: T[] = [], errors: string[] = [];
  let directories = 0, observedEntries = 0, truncated = false;
  while (queue.length) {
    options.signal?.throwIfAborted();
    if (directories >= dirLimit || entries.length >= max) { truncated = true; break; }
    const dir = queue.shift()!;
    let children: T[];
    try { children = await list(dir.path); }
    catch (e) { if (dir.path === root) throw e; errors.push(dir.path); truncated = true; continue; }
    directories++;
    for (const entry of children) {
      const path = clean(entry.path);
      if (!valid(entry.path) || (dir.path ? !path.startsWith(dir.path + '/') : false) || path.slice(dir.path ? dir.path.length + 1 : 0).includes('/')) { errors.push(dir.path); truncated = true; continue; }
      if (!path || entry.name.startsWith('.') || seen.has(path)) continue;
      seen.add(path); observedEntries++;
      if (entries.length >= max) { truncated = true; continue; }
      entries.push({ ...entry, path });
      if (entry.isDir) {
        if (dir.depth >= depthLimit) truncated = true;
        else queue.push({ path, depth: dir.depth + 1 });
      }
    }
  }
  return { entries, directories, observedEntries, truncated, errors };
}
