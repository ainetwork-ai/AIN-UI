# AIN-UI

AIN-UI extends **A2UI v0.9** with grids, file tiles, private assets, file upload,
and x402 payments. It carries these surfaces over standard **AG-UI** activity
events, MCP metadata, or A2A DataParts. The React renderer extends the official
`@a2ui/react` catalog; protocol state and bindings use `@a2ui/web_core`.

## Install

```sh
npm install ain-ui react react-dom
```

```tsx
"use client";
import { AinuiSurface } from "ain-ui/react";
import "ain-ui/styles.css";

<AinuiSurface messages={messages} onAction={handleAction}
  resolveAsset={(asset, options) => authorizedAssetUrl(asset, options)} />
```

`messages` is an A2UI v0.9 message array. `onAction` receives the resolved A2UI
`{name, surfaceId, sourceComponentId, timestamp, context}` and can return a Promise.
The component mounts in the browser (the upstream renderer does not support SSR).

## Catalog

Catalog ID: `https://aindrive.ainetwork.ai/ainui/v1/catalog.json`.
The existing ID is retained for compatibility with aindrive clients.

All basic A2UI components are available, plus:

| Component | Purpose |
| --- | --- |
| Toolbar | Wrapping file controls with mobile view toggles |
| Grid | Responsive columns, including A2UI child templates |
| Tile | File/folder thumbnail, label, caption and action |
| FileView | Image, video, audio, PDF preview and download |
| Breadcrumbs | Folder navigation |
| Segmented | List/grid view selection |
| FileUpload | Local file selection and upload action, up to 8 MiB per file |
| X402Payment | Amount, currency, network, recipient and explicit payment action |
| FolderChat | Per-folder agent chat with agent selection, progressive replies and stop |
| FilePicker | Common file picker over the shared listing contract: scopes, search, paging, availability and entitlement badges |
| AgentPicker | Common agent picker: scopes, search, status/visibility, skills and capability fallbacks |

Private files use `{$asset: {drive_id, path, variant, mime, v?}}` references.
Hosts resolve them through their authenticated asset routes. Browser wallet
keys and account credentials never belong in a surface.

## Producers and transports

The package exports `ainuiFolder`, `ainuiFile`, `ainuiEditor`, `ainuiPayment`,
`ainuiFilePicker`, `ainuiAgentPicker`, `ainuiForSkill`, and `dispatchAinuiAction`. File action execution is injected
with `run`, `allowed`, and `env`; hosts enforce identity, roles and path bounds.
Aindrive's server adapters implement those callbacks.

```ts
import { ainuiActivity, messagesFromActivity } from "ain-ui";
const event = ainuiActivity("files", messages);
// ACTIVITY_SNAPSHOT / a2ui-surface / content.a2ui_operations
```

Aindrive negotiation: MCP `X-AINUI: 1`, AG-UI `forwardedProps.ainui = true`,
A2A `metadata.ainui = true`. Paid-share HTTP responses also accept `X-AINUI: 1`
and include `messages` next to the unchanged x402 `PAYMENT-REQUIRED` header.

## Upload

`FileUpload` emits `aindrive.upload` with `{drive_id, path, name, content,
encoding: "base64"}`. `path` is the destination folder. The dispatcher validates
the name, encoding, decoded size, allow-list and write permission, then calls
`write_file`. Existing names follow the storage host's overwrite policy.
The 8 MiB limit keeps JSON transports bounded; larger files use the host's
resumable upload endpoint. Do not put raw filesystem paths in client actions.

## x402

`ainuiPayment` uses the exact requirements that produced `PAYMENT-REQUIRED`.
`X402Payment` emits `aindrive.x402.pay` only after a user click. The host obtains
the user's wallet and handles signing locally, then sends `PAYMENT-SIGNATURE`
to the original authorized resource. The server revalidates price, recipient
and entitlement. No transfer is made by rendering a surface.

```ts
import { signX402Payment } from "ain-ui/x402";
const { header } = await signX402Payment(action.context.paymentRequired, signer);
```

This adapter uses official `@x402/core` and `@x402/evm` SDKs. It supports EVM
exact EIP-3009 authorizations; Permit2 requires the host's approval flow.
Aindrive's native checkout also supports Permit2 through its existing SDK flow.

## Other hosts

`ain-ui/renderer` exports the dependency-free DOM renderer and its CSS for
MCP Apps and non-React hosts. Both renderers understand the same catalog.
The pure protocol/builders are available from `ain-ui` without importing React.

## Development

```sh
npm ci
npm run build
npm test
npm pack --dry-run
```

Source extracted from aindrive's existing AINUI implementation. aindrive and
ainmem consume this package; protocol and component changes belong here.

### Host file previews

`AinuiSurface` accepts `renderFile({ src, download, name, mime, size })` to
render a `FileView` with the host's document, spreadsheet or other rich preview.
The URLs have already passed the renderer's URL checks and asset resolver.
Keep authentication and file permissions in the host's byte-serving routes.
Omit this callback to use the built-in media preview and download view.

## Pickers

`ainuiFilePicker(surfaceId, fileListResponse, { scope, selection })` and
`ainuiAgentPicker(surfaceId, agentListResponse, { scope, renders })` build the
`FilePicker` / `AgentPicker` surfaces from the cross-product listing contract
(`FileListResponse` / `AgentListResponse`; minimal types are exported from `ain-ui`).
Items live in the data model; both renderers draw scope tabs, search, `더 보기` paging
and rows with share-origin, role, availability, status and capability badges.
Offline, deleted, unentitled (`구매 필요`) or non-invocable rows stay visible but
their pick control is disabled with the reason. Actions `ainui.picker.scope | search |
more | pick | open | card` (`PICKER_ACTIONS`) go to the host untouched
(`dispatchAinuiAction` answers `{kind: "host", action}`); `pick` carries the full
`FileRef[]` / `AgentRef`. The "no credentials in surfaces" rule applies: refs carry a
public `sourceUrl` / `agentCardUrl` only — never bytes, tokens or signed URLs.

## Folder chat

`ainuiFolderChat(state)` produces the `FolderChat` A2UI catalog component.
`AinuiFolderChat` from `ain-ui/react` hosts agent selection, progressive replies,
stop, errors and per-folder/per-agent conversation ids. Supply `onSend` to connect
the host's authenticated API; it receives an AbortSignal and `onUpdate`.
`readChatStream` reads AG-UI SSE, including `ainui.chat.snapshot` custom events;
`ainuiActivity` wraps full folder-chat surfaces for other A2UI hosts.
`A2aChatAccumulator` combines A2A status/task/artifact events without replaying
a failed request or duplicating snapshot text. Native agents without streaming
continue to return one final response.

`listFolderTree` lists descendants within the selected root, with entry, depth
and directory limits. It reports partial/error results instead of treating them
as an empty or complete folder. No host credentials belong in UI messages.

## AI Network integration versions

This repository takes part in the AI Network integration (shared files, shared agents, delegated access). It follows the version pins below. They are a **proposal** (plan item 20.4) and become final once all five products adopt them. PRs that change them use a `contract:` or `a2a:` title prefix.

| Component | Pinned version | Supported range | Deprecation schedule |
|---|---|---|---|
| Integration contract `@ain/integration-contracts` | **v1.1** (1.1.0); documents keep `contract: "1.0"` for all of 1.x | 1.x adds optional fields only; any change of meaning is 2.0 | After 2.0 ships, 1.x is still accepted for 6 months; a product may reject by the `contract` value |
| AIN-UI renderer (`ain-ui`) | **0.3.0** (catalog v1 URL unchanged; adds FilePicker/AgentPicker) | Consumers on 0.2.3 must move to 0.3.0 | Unknown components are skipped by the renderer (backward compatible) |
| A2A | **0.3.0** (Ainize cards advertise 1.0 and 0.3) | 0.3.0 required for product consumers; 1.0 optional | 0.3 support ends 3 months after all five products can negotiate 1.0 |
| A2A data parts | `ai.ain/file-refs`, `ai.ain/delegation` (`metadata.type`) | Names never change | Fields are only added |
| Delegation token | `ain-rdlg+jwt`, TTL ≤ 1 h | Verified with the SSO SDK `verifyResourceDelegation` | Claims are only added; removing one is 2.0 |
| aindrive file IDs | Phase A `p1:` | When Phase B `f1:` lands, `p1:` stays valid for 6 months with a `movedFrom` hint in listings | `legacy.path` is not a durable identifier |

Product routes (`/api/ain/shared-files`, `/api/ain/shared-agents`, `/api/ain/invoke`, `/api/ain/events`) sit behind the `AIN_INTEGRATION_ENABLED` flag.

This package is the renderer; its current version is 0.3.0. Consumers still on 0.2.3 need to upgrade.

The source of record is the integration plan's versioning note (`docs/20-versioning.md` in the ain-integration workspace, not yet published). This line will link to it once it is published.
