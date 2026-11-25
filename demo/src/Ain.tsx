import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AinuiFolderChat, AinuiSurface, type FolderChatSend } from "ain-ui/react";
import {
  X402_PAY_ACTION, agentKey, ainuiAgentPicker, ainuiFilePicker, ainuiPayment, dispatchAinuiAction, fileKey, humanSize, parentOf,
  type A2uiAction, type A2uiMessage, type AgentListItem, type AgentListScope, type AgentRef, type AinuiDeps, type AinuiView,
  type FileListItem, type FileListScope, type FileRef, type OwnerRef,
} from "ain-ui";
import { THEMES, useSettings } from "./settings";
import { DEMO_DRIVE_ID, PAID_PATH, createMockDrive, type MockDrive } from "./mockDrive";
import "./ain.css";

// ── shared bits ─────────────────────────────────────────────────────────────

type LogEntry = { id: number; name: string; context: string; outcome: string };
let logId = 0;

/** Action context as one short line: long strings (file content, base64 uploads) are clipped. */
function brief(context: unknown): string {
  try {
    return JSON.stringify(context ?? {}, (_k, v) => (typeof v === "string" && v.length > 64 ? `${v.slice(0, 48)}… (${v.length} chars)` : v));
  } catch { return "(unserialisable context)"; }
}

function useLog(size = 6): [LogEntry[], (action: A2uiAction, outcome: string) => void, () => void] {
  const [log, setLog] = useState<LogEntry[]>([]);
  const add = useCallback((action: A2uiAction, outcome: string) =>
    setLog((l) => [{ id: ++logId, name: String(action?.name ?? "(unnamed)"), context: brief(action?.context), outcome }, ...l].slice(0, size)), [size]);
  return [log, add, useCallback(() => setLog([]), [])];
}

function ActionLog({ log, empty }: { log: LogEntry[]; empty: string }) {
  return <ol className="example-log ain-log" aria-live="polite" aria-label="Actions received">
    {log.length === 0 ? <li className="ain-log-empty">{empty}</li> : log.map((l) => <li key={l.id}><code>{l.name}</code> {l.context}{l.outcome && <span className="ain-log-outcome"> → {l.outcome}</span>}</li>)}
  </ol>;
}

/** "folder" | "file" | "editor" | … from the id the library's builders give a surface. */
function surfaceKind(messages: readonly A2uiMessage[] | null): string {
  const id = (messages?.[0] as { createSurface?: { surfaceId?: string } } | undefined)?.createSurface?.surfaceId ?? "";
  return /^aindrive-([a-z]+)-/.exec(id)?.[1] ?? "";
}

// ── payment (mock) ──────────────────────────────────────────────────────────

const PAYMENT_REQUIRED = {
  x402Version: 2,
  resource: { url: "https://drive.example/s/demo-report", description: "Market report 2026", mimeType: "application/pdf" },
  accepts: [{
    scheme: "exact", network: "eip155:8453" as const, amount: "250000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x000000000000000000000000000000000000dEaD", maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" },
  }],
};
const PRICE = "0.25 USDC";
const paymentSurface = (): A2uiMessage[] => ainuiPayment({
  shareToken: "demo-report", title: "Market report 2026", required: PAYMENT_REQUIRED as never,
  paymentRequired: btoa(JSON.stringify(PAYMENT_REQUIRED)), symbol: "USDC", decimals: 6,
});

const DEMO_NOTICE = "Demo: nothing was signed or paid.";

// ── file preview (host-side `renderFile`) ───────────────────────────────────

/** The demo server sends .pdf as a download type, so the frame gets the same bytes as a typed blob. */
function PdfFrame({ src, name }: { src: string; name: string }) {
  const [url, setUrl] = useState(src.startsWith("blob:") ? src : "");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (src.startsWith("blob:")) { setUrl(src); return; }
    let made = "", gone = false;
    fetch(src).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then((bytes) => {
      if (gone) return;
      made = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setUrl(made);
    }).catch(() => { if (!gone) setFailed(true); });
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [src]);
  if (failed) return <p className="pg-note">The PDF could not be loaded.</p>;
  return url ? <iframe className="ain-preview-frame" title={name} src={url} /> : <p className="pg-note" aria-busy="true">Loading the PDF…</p>;
}

function FilePreview({ file, text }: { file: { src: string; download: string; name: string; mime: string; size?: number }; text: string | null }) {
  const body = file.mime.startsWith("image/") ? <img className="ain-preview-image" src={file.src} alt={file.name} />
    : file.mime === "application/pdf" ? <PdfFrame src={file.src} name={file.name} />
      : text !== null ? <pre className="ain-preview-text" tabIndex={0}>{text || "(empty file)"}</pre>
        : <p className="pg-note">No preview for this type of file.</p>;
  return <div className="ain-preview">
    {body}
    <p className="ain-preview-meta"><strong>{file.name}</strong>{typeof file.size === "number" && <span> · {humanSize(file.size)}</span>} · <a href={file.download} download={file.name}>Download</a></p>
  </div>;
}

// ── 1 + 2: the drive and the payment ────────────────────────────────────────

/** Sections 1, 2 and 4 share the drive (lock state, current folder); `children` is section 3, drawn in between. */
function DriveAndPayment({ theme, children }: { theme: string; children: React.ReactNode }) {
  const [drive, setDrive] = useState<MockDrive>(createMockDrive);
  const [surface, setSurface] = useState<A2uiMessage[] | null>(null);
  const [cwd, setCwd] = useState("");
  const [log, addLog, clearLog] = useLog();
  // Where a payment surface is open: in the drive (a locked file was opened) and/or in the payment section.
  const [payInDrive, setPayInDrive] = useState(false);
  const [payInSection, setPayInSection] = useState(false);
  const [paid, setPaid] = useState(false);
  const views = useRef(new Map<string, AinuiView>());
  const blobs = useRef(new Map<string, string>());
  const blobPaths = useRef(new Map<string, string>());
  const payment = useMemo(paymentSurface, []);
  const chatSend = useChatSend(drive, cwd);
  const deps = useMemo<AinuiDeps>(() => ({
    run: drive.run,
    allowed: drive.allowed,
    // The chosen list/grid view is remembered per folder, as a host would.
    env: (driveId, path) => { const view = views.current.get(path); return { ...drive.env(driveId, path), ...(view ? { view } : {}) }; },
    driveId: DEMO_DRIVE_ID,
  }), [drive]);

  const dropBlobs = useCallback(() => {
    for (const url of blobs.current.values()) URL.revokeObjectURL(url);
    blobs.current.clear(); blobPaths.current.clear();
  }, []);
  useEffect(() => dropBlobs, [dropBlobs]);

  /** Static samples come from /sample/<path>; files made in this session have no URL, so they get a blob: one. */
  const resolveAsset = useCallback((asset: { path: string }) => {
    const entry = drive.entry(asset.path);
    if (!entry || entry.isDir || entry.locked) return "";
    const data = drive.bytes(asset.path);
    if (!data) return `/sample/${asset.path}`;
    const key = `${asset.path}@${entry.mtimeMs}`;
    let url = blobs.current.get(key);
    if (!url) {
      url = URL.createObjectURL(new Blob([data.bytes as BlobPart], { type: data.mime }));
      blobs.current.set(key, url); blobPaths.current.set(url, asset.path);
    }
    return url;
  }, [drive]);

  const renderFile = useCallback((file: { src: string; download: string; name: string; mime: string; size?: number }) => {
    const path = blobPaths.current.get(file.src) ?? decodeURI(file.src.replace(/^\/sample\//, ""));
    return <FilePreview file={file} text={drive.text(path)} />;
  }, [drive]);

  /** Answer one action with the library's dispatcher and show the surface it returns. Never throws. */
  const answer = useCallback(async (action: A2uiAction, record = true): Promise<void> => {
    const note = (outcome: string) => { if (record) addLog(action, outcome); };
    try {
      const reply = await dispatchAinuiAction(action, deps);
      if (reply.kind !== "done") {
        note(reply.kind === "invalid" ? `not handled (${reply.error})` : reply.kind === "refused" ? `refused (${reply.skill})` : "left to the host");
        return;
      }
      const ran = reply.steps.map((s) => s.skill).join(" + ") || "no skill";
      const c = action.context ?? {};
      const path = typeof c.path === "string" ? c.path.replace(/^\/+|\/+$/g, "") : "";
      const final = reply.final.result;
      // The dispatcher reports a paid, unbought file as "forbidden": the host answers with the payment surface.
      if (action.name === "aindrive.open" && final.kind === "err" && final.code === "forbidden" && drive.entry(path)?.locked) {
        note(`${ran}: payment required → payment surface`);
        setPayInDrive(true);
        return;
      }
      if (action.name === "aindrive.view" && (c.value === "grid" || c.value === "list")) views.current.set(path, c.value);
      if (final.kind === "ok") {
        if (action.name === "aindrive.open_drive") setCwd("");
        else if (action.name === "aindrive.open" && surfaceKind(reply.surface) === "folder") setCwd(path);
        else if (action.name === "aindrive.delete") setCwd(parentOf(path));
      }
      note(final.kind === "ok" ? ran : `${ran}: ${final.message}`);
      setPayInDrive(false);
      setSurface(reply.surface);
    } catch (e) {
      note(`failed (${e instanceof Error ? e.message : String(e)})`);
    }
  }, [deps, drive, addLog]);

  // First surface, and again after "Reset the drive".
  useEffect(() => { void answer({ name: "aindrive.open_drive", context: { drive_id: DEMO_DRIVE_ID } } as A2uiAction, false); }, [answer]);

  const onAction = useCallback(async (action: A2uiAction) => {
    if (action?.name !== X402_PAY_ACTION) return answer(action);
    // The real host would ask a wallet to sign here. The demo signs nothing and just unlocks the file.
    addLog(action, "mock payment, file unlocked");
    drive.setLocked(PAID_PATH, false);
    setPaid(true);
    const fromDrive = payInDrive;
    setPayInDrive(false); setPayInSection(false);
    if (fromDrive) await answer({ name: "aindrive.open", context: { drive_id: DEMO_DRIVE_ID, path: PAID_PATH, is_dir: false } } as A2uiAction, false);
    else if (surfaceKind(surface) === "folder") await answer({ name: "aindrive.open", context: { drive_id: DEMO_DRIVE_ID, path: cwd, is_dir: true } } as A2uiAction, false);
  }, [answer, addLog, drive, payInDrive, surface, cwd]);

  const relock = () => {
    drive.setLocked(PAID_PATH, true);
    setPaid(false);
    // An editor may hold unsaved text: leave it alone. Anything else goes to the folder that shows the lock.
    if (surfaceKind(surface) !== "editor") void answer({ name: "aindrive.open", context: { drive_id: DEMO_DRIVE_ID, path: parentOf(PAID_PATH), is_dir: true } } as A2uiAction, false);
  };
  const reset = () => {
    dropBlobs(); views.current.clear(); clearLog();
    setPaid(false); setPayInDrive(false); setPayInSection(false);
    setDrive(createMockDrive()); // a new drive → new deps → the effect above opens its root
  };
  const locked = !!drive.entry(PAID_PATH)?.locked;
  const reportExists = !!drive.entry(PAID_PATH);

  return <>
    <section aria-labelledby="ain-drive">
      <h2 id="ain-drive">1. A drive you can browse</h2>
      <p>The surfaces below come from AIN-UI's builders (<code>ainuiFolder</code>, <code>ainuiFile</code>, <code>ainuiEditor</code>). Every click sends an action; <code>dispatchAinuiAction(action, deps)</code> answers it by running skills against the mock drive and returns the next surface, which replaces this one. Open <strong>Photos</strong>, switch between list and grid, search, edit <strong>welcome.md</strong>, create or upload a file, delete one.</p>
      <div className="example">
        <div className="example-stage">
          {payInDrive ? <>
            <p className="pg-note ain-demo-note"><span className="pg-chip">demo</span> <strong>market-report.pdf</strong> is a paid file. The Pay button below touches no wallet.</p>
            <AinuiSurface messages={payment} theme={theme} onAction={onAction} />
            <p className="ain-row"><button type="button" className="pg-button" onClick={() => setPayInDrive(false)}>Back to the drive</button></p>
          </> : surface ? <AinuiSurface messages={surface} theme={theme} onAction={onAction} resolveAsset={resolveAsset} renderFile={renderFile} />
            : <p className="pg-note" aria-busy="true">Opening the drive…</p>}
        </div>
        <h3 className="ain-log-title">What the surface sent</h3>
        <ActionLog log={log} empty="Nothing yet. Click something in the drive." />
      </div>
      <p className="ain-row"><button type="button" className="pg-button" onClick={reset}>Reset the drive</button><span className="pg-note">Current folder: <code>/{cwd}</code></span></p>
    </section>

    <section aria-labelledby="ain-pay">
      <h2 id="ain-pay">2. An x402 payment</h2>
      <p><code>Docs/market-report.pdf</code> is a paid file: the drive lists it with a lock and refuses to open it. A host answers that refusal with the surface from <code>ainuiPayment(...)</code>, built from the x402 payment requirements ({PRICE} on <code>eip155:8453</code>). The Pay button sends <code>{X402_PAY_ACTION}</code>; a real host passes it to the visitor's wallet. This page does not.</p>
      <div className="example">
        <div className="example-stage">
          <p className="ain-status">Market report 2026 <span className={`pg-chip ${locked ? "ain-chip-locked" : "ain-chip-open"}`}>{!reportExists ? "deleted" : locked ? "locked" : "unlocked"}</span></p>
          {payInSection && locked ? <>
            <p className="pg-note ain-demo-note"><span className="pg-chip">demo</span> The Pay button below touches no wallet.</p>
            <AinuiSurface messages={payment} theme={theme} onAction={onAction} />
            <p className="ain-row"><button type="button" className="pg-button" onClick={() => setPayInSection(false)}>Cancel</button></p>
          </> : locked ? <p className="ain-row"><button type="button" className="pg-button pg-primary" onClick={() => setPayInSection(true)}>Buy the report</button><span className="pg-note">or open the locked file in the drive above</span></p>
            : !reportExists ? <p className="pg-note">The report was deleted from the drive. Reset the drive to bring it back.</p>
              : <p className="ain-row"><button type="button" className="pg-button" onClick={relock}>Lock it again</button><span className="pg-note">The file now opens from the Docs folder in the drive above.</span></p>}
          <div role="status" className="ain-receipt-slot">{paid && !locked && <p className="ain-receipt"><strong>{DEMO_NOTICE}</strong> A real host would have asked the wallet to sign a payment of {PRICE} to <code>{PAYMENT_REQUIRED.accepts[0].payTo}</code> and retried the request with the signature. Here the mock drive simply marked the file as bought.</p>}</div>
        </div>
      </div>
    </section>

    {children}

    <section aria-labelledby="ain-chat">
      <h2 id="ain-chat">4. A folder chat</h2>
      <p><code>AinuiFolderChat</code> is a chat scoped to one folder. It follows the drive above (now <code>/{cwd}</code>); moving to another folder starts a new conversation. The agent here is canned: the reply is streamed in a few steps and Stop aborts it.</p>
      <div className="example"><div className="example-stage">
        <AinuiFolderChat driveId={DEMO_DRIVE_ID} path={cwd} agents={CHAT_AGENTS} onSend={chatSend} theme={theme} />
      </div></div>
    </section>
  </>;
}

// ── 4: folder chat (mock agent) ─────────────────────────────────────────────

const CHAT_AGENTS = [{ id: "librarian", label: "Librarian" }, { id: "analyst", label: "Analyst (remote)", remote: true }];

function useChatSend(drive: MockDrive, cwd: string): FolderChatSend {
  return useCallback<FolderChatSend>(async ({ q, agentId, contextId, signal, onUpdate }) => {
    const names = drive.names(cwd);
    const who = CHAT_AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
    const steps = [
      `You asked: "${q}".`,
      `I am the canned ${who} agent of this demo, so no model read your question.`,
      `The folder /${cwd} holds ${names.length} ${names.length === 1 ? "entry" : "entries"}${names.length ? `: ${names.slice(0, 8).join(", ")}${names.length > 8 ? ", …" : ""}` : ""}.`,
      "A real host would call its agent in onSend and pass each partial answer to onUpdate, exactly as this reply arrived.",
    ];
    const context = contextId ?? `demo-context-${Date.now().toString(36)}`;
    let text = "";
    for (const step of steps) {
      // Honour Stop: the wait ends at once and the turn rejects.
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(new DOMException("Stopped", "AbortError"));
        const timer = setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, 450);
        const stop = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
        signal.addEventListener("abort", stop, { once: true });
      });
      text = text ? `${text} ${step}` : step;
      onUpdate({ text, contextId: context });
    }
    return { text, contextId: context };
  }, [drive, cwd]);
}

// ── 3: pickers over mock listings ───────────────────────────────────────────

const ME: OwnerRef = { kind: "account", issuer: "https://sso.example", subject: "user-1", displayName: "You" };
const ORG: OwnerRef = { kind: "org", issuer: "https://sso.example", subject: "org-1", displayName: "Example Org" };
const MINA: OwnerRef = { kind: "account", issuer: "https://sso.example", subject: "user-2", displayName: "Mina" };

function fileItem(id: string, displayName: string, mimeType: string, size: number, more: Partial<FileListItem> & { state?: FileRef["availability"]["state"]; owner?: OwnerRef } = {}): FileListItem {
  const { state = "online", owner = ME, ...item } = more;
  return {
    ref: {
      contract: "1.0", issuer: "https://drive.example", driveId: "demo", fileId: id, revision: "r1", kind: "file", mimeType, displayName,
      ownerRef: owner, availability: { state, ...(state === "offline" ? { lastSeenAt: "2026-11-18T07:30:00.000Z" } : {}) },
      sourceUrl: `https://drive.example/d/demo/f/${id}`, size,
    },
    role: "owner", shareOrigin: "own", modifiedAt: "2026-11-20T09:00:00.000Z", ...item,
  };
}
const FILES: Record<FileListScope, FileListItem[]> = {
  mine: [
    fileItem("f-welcome", "welcome.md", "text/markdown", 184),
    fileItem("f-lake", "blue-lake.svg", "image/svg+xml", 581),
    fileItem("f-backup", "laptop-backup.zip", "application/zip", 48_211_003, { state: "offline" }),
    fileItem("f-notes", "meeting-notes.md", "text/markdown", 152),
    fileItem("f-todo", "todo.txt", "text/plain", 102),
  ],
  shared_with_me: [
    fileItem("f-report", "market-report.pdf", "application/pdf", 927, { owner: MINA, role: "none", shareOrigin: "paid", paid: { entitled: false, pricingRef: "https://drive.example/pricing/f-report" } }),
    fileItem("f-dataset", "survey-2026.csv", "text/csv", 20_480, { owner: MINA, role: "viewer", shareOrigin: "paid", paid: { entitled: true } }),
    fileItem("f-brief", "design-brief.md", "text/markdown", 3_210, { owner: MINA, role: "editor", shareOrigin: "direct" }),
  ],
  shared_with_org: [
    fileItem("f-handbook", "handbook.pdf", "application/pdf", 88_400, { owner: ORG, role: "viewer", shareOrigin: "org" }),
    fileItem("f-old-plan", "2024-plan.md", "text/markdown", 0, { owner: ORG, role: "viewer", shareOrigin: "org", state: "deleted" }),
  ],
  recent: [],
};
FILES.recent = [FILES.mine[0], FILES.shared_with_me[2], FILES.shared_with_org[0], FILES.mine[1]];

function agentItem(id: string, displayName: string, description: string, more: Partial<AgentRef> & { canInvoke?: boolean } = {}): AgentListItem {
  const { canInvoke = true, ...ref } = more;
  return {
    canInvoke,
    ref: {
      contract: "1.0", registryIssuer: "https://agents.example", agentId: id, releaseId: "rel-1", ownerRef: ME, visibility: "private",
      agentCardUrl: `https://agents.example/agents/${id}/.well-known/agent-card.json`, endpoint: `https://agents.example/agents/${id}/a2a`,
      supportedProtocolVersions: ["1.0"], skills: [{ id: "answer", name: "Answer" }], inputModes: ["text"], outputModes: ["text"],
      uiCapabilities: ["streaming", "ainui"], status: "active", displayName, description, updatedAt: "2026-11-20T09:00:00.000Z", ...ref,
    },
  };
}
const AGENTS: Record<AgentListScope, AgentListItem[]> = {
  mine: [
    agentItem("librarian", "Librarian", "Answers questions about the files in a folder.", { skills: [{ id: "summarise", name: "Summarise" }, { id: "find", name: "Find files" }], uiCapabilities: ["streaming", "cancel", "ainui", "file_refs_out"] }),
    agentItem("old-bot", "Old bot", "Switched off by its owner.", { status: "disabled" }),
  ],
  shared_with_me: [
    agentItem("analyst", "Analyst", "Shared for viewing only: you can read its card but not call it.", { ownerRef: MINA, visibility: "unlisted", canInvoke: false, uiCapabilities: ["streaming", "image_out"] }),
  ],
  shared_with_org: [
    agentItem("helpdesk", "Helpdesk", "Your organisation's internal support agent.", { ownerRef: ORG, orgRef: ORG, visibility: "org", uiCapabilities: ["streaming", "a2ui_basic"] }),
  ],
  public: [
    agentItem("translator", "Translator", "Translates documents between languages.", { visibility: "public", skills: [{ id: "translate", name: "Translate" }] }),
    agentItem("chart-maker", "Chart maker", "Turns a table into a chart.", { visibility: "public", uiCapabilities: ["ainui", "image_out"], pricingRef: "https://agents.example/pricing/chart-maker" }),
    agentItem("proofreader", "Proofreader", "Checks spelling and grammar.", { visibility: "public" }),
    agentItem("transcriber", "Transcriber", "Writes down what is said in a recording.", { visibility: "public", inputModes: ["audio"], uiCapabilities: ["audio_in", "streaming"] }),
  ],
};

const PAGE = 3;
type Listing<S extends string> = { scope: S; query: string; shown: number };

/** One page-able view over a mock listing: scope / search / more are applied here, as a host's list API would. */
function page<T>(all: T[], name: (item: T) => string, listing: Listing<string>) {
  const q = listing.query.toLowerCase();
  const matching = q ? all.filter((i) => name(i).toLowerCase().includes(q)) : all;
  return { items: matching.slice(0, listing.shown), nextCursor: listing.shown < matching.length ? String(listing.shown) : null };
}

/** Scope, search and paging are the same for both pickers; anything else is returned for the caller. */
function nextListing<S extends string>(listing: Listing<S>, action: A2uiAction): Listing<S> | null {
  const c = action.context ?? {};
  if (action.name === "ainui.picker.scope" && typeof c.scope === "string") return { scope: c.scope as S, query: "", shown: PAGE };
  if (action.name === "ainui.picker.search") return { ...listing, query: typeof c.query === "string" ? c.query : "", shown: PAGE };
  if (action.name === "ainui.picker.more") return { ...listing, shown: typeof c.cursor === "string" ? listing.shown + PAGE : PAGE };
  return null;
}

const NO_DRIVE: AinuiDeps = { run: async () => ({ kind: "err", code: "internal", message: "pickers run no skill" }), allowed: () => false, env: () => ({}) };

function Pickers({ theme }: { theme: string }) {
  const [asOf] = useState(() => new Date().toISOString());
  const [multiple, setMultiple] = useState(false);
  const [files, setFiles] = useState<Listing<FileListScope>>({ scope: "mine", query: "", shown: PAGE });
  const [agents, setAgents] = useState<Listing<AgentListScope>>({ scope: "mine", query: "", shown: PAGE });
  const [pickedFiles, setPickedFiles] = useState<FileRef[]>([]);
  const [pickedAgent, setPickedAgent] = useState<AgentRef | null>(null);
  const [fileNote, setFileNote] = useState("");
  const [agentNote, setAgentNote] = useState("");

  const fileSurface = useMemo(() => ainuiFilePicker("demo-file-picker",
    { contract: "1.0", asOf, ...page(FILES[files.scope] ?? [], (i) => i.ref.displayName, files) },
    { scope: files.scope, query: files.query, selection: multiple ? "multiple" : "single", selected: pickedFiles.map(fileKey), context: { slot: "attachment" } }),
  [asOf, files, multiple, pickedFiles]);
  const agentSurface = useMemo(() => ainuiAgentPicker("demo-agent-picker",
    { contract: "1.0", asOf, ...page(AGENTS[agents.scope] ?? [], (i) => `${i.ref.displayName} ${i.ref.description ?? ""}`, agents) },
    { scope: agents.scope, query: agents.query, selected: pickedAgent ? agentKey(pickedAgent) : "", renders: ["streaming", "cancel", "ainui", "a2ui_basic"], context: { slot: "assistant" } }),
  [asOf, agents, pickedAgent]);

  /** The dispatcher hands picker actions back untouched (`kind: "host"`): what a pick means is this page's call. */
  const hostAction = async (action: A2uiAction, note: (text: string) => void): Promise<A2uiAction | null> => {
    try {
      const reply = await dispatchAinuiAction(action, NO_DRIVE);
      if (reply.kind === "host") return reply.action;
      note(`Not a picker action: ${action?.name} ${brief(action?.context)}`);
    } catch (e) { note(`Failed: ${e instanceof Error ? e.message : String(e)}`); }
    return null;
  };
  const onFileAction = async (raw: A2uiAction) => {
    const action = await hostAction(raw, setFileNote);
    if (!action) return;
    const c = action.context ?? {};
    const listing = nextListing(files, action);
    if (listing) { setFiles(listing); setFileNote(`${action.name} ${brief({ scope: c.scope, query: c.query, cursor: c.cursor })}`); }
    else if (action.name === "ainui.picker.pick" && Array.isArray(c.refs)) { setPickedFiles(c.refs as FileRef[]); setFileNote(`${action.name}: ${c.refs.length} reference${c.refs.length === 1 ? "" : "s"}`); }
    else if (action.name === "ainui.picker.open") setFileNote(`${action.name}: a host would open ${String(c.sourceUrl)} (not opened in the demo)`);
    else setFileNote(`Unhandled: ${action.name} ${brief(c)}`);
  };
  const onAgentAction = async (raw: A2uiAction) => {
    const action = await hostAction(raw, setAgentNote);
    if (!action) return;
    const c = action.context ?? {};
    const listing = nextListing(agents, action);
    if (listing) { setAgents(listing); setAgentNote(`${action.name} ${brief({ scope: c.scope, query: c.query, cursor: c.cursor })}`); }
    else if (action.name === "ainui.picker.pick" && c.ref && typeof c.ref === "object") { setPickedAgent(c.ref as AgentRef); setAgentNote(`${action.name}: 1 reference`); }
    else if (action.name === "ainui.picker.card") setAgentNote(`${action.name}: a host would show ${String(c.agentCardUrl)} (not opened in the demo)`);
    else setAgentNote(`Unhandled: ${action.name} ${brief(c)}`);
  };

  return <section aria-labelledby="ain-pickers">
    <h2 id="ain-pickers">3. The two pickers</h2>
    <p><code>ainuiFilePicker</code> and <code>ainuiAgentPicker</code> draw a listing with scope tabs, search and paging. A pick returns the whole reference the origin listed — an identity, never bytes or a token. Rows the origin marked as unavailable stay visible with the reason and cannot be picked: an offline file and a paid file that was not bought here, a disabled agent and one you may not call.</p>
    <p className="pg-note">The pickers' built-in labels are Korean in this version of the library: 선택 = pick, 열기 = open, 카드 = card, 검색 = search, 더 보기 = more.</p>

    <h3 id="ain-file-picker">File picker</h3>
    <p className="ain-row"><label className="pg-check"><input type="checkbox" checked={multiple} onChange={(e) => { setMultiple(e.target.checked); setPickedFiles([]); }} /> Pick several files at once</label></p>
    <div className="example">
      <div className="example-stage"><AinuiSurface messages={fileSurface} theme={theme} onAction={onFileAction} /></div>
      <div className="ain-picked" aria-live="polite">
        <p className="pg-note">{fileNote || "Last action: none yet."}</p>
        <h4>Picked file reference{pickedFiles.length === 1 ? "" : "s"}</h4>
        <pre className="doc-code ain-json" tabIndex={0} data-testid="picked-files"><code>{pickedFiles.length ? JSON.stringify(pickedFiles, null, 2) : "// nothing picked yet"}</code></pre>
      </div>
    </div>

    <h3 id="ain-agent-picker">Agent picker</h3>
    <div className="example">
      <div className="example-stage"><AinuiSurface messages={agentSurface} theme={theme} onAction={onAgentAction} /></div>
      <div className="ain-picked" aria-live="polite">
        <p className="pg-note">{agentNote || "Last action: none yet."}</p>
        <h4>Picked agent reference</h4>
        <pre className="doc-code ain-json" tabIndex={0} data-testid="picked-agent"><code>{pickedAgent ? JSON.stringify(pickedAgent, null, 2) : "// nothing picked yet"}</code></pre>
      </div>
    </div>
  </section>;
}

// ── page ────────────────────────────────────────────────────────────────────

export function Ain() {
  const [settings, set] = useSettings();
  return <main className="doc ain-page">
    <div className="pg-controls docs-controls"><label>Design <select value={settings.theme} onChange={(e) => set({ theme: e.target.value })}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label></div>
    <h1>Files &amp; payments</h1>
    <p>Beyond the standard catalog, AIN-UI has components of its own for private files, uploads, x402 payments, pickers and a folder chat. This page runs them end to end in your browser with no backend and no model: a mock drive answers every action the surfaces send. Edits and uploads stay in this tab's memory and are gone when you reload.</p>
    <DriveAndPayment theme={settings.theme}><Pickers theme={settings.theme} /></DriveAndPayment>
  </main>;
}
