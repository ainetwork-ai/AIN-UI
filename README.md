# AIN-UI

AIN-UI is an **A2UI 1.0** component library, renderer and agent toolkit.

- **One catalog, 79 components.** The 69 standard generative-UI components (the same names and props as
  CopilotKit's Gen UI 2.0 standard catalog, so an agent written for one draws on the other) plus AIN's own for
  files, upload, x402 payment, folder chat and pickers.
- **Two renderers.** React (`ain-ui/react`, on the official `@a2ui/react` + `@a2ui/web_core`) and a
  dependency-free DOM renderer (`ain-ui/renderer`) for MCP Apps and non-React hosts.
- **The agent side.** `ain-ui/agent` gives a model the catalog, a `render_ui` tool, and checks and compiles what
  the model writes — A2UI Express (one line per component) or JSON — before anything reaches a renderer.
- **A playground.** <https://ainui.ainetwork.xyz> — ask for a UI, see what the model wrote and what was drawn.

Surfaces travel over standard **AG-UI** activity events, MCP metadata, or A2A DataParts. v0.9 messages (and
AINUI v1 surfaces) are upgraded to 1.0 on the way in, so existing producers keep working.

## Install

```sh
npm install ain-ui react react-dom
```

```tsx
"use client";
import { AinuiSurface } from "ain-ui/react";
import "ain-ui/styles.css";

<AinuiSurface
  messages={messages}
  onAction={handleAction}
  sendMessage={(text) => sendUserMessage(text)}
  resolveAsset={(asset, options) => authorizedAssetUrl(asset, options)}
  theme="ain"
/>
```

- `messages` is an array of A2UI messages (1.0, or v0.9). **Appending** to the array updates the surfaces in
  place — inputs keep their text, tabs their selection; any other change redraws.
- `onAction` receives the resolved action `{name, surfaceId, sourceComponentId, timestamp, context}` and can return
  a Promise. `onMessage` receives every renderer→agent message as the 1.0 envelope; `onError` what was rejected.
- A message that does not match the catalog is **not drawn**: the surface shows the reason and `onError` is called.
- `sendMessage` is called when a `FollowUp` suggestion is chosen.
- `theme` picks a design system: `ain` (default), `plain`, `material`, `terminal`, or your own (below).
- The component mounts in the browser (the upstream renderer does not render on the server).

Tell the agent what this renderer draws with `ainuiCapabilities()` (catalog ids) or
`ainuiCapabilities({ inline: true })` (the catalog documents themselves), sent as
`a2uiRendererCapabilities` in the request metadata.

## Catalog

Catalog id: `https://ainui.ainetwork.xyz/catalogs/ainui/v2/catalog.json` (`AINUI_CATALOG`). The document is
`ain-ui/catalog.json`, and `AINUI_CATALOG_DOCUMENT` in code.

| Group | Components |
| --- | --- |
| Layout | Box, Column, Row, Grid, GridItem, Card, Flow, FlowItem, Carousel, CarouselItem, CarouselMediaItem, Spacer, Divider, Tabs |
| Text | Title, Text, Caption, Label, Bold, Italic, Underline, Strikethrough, Badge, Blockquote, Code, Markdown, Math, ShimmerText, Link, Tooltip |
| Inputs | Button, Pressable, Form, TextField, TextArea, Select, CheckBox, Radio, RadioGroup, Slider, SegmentedControl, ChoicePicker, DateTimeInput |
| Data | Table, TableSection, TableRow, TableCell, List, ListItem, Chart, Map |
| Media | Image, Icon, Favicon, Svg, Video, AudioPlayer, HtmlView |
| Feedback | PulseIndicator, FlashcardFlip, Popover, PopoverTrigger, PopoverContent, Modal |
| Composites | LinkCard, Citation, FollowUp, EntityCard, ImageGrid |
| AIN | Toolbar, Tile, FileView, Breadcrumbs, Segmented, FileUpload, X402Payment, FolderChat, FilePicker, AgentPicker |

Functions: the A2UI basic ones (`required`, `regex`, `length`, `numeric`, `email`, `formatString`,
`formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `openUrl`, `and`, `or`, `not`) plus `calc`
(arithmetic over named values) and `series` (a generated list, for chart data). `calc` and `series` are evaluated
by a parser, never by `eval`.

Private files use `{$asset: {drive_id, path, variant, mime, v?}}` references. Hosts resolve them through their
authenticated asset routes (`resolveAsset`). Browser wallet keys and account credentials never belong in a surface.

Chart draws SVG itself; Map draws OpenStreetMap raster tiles (set `mapTileUrl` on the host to use another tile
server); Icon loads Lucide icons on demand; Math uses KaTeX when the host has it installed and shows the TeX
source otherwise.

### Design systems

Every colour, radius and font is a CSS variable on `.ain-ui` (`src/styles/00-tokens.css`). Set them, or scope a
set under a theme name and pass it as `theme`:

```css
.ain-ui[data-ainui-theme="mine"] {
  --ainui-primary: #0f766e; --ainui-primary-fg: #fff;
  --ainui-radius: 6px; --ainui-font: "Inter", sans-serif;
}
```

`data-ainui-scheme="light" | "dark"` on the same element pins the colour scheme; without it the system setting decides.

## Agents

```ts
import { createUiAuthor, catalogsFor, rendererCapabilities } from "ain-ui/agent";
import { AINUI_MACROS } from "ain-ui/macros";

const capabilities = rendererCapabilities(request.metadata);   // undefined → the client did not ask for A2UI
const author = createUiAuthor({ format: "json", catalogs: catalogsFor(capabilities), macros: AINUI_MACROS });

const reply = await openai.chat.completions.create({
  model, tools: [author.tool],
  messages: [{ role: "system", content: `${systemPrompt}\n\n${author.prompt}` }, ...history],
});
for (const call of reply.choices[0].message.tool_calls ?? []) {
  try { send(author.fromToolCall(call.function.arguments)); }      // validated A2UI 1.0 messages
  catch (e) { if (e instanceof UiError) tellTheModel(call.id, e.message); else throw e; }
}
```

- `format: "express"` — the model writes A2UI Express; `author.fromToolCall({ express })` compiles it.
  `format: "json"` — the model passes `{ components, data }`; with `surfaceId` it updates an earlier surface.
- What a model usually gets wrong is forgiven rather than refused: a prop the component does not have is dropped,
  a number written as a string is converted, an id that is not an identifier is renamed (references follow),
  a component no parent uses is left out. Pass an array as the second argument to collect what was tidied.
  Everything else comes back as a `UiError` whose message is written for the model.
- The prompt uses a compact catalog (containers without their twenty rarely used layout props); validation uses
  the full one. `compact: false` lists everything.
- `author.fromText(text)` reads fenced blocks (`<a2ui>…</a2ui>`, `<a2ui-json>…</a2ui-json>`) for models without
  tool calling. `toExpress(messages)` turns messages back into Express. `exportSkills({ format })` returns the
  Markdown skill files that teach a coding agent this catalog.

### As a service

The playground also serves the catalog guide and the checker to agent hosts that would rather not install this
package: `POST https://ainui.ainetwork.xyz/api/ui/author {capabilities, format?}` returns `{prompt, tool}` for the
catalogs the renderer draws, and `POST …/api/ui/render {capabilities, format?, args}` returns `{messages, notes}`
or `422 {error: {code: "ui_invalid", message}}` with a message to hand back to the model. No model is called.
ainize hosted agents use it for their `render_ui` tool.

### Macros

A macro is one short call the model writes that the server expands into standard components before anything is
sent — the renderer never sees its name. `ain-ui/macros` has `FileCard`, `PaymentCard` and `AgentCard`; write your
own with `defineMacro({ name, description, props, expand })`.

## Producers and transports

The package exports `ainuiFolder`, `ainuiFile`, `ainuiEditor`, `ainuiPayment`, `ainuiFilePicker`,
`ainuiAgentPicker`, `ainuiForSkill`, and `dispatchAinuiAction`. They emit A2UI 1.0. File action execution is
injected with `run`, `allowed`, and `env`; hosts enforce identity, roles and path bounds. Aindrive's server
adapters implement those callbacks.

```ts
import { ainuiActivity, messagesFromActivity, upgradeMessages } from "ain-ui";
const event = ainuiActivity("files", messages);
// ACTIVITY_SNAPSHOT / a2ui-surface / content.a2ui_operations
```

`upgradeMessages(messages)` converts v0.9 messages to 1.0 (bindings `{path}` → `{"@path"}`, `checks` →
`@checks`, heading `Text` → `Title`, the AINUI v1 catalog id → v2); `AinuiSurface` and the DOM renderer already
do it on input. MIME type: `application/a2ui+json` (`A2UI_MIME`).

Aindrive negotiation is unchanged: MCP `X-AINUI: 1`, AG-UI `forwardedProps.ainui = true`, A2A
`metadata.ainui = true`. Paid-share HTTP responses also accept `X-AINUI: 1` and include `messages` next to the
unchanged x402 `PAYMENT-REQUIRED` header.

## Upload

`FileUpload` emits `aindrive.upload` with `{drive_id, path, name, content, encoding: "base64"}`. `path` is the
destination folder. The dispatcher validates the name, encoding, decoded size, allow-list and write permission,
then calls `write_file`. Existing names follow the storage host's overwrite policy. The 8 MiB limit keeps JSON
transports bounded; larger files use the host's resumable upload endpoint. Do not put raw filesystem paths in
client actions.

## x402

`ainuiPayment` uses the exact requirements that produced `PAYMENT-REQUIRED`. `X402Payment` emits
`aindrive.x402.pay` only after a user click. The host obtains the user's wallet and handles signing locally, then
sends `PAYMENT-SIGNATURE` to the original authorized resource. The server revalidates price, recipient and
entitlement. No transfer is made by rendering a surface.

```ts
import { signX402Payment } from "ain-ui/x402";
const { header } = await signX402Payment(action.context.paymentRequired, signer);
```

This adapter uses official `@x402/core` and `@x402/evm` SDKs. It supports EVM exact EIP-3009 authorizations;
Permit2 requires the host's approval flow.

## Other hosts

`ain-ui/renderer` exports the dependency-free DOM renderer and its CSS for MCP Apps and non-React hosts. It
reads 1.0 and v0.9 messages and draws the A2UI basic components and the AIN components (files, payment,
pickers, folder chat); the rest of the standard catalog is React-only.

### Host file previews

`AinuiSurface` accepts `renderFile({ src, download, name, mime, size })` to render a `FileView` with the host's
document, spreadsheet or other rich preview. The URLs have already passed the renderer's URL checks and asset
resolver. Keep authentication and file permissions in the host's byte-serving routes.

## Moving from 0.x

- `AinuiSurface` takes the same props; `messages` may stay v0.9. Builders now return 1.0 messages
  (`version: "1.0"`, `{"@path"}` bindings) — code that inspects their output must read the new shapes.
- `AINUI_CATALOG` is the v2 id; `AINUI_CATALOG_V1` is the old one. Surfaces naming v1 are upgraded.
- The React catalog replaces the A2UI basic components with the standard ones of the same name (a superset of
  props). `Button` still accepts `action`, `confirm` and `tone`; `Grid` still accepts `minItemWidth`.
- `@a2ui/react` and `@a2ui/web_core` are now `^0.16.1`.

## Development

```sh
npm ci
npm run build      # catalog → src/catalog/standard.gen.ts, tsc, styles, dist/catalog.json
npm test
```

The playground is in `demo/` (`npm ci && npm run build && npm start` after building the library) and deploys to
ainize from the repository's `ainize.json`. `demo/evals/run.mjs` measures models and formats on a fixed set of
requests; `docs/PLAN-a2ui-1.0.md` is the plan this version followed.

The standard components' names, props and descriptions come from CopilotKit's A2UI playground catalog (MIT);
see `NOTICE`.

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

This package is the renderer; its current version is 1.0.0 (A2UI 1.0, catalog v2; v0.9 and catalog v1 surfaces are still drawn). The renderer pin in the table above is the integration proposal's and has not been revisited for 1.0. Consumers still on 0.2.3 need to upgrade; see "Moving from 0.x" above.

The source of record is the integration plan's versioning note (`docs/20-versioning.md` in the ain-integration workspace, not yet published). This line will link to it once it is published.
