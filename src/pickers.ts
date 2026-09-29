/**
 * Common file / agent pickers (integration plan task 09).
 *
 * Two AINUI catalog components, `FilePicker` and `AgentPicker`, draw the
 * cross-product listing contract (`@ain/integration-contracts` list.ts):
 * scope tabs, search, paged rows and a pick action that returns the FULL
 * reference object — never bytes, tokens or signed URLs. The builders below
 * put the listing in the surface's data model (like ainuiFolder) and bind the
 * component to it, so a host can page or re-scope by updating the model.
 *
 * The renderer decides nothing about permissions: a row the origin marked
 * offline / deleted / not entitled / not invocable is shown greyed with the
 * reason, its pick control is disabled, and `open`/`card` still work. What
 * happens after `ainui.picker.pick` is the host's business.
 *
 * The contract shapes are re-declared here minimally (no dependency on the
 * contracts package); a consumer validates with the real zod schemas.
 */
import { A2UI_VERSION, type A2uiComponent, type A2uiMessage } from "./basic.js";
import { AINUI_CATALOG, PICKER_ACTIONS } from "./ainui.js";

export { PICKER_ACTIONS };

// ── contract shapes (subset of packages/contracts) ──────────────────────────

export type OwnerRef = { kind: "account" | "org" | "wallet" | "principal"; issuer: string; subject: string; displayName?: string };
export type FileAvailability = { state: "online" | "offline" | "deleted" | "unknown"; lastSeenAt?: string };
/** Identity = issuer + driveId + fileId. Carries `sourceUrl` only — no token, signed URL or secret. */
export type FileRef = {
  contract: "1.0";
  issuer: string;
  driveId: string;
  fileId: string;
  revision: string;
  kind: "file" | "folder";
  mimeType?: string;
  displayName: string;
  ownerRef: OwnerRef;
  availability: FileAvailability;
  sourceUrl?: string;
  legacy?: { path: string };
  size?: number;
  sha256?: string;
};
export type FileAccessRole = "owner" | "editor" | "viewer" | "none";
export type ShareOrigin = "own" | "direct" | "org" | "link" | "paid";
export type FileListItem = {
  ref: FileRef;
  role: FileAccessRole;
  shareOrigin: ShareOrigin;
  paid?: { entitled: boolean; pricingRef?: string };
  modifiedAt?: string;
  sharedAt?: string;
};
export type FileListScope = "mine" | "shared_with_me" | "shared_with_org" | "recent";

export type AgentVisibility = "public" | "org" | "private" | "unlisted";
export type AgentStatus = "active" | "disabled" | "stopped" | "deleted";
export type UiCapability = "streaming" | "cancel" | "image_in" | "image_out" | "audio_in" | "audio_out" | "ainui" | "a2ui_basic" | "file_refs_out";
export type AgentSkill = { id: string; name: string; description?: string; examples?: string[] };
/** Identity = registryIssuer + agentId. Seeing a card grants neither execution nor file access. */
export type AgentRef = {
  contract: "1.0";
  registryIssuer: string;
  agentId: string;
  releaseId: string;
  ownerRef: OwnerRef;
  visibility: AgentVisibility;
  orgRef?: OwnerRef;
  agentCardUrl: string;
  endpoint: string;
  supportedProtocolVersions: string[];
  skills: AgentSkill[];
  inputModes: string[];
  outputModes: string[];
  uiCapabilities: UiCapability[];
  pricingRef?: string;
  status: AgentStatus;
  displayName: string;
  description?: string;
  updatedAt: string;
};
export type AgentListItem = { ref: AgentRef; canInvoke: boolean };
export type AgentListScope = "mine" | "shared_with_me" | "shared_with_org" | "public";

type ListResponseBase = { contract: "1.0"; asOf: string; nextCursor: string | null; cursorExpired?: boolean };
export type FileListResponse = ListResponseBase & { items: FileListItem[] };
export type AgentListResponse = ListResponseBase & { items: AgentListItem[] };

export const fileKey = (r: Pick<FileRef, "issuer" | "driveId" | "fileId">) => `${r.issuer}#${r.driveId}#${r.fileId}`;
export const agentKey = (r: Pick<AgentRef, "registryIssuer" | "agentId">) => `${r.registryIssuer}#${r.agentId}`;

// ── labels and row rules (shared by the React renderer; renderer.js mirrors them) ──

export const FILE_SCOPES: ReadonlyArray<{ value: FileListScope; label: string }> = [
  { value: "mine", label: "내 파일" }, { value: "shared_with_me", label: "나에게 공유됨" },
  { value: "shared_with_org", label: "조직 공유" }, { value: "recent", label: "최근" },
];
export const AGENT_SCOPES: ReadonlyArray<{ value: AgentListScope; label: string }> = [
  { value: "mine", label: "내 에이전트" }, { value: "shared_with_me", label: "나에게 공유됨" },
  { value: "shared_with_org", label: "조직 공유" }, { value: "public", label: "공개" },
];
export const SHARE_ORIGIN_LABEL: Record<ShareOrigin, string> = { own: "내 파일", direct: "직접 공유", org: "조직 공유", link: "링크 공유", paid: "유료 공유" };
export const ROLE_LABEL: Record<FileAccessRole, string> = { owner: "소유자", editor: "편집 가능", viewer: "보기 전용", none: "권한 없음" };
export const AVAILABILITY_LABEL: Record<FileAvailability["state"], string> = { online: "온라인", offline: "오프라인", deleted: "삭제됨", unknown: "확인 안 됨" };
export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = { active: "활성", disabled: "비활성", stopped: "중지됨", deleted: "삭제됨" };
export const VISIBILITY_LABEL: Record<AgentVisibility, string> = { public: "공개", org: "조직", private: "비공개", unlisted: "링크 공개" };
export const PAID_BADGE = "구매 필요";
export const MORE_LABEL = "더 보기";

/** Why a file row cannot be picked (null = pickable). `open` is still allowed: the origin's page explains itself. */
export function filePickReason(item: FileListItem): string | null {
  const state = item.ref.availability?.state;
  if (state === "offline") return "오프라인: 보관 기기가 연결되어 있지 않아 지금은 사용할 수 없습니다";
  if (state === "deleted") return "삭제됨: 원본이 더 이상 존재하지 않습니다";
  if (item.paid && !item.paid.entitled) return "구매 필요: 구매 후 사용할 수 있습니다";
  return null;
}

/** Why an agent row cannot be selected for invocation (null = selectable). Viewing its card is always allowed. */
export function agentPickReason(item: AgentListItem): string | null {
  if (item.ref.status !== "active") return `${AGENT_STATUS_LABEL[item.ref.status] ?? item.ref.status}: 새 호출을 받지 않습니다`;
  if (!item.canInvoke) return "호출 권한이 없습니다";
  return null;
}

/** Enabled = the agent offers it and the consumer renders it; the rest fall back (contract capability.ts). */
export function capabilityLines(agent: Pick<AgentRef, "uiCapabilities">, renders: readonly string[] | undefined) {
  const r = new Set(renders ?? []);
  const caps = agent.uiCapabilities ?? [];
  return { enabled: caps.filter((c) => r.has(c)), fallbacks: caps.filter((c) => !r.has(c)) };
}

// ── builders ────────────────────────────────────────────────────────────────

type PickerOpts = {
  /** Search text the listing was made with (echoed in the field). */
  query?: string;
  /** Extra fields merged into every `ainui.picker.*` action (a host correlation id, a target slot). No secrets. */
  context?: Record<string, unknown>;
};
export type FilePickerOpts = PickerOpts & { scope: FileListScope; selection?: "single" | "multiple"; selected?: string[] };
export type AgentPickerOpts = PickerOpts & { scope: AgentListScope; selected?: string; renders?: UiCapability[] };

function pickerSurface(surfaceId: string, component: A2uiComponent, data: Record<string, unknown>): A2uiMessage[] {
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: AINUI_CATALOG } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components: [component] } },
    { version: A2UI_VERSION, updateDataModel: { surfaceId, path: "/", value: data } },
  ];
}
const bind = (name: string) => ({ path: `/${name}` });

/** A `FilePicker` surface over one page of a file listing. Refs are passed through as the origin sent them. */
export function ainuiFilePicker(surfaceId: string, response: FileListResponse, opts: FilePickerOpts): A2uiMessage[] {
  const component: A2uiComponent = {
    id: "root", component: "FilePicker",
    items: bind("items"), scope: bind("scope"), query: bind("query"), cursor: bind("cursor"), asOf: bind("asOf"),
    cursorExpired: bind("cursorExpired"), selection: bind("selection"), selected: bind("selected"), context: bind("context"),
  };
  return pickerSurface(surfaceId, component, {
    items: response.items,
    scope: opts.scope,
    query: opts.query ?? "",
    cursor: response.nextCursor ?? null,
    asOf: response.asOf,
    cursorExpired: response.cursorExpired === true,
    selection: opts.selection ?? "single",
    selected: opts.selected ?? [],
    context: opts.context ?? {},
  });
}

/** An `AgentPicker` surface over one page of an agent listing. */
export function ainuiAgentPicker(surfaceId: string, response: AgentListResponse, opts: AgentPickerOpts): A2uiMessage[] {
  const component: A2uiComponent = {
    id: "root", component: "AgentPicker",
    items: bind("items"), scope: bind("scope"), query: bind("query"), cursor: bind("cursor"), asOf: bind("asOf"),
    cursorExpired: bind("cursorExpired"), selected: bind("selected"), renders: bind("renders"), context: bind("context"),
  };
  return pickerSurface(surfaceId, component, {
    items: response.items,
    scope: opts.scope,
    query: opts.query ?? "",
    cursor: response.nextCursor ?? null,
    asOf: response.asOf,
    cursorExpired: response.cursorExpired === true,
    selected: opts.selected ?? "",
    renders: opts.renders ?? [],
    context: opts.context ?? {},
  });
}
