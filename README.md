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
| Grid | Responsive columns, including A2UI child templates |
| Tile | File/folder thumbnail, label, caption and action |
| FileView | Image, video, audio, PDF preview and download |
| Breadcrumbs | Folder navigation |
| Segmented | List/grid view selection |
| FileUpload | Local file selection and upload action, up to 8 MiB per file |
| X402Payment | Amount, currency, network, recipient and explicit payment action |

Private files use `{$asset: {drive_id, path, variant, mime, v?}}` references.
Hosts resolve them through their authenticated asset routes. Browser wallet
keys and account credentials never belong in a surface.

## Producers and transports

The package exports `ainuiFolder`, `ainuiFile`, `ainuiEditor`, `ainuiPayment`,
`ainuiForSkill`, and `dispatchAinuiAction`. File action execution is injected
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
