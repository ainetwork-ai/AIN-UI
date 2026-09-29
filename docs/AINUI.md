# AINUI v1 — the AIN UI protocol (A2UI v0.9 + the components A2UI's basic catalog lacks)

AINUI is **not** a new wire format. It is A2UI v0.9 — the same messages
(`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`), the same
component model (flat list of `{id, component, ...props}`, children by id or template
`{componentId, path}`), the same data binding (`{path}`; relative paths inside
templates), the same client→server action (`{name, surfaceId, sourceComponentId,
context}`) — with a **custom catalog**, which A2UI allows through `catalogId`:

```
catalogId: "https://aindrive.ainetwork.ai/ainui/v1/catalog.json"
```

The AINUI catalog = every A2UI v0.9 basic-catalog component, unchanged, **plus** the
components below. A surface declares one catalog; an AINUI surface may use any basic
component and any AINUI component.

Why: the basic catalog has no grid/wrap layout, no thumbnail tile, no way to reference
private file bytes, no rich file viewer, and aindrive's actions were read-only. The A2UI
maintainers declined new basic components (a2ui-project/a2ui#2674) and recommend custom
catalogs — that is what AINUI is.

## 1. Negotiation (opt-in; plain A2UI clients see no change)

| Transport | Client asks for AINUI with | Server then |
|---|---|---|
| MCP (Streamable HTTP) | request header `X-AINUI: 1` | builds every `_meta["ai.aindrive/a2ui"]` surface with the AINUI catalog |
| AG-UI | `forwardedProps.ainui = true` | ACTIVITY_SNAPSHOT `a2ui-surface` carries AINUI surfaces |
| A2A | message `metadata["ainui"] = true` | DataParts carry AINUI surfaces |

Without the opt-in the server emits basic-catalog surfaces exactly as before (list
rows, inline preview), and the AINUI-only actions (§5) are unknown (`unknown action: …`).
The MCP `_meta` key stays `ai.aindrive/a2ui`; the catalog tells the renderer which one
it got. `X-AINUI` is in the MCP endpoints' CORS `Access-Control-Allow-Headers`. The A2A
agent card lists the AINUI catalog in the A2UI extension's `supportedCatalogIds`.

## 2. Assets — how a surface references private file bytes

A surface never embeds a drive URL that only works with aindrive's cookie. It puts an
**asset reference** in the data model and binds to it:

```json
{ "$asset": { "drive_id": "qHdqpS7Dcife", "path": "Camera/IMG_1.jpg",
              "variant": "thumb", "mime": "image/jpeg", "v": 1790371220456 } }
```

- `variant`: `"thumb"` (small preview image, ≤256px webp) or `"original"` (the bytes).
- `v`: cache key (the file's `mtimeMs`); hosts may cache a resolved thumb forever by `(drive_id, path, v)`.
  `v` is **absent** when the server doesn't know the mtime (search results, a file view
  built from `read_file`); such an asset must not be cached forever.
- **Hosts resolve assets before drawing**, each through its own authorized route:
  aindrive web → `/api/drives/{drive_id}/fs/thumbnail|stream`; ainmem →
  `/api/aindrive/thumb|raw` (server-side proxy with the viewer's token). A component
  prop that accepts a `Media` value accepts a URL string **or** an asset reference.
- aindrive's thumbnail/stream/download routes accept `Authorization: Bearer <session JWT>`
  as well as the cookie, so server-side hosts can proxy them. Only the session JWT (the
  one `/mcp` accepts) — MCP/OAuth tokens are not sessions; a bearer that is present but
  invalid is `401` (never a fall-back to the cookie); role, paid carve-out (`402`) and
  system-path (`403`) checks are unchanged.
- Thumbs: items get a `thumb` asset for images, videos and PDFs (never for a locked paid
  entry). aindrive's `fs/thumbnail` currently renders **images** only (raster → ≤256px
  webp, SVG passed through); a video/PDF thumb answers `415`, and the host draws the
  kind icon (§3 Tile).

## 3. Components (in addition to the basic catalog)

Types: `Dyn<T>` = literal `T` or `{path}`; `Media` = `Dyn<string | AssetRef>`;
`Children` = `string[]` or `{componentId, path}` template; `Action` = A2UI action (`{event: {name, context}}`).

| Component | Props | Meaning |
|---|---|---|
| `FileUpload` | `label: Dyn<string>`, `maxBytes?: number`, `action: Action` | Select a local file; emit name, base64 content and encoding. The dispatcher caps decoded content at 8 MiB and checks write permission. |
| `X402Payment` | `amount`, `currency`, `network`, `payTo`: `Dyn<string>`; `action: Action` | Display payment terms and emit `aindrive.x402.pay` on user click. The host owns wallet signing and submission. |
| `Grid` | `children: Children`, `minItemWidth?: number` (px, default 128), `gap?: number` (px, default 8) | Responsive wrapping grid: as many columns as fit at `minItemWidth`. |
| `Tile` | `media?: Media`, `kind: Dyn<"image"\|"video"\|"audio"\|"pdf"\|"folder"\|"file">`, `label: Dyn<string>`, `caption?: Dyn<string>`, `action?: Action` | A square thumbnail tile. With no `media` (or on load error) the host draws a kind icon. Tapping fires `action`. |
| `FileView` | `src: Media`, `name: Dyn<string>`, `mime?: Dyn<string>`, `size?: Dyn<number>` | Show one file with the host's best viewer (image zoom, video/audio player, PDF, sheet, text, …) and a download affordance. |
| `Breadcrumbs` | `items: Dyn<{label, path}[]>`, `action: Action` | Path trail; tapping item *i* fires `action` with `context.path` = that item's `path` (context values may bind to the template item). The **last** item is the current location: draw it as plain text, not tappable. |
| `Segmented` | `options: {value, label}[]`, `value: Dyn<string>`, `action: Action` | A small segmented control (e.g. list/grid); tapping an option writes it to the `value` binding and fires `action` with `context.value` = that option's `value`. |
| `FilePicker` | `items: Dyn<FileListItem[]>`, `scope: Dyn<"mine"\|"shared_with_me"\|"shared_with_org"\|"recent">`, `query?: Dyn<string>`, `cursor?: Dyn<string\|null>`, `asOf?: Dyn<string>`, `cursorExpired?: Dyn<boolean>`, `selection: Dyn<"single"\|"multiple">`, `selected?: Dyn<string[]>` (fileKeys `issuer#driveId#fileId`), `context?: Dyn<object>` | The common file picker over the cross-product listing contract (`FileListItem = {ref: FileRef, role, shareOrigin, paid?, …}`). Draws scope tabs, a search field, one row per item (kind icon, name, share-origin badge, role, availability badge; `구매 필요` on a paid share the caller is not entitled to) and `더 보기` while `cursor` is non-null. Offline / deleted / unentitled rows stay visible, greyed, with the reason text; their pick control is disabled and announces the reason (`aria-label`), while `열기` still fires `ainui.picker.open` with the ref's `sourceUrl`. `multiple` toggles rows and sends them all with one `N개 선택 완료`. Fires the `ainui.picker.*` actions (§5) with `context` merged in. |
| `AgentPicker` | `items: Dyn<{ref: AgentRef, canInvoke: boolean}[]>`, `scope: Dyn<"mine"\|"shared_with_me"\|"shared_with_org"\|"public">`, `query?`, `cursor?`, `asOf?`, `cursorExpired?`, `selected?: Dyn<string>` (agentKey `registryIssuer#agentId`), `renders?: Dyn<string[]>` (the consumer's ui capabilities), `context?` | The common agent picker. Rows show `displayName`, `description`, up to 3 skills, a status badge (active / disabled / stopped / deleted), a visibility badge and a capability line: `지원: …` = `ref.uiCapabilities ∩ renders`, `대체: …` = the rest (the consumer falls back per the contract's `FALLBACK` table). `canInvoke=false` or `status != active` keeps the row (and `카드`) but disables `선택` with the reason. |

Picker rows carry **references only** (`FileRef` / `AgentRef` as the origin listed them):
identity, revision, display name, availability, a public `sourceUrl` / `agentCardUrl`.
No bytes, tokens, signed URLs or entitlements travel in a picker surface or its actions;
the host obtains access at use time from the caller's own context. The renderer applies
no permission logic — the origin's flags only decide which control is enabled.

Extension props on basic components (basic renderers ignore them):

| On | Prop | Meaning |
|---|---|---|
| `Button` | `confirm?: Dyn<string>` | Ask this question (host dialog) before firing the action. |
| `Button` | `tone?: "danger"` | Destructive styling. |
| `Text` | `variant: "mono"` | Monospace (paths, ids). |

Fallback: an AINUI renderer that meets an unknown component draws its children if it has
any, else nothing — never an error. A basic renderer handed an AINUI surface will skip
AINUI components; servers therefore only send AINUI surfaces to clients that opted in.

## 4. aindrive surfaces in AINUI mode

**Folder** (`list_files`, `aindrive.open` on a folder, `aindrive.view`):

```
Column root
 ├ Breadcrumbs crumbs            items /crumbs  → aindrive.open {drive_id, path, is_dir:true}
 ├ Row toolbar                   [search_field, search_btn, view, new_btn]
 │   TextField search_field      value /query
 │   Button search_btn           → aindrive.search {drive_id, query:{path:/query}, path:/path}
 │   Segmented view              options list|grid, value /view → aindrive.view {drive_id, path, value}
 │   Button new_btn              → aindrive.new_file {drive_id, path:/path, name:{path:/new_name}}   (write scope only)
 ├ Grid grid   (view=grid)       template tile over /items
 │   Tile tile                   media {path: thumb}, kind {path: kind}, label {path: name}, caption {path: meta},
 │                               action aindrive.open {drive_id, path, is_dir}
 ├ List list   (view=list)       template row over /items  (Row: Tile-less icon label + caption)
 └ Text empty                    "(empty)"
data: { drive_id, path, parent, title, crumbs:[{label,path}], view:"grid"|"list", query:"", new_name:"",
        items:[{ name, path, is_dir, kind, mime, size, mtime, meta, drive_id, thumb: AssetRef|null }] }
```

`view` defaults to `grid` when at least half of the folder's files are images/videos,
else `list`; an explicit `view` argument wins.

Details of aindrive's output (hosts may rely on them, basic hosts may ignore them):

- Only one of `grid` / `list` / `empty` is emitted (the one `view` picks); `Grid` has
  `minItemWidth: 128, gap: 8`. The list row is `Row row [row_open (Button borderless →
  Text row_label {path: label}), Text row_meta {path: meta} caption]`.
- Items: `mime` is the agent's per-entry mime, else looked up by file name
  (`application/octet-stream` when unknown); folders have `mime: "inode/directory"`,
  `kind: "folder"`, `size: null`. `meta` is `folder` / a human size (search: the match's
  folder, e.g. `/Camera`), prefixed `🔒 ` when locked. Extra item fields: `label`
  (kind emoji + name, for list rows) and `locked: true` (a paid entry the caller hasn't
  bought — shown, `thumb: null`).
- `crumbs` items also carry `is_dir`; the first crumb is the drive root, labelled with
  the drive's name.
- `aindrive.search` / `search` results use this surface with `query` filled in and
  `path` = the folder searched; a truncated search adds `Text note` (caption).
- `new_btn` only when the caller may write here: `write_file` is on its allow-list, its
  scope isn't read-only, and its live role at `path` is editor or above.

**File** (`read_file`, `stat` on a file, `aindrive.open` on a file):

```
Column root
 ├ Breadcrumbs crumbs            (as above; last item = the file)
 ├ Row toolbar                   [back_btn, edit_btn?, delete_btn?]
 │   Button back_btn             → aindrive.open {drive_id, path:/parent, is_dir:true}
 │   Button edit_btn             → aindrive.edit {drive_id, path}                   (text files, write scope)
 │   Button delete_btn           tone danger, confirm "Delete <name>?" → aindrive.delete {drive_id, path}  (write scope)
 └ FileView view                 src {$asset original}, name, mime, size
data: { drive_id, path, parent, title, crumbs, name, mime, kind, size, mtime, src: AssetRef }
```

`edit_btn` needs write access (as `new_btn`), a text file (lib/mime) and `size` ≤ 1 MiB;
`delete_btn` needs `delete_path` + write access. Bound values: `edit_btn`/`delete_btn`
send `path: {path: "/path"}`, `back_btn` sends `path: {path: "/parent"}`.

**Editor** (`aindrive.edit`, `aindrive.new_file`):

```
Column root
 ├ Breadcrumbs crumbs
 ├ TextField editor              variant longText, value /content
 └ Row actions                   [cancel_btn → aindrive.open {path}, save_btn → aindrive.save {drive_id, path, content:{path:/content}}]
data: { drive_id, path, parent, title, crumbs, name, content }
```

`cancel_btn` sends `is_dir: false` (it opens the file view); `save_btn` is `primary`.

**Everything else** (`list_drives`, `write_file`, `delete_path`, `stat` on a folder or a
locked file, errors) is the basic surface of that skill with the AINUI `catalogId` —
AINUI includes the basic catalog.

## 5. Actions (client → server)

| Action | Context | Server runs | Replies with |
|---|---|---|---|
| `aindrive.open_drive` | drive_id | `list_files(path:"")` | folder |
| `aindrive.open` | drive_id, path, is_dir | folder → `list_files`; file → `stat` + asset (no bytes inline) | folder / file |
| `aindrive.search` | drive_id, query, path | `search` (empty query → `list_files`) | folder (results) |
| `aindrive.view` | drive_id, path, value | `list_files` with view=value | folder |
| `aindrive.edit` | drive_id, path | `read_file(utf8)` | editor |
| `aindrive.new_file` | drive_id, path (folder), name | `write_file(path/name, "")` | editor on the new file |
| `aindrive.save` | drive_id, path, content | `write_file(path, content)` | file |
| `aindrive.delete` | drive_id, path | `delete_path(path)` | folder (the parent) |
| `aindrive.upload` | drive_id, path (folder), name, content, encoding: base64 | validated `write_file` | folder |
| `aindrive.x402.pay` | share_token, paymentRequired | browser host signs, submits PAYMENT-SIGNATURE | resource result |
| `ainui.picker.scope` | kind (`file`\|`agent`), scope | host lists the scope (contract `fileListRequest` / `agentListRequest`) | a picker surface (or `updateDataModel`) |
| `ainui.picker.search` | kind, query | host lists with `q` | picker |
| `ainui.picker.more` | kind, cursor (`null` after `cursorExpired` = restart) | host lists the next page | picker (host appends or replaces `/items`) |
| `ainui.picker.pick` | kind: `file`, refs: `FileRef[]` — or kind: `agent`, ref: `AgentRef` | host decides (attach, share, invoke…) | host-defined |
| `ainui.picker.open` | kind: `file`, sourceUrl | host opens the origin's page | — |
| `ainui.picker.card` | kind: `agent`, agentCardUrl | host shows the agent card | — |

`ainui.picker.*` actions (`PICKER_ACTIONS`) also carry whatever the component's `context`
prop holds (a host correlation id, a target slot). `dispatchAinuiAction` runs no skill for
them: it answers `{kind: "host", action}` so the host decides what a picked reference may be
used for. Refs go back exactly as listed — the renderer never adds bytes, tokens or paths.

Write actions obey the caller's scope exactly like the tools: an action whose skill the
token may not call is refused (`unknown tool`/`forbidden`) and nothing is written.
In AINUI mode the file reply carries no inline bytes — the `FileView` asset is fetched by
the host, so images of any size preview.

Precisely (aindrive, `web/shared/a2ui/ainui.ts` `dispatchAinuiAction`):

- **Allow-list first.** Every skill an action needs is checked against the transport's
  own allow-list for direct calls — MCP: the tools listed for the token; A2A/AG-UI:
  the grant's skill groups — *before anything runs*. Then each skill runs through
  `runSkill` (token scope, drive pin, live role, paid carve-out, system paths), exactly
  like a tool call. Refusal: MCP `isError` `unknown tool: <skill>`; AG-UI `RUN_ERROR`
  (`code: "forbidden"`); A2A `[forbidden] …`. A `runSkill` refusal (e.g. a drive
  token with read scope: `forbidden (token scope is read-only)`) comes back as that
  skill's error result with the error surface.
- `aindrive.new_file` needs `list_files` + `write_file`: it lists the folder first and
  never overwrites — an existing `name` is an error (`already exists: …`), an empty
  `name` becomes `untitled.txt` (`untitled-2.txt`, … if taken), and a name with `/` or
  `\` is refused. Then `write_file(path/name, "")` → editor on the new file.
- `aindrive.edit` needs `read_file` + `write_file` on the allow-list *and* write access
  at the path (else `forbidden`); it refuses non-text files and files over 1 MiB (a
  truncated read is never offered for saving).
- `aindrive.open` with `is_dir: false` runs `stat`: a folder answers with the folder
  surface, a locked paid file with `forbidden` (as `read_file` would).
- `aindrive.save` / `aindrive.delete`: if the follow-up (`stat` / `list_files` of the
  parent) is not allowed or fails, the reply is the write's own result card
  ("Saved" / "Deleted") — the write already happened.
- The reported result (MCP `content`/`structuredContent`, A2A text/data parts, AG-UI
  text message) is the last skill's; AG-UI emits one `TOOL_CALL_*` group per skill.

**Pickers** (`ainuiFilePicker(surfaceId, fileListResponse, {scope, query?, selection?, selected?, context?})`,
`ainuiAgentPicker(surfaceId, agentListResponse, {scope, query?, selected?, renders?, context?})`):

```
FilePicker root      items /items, scope /scope, query /query, cursor /cursor, asOf /asOf, cursorExpired /cursorExpired,
                     selection /selection, selected /selected, context /context
AgentPicker root     items /items, scope /scope, query /query, cursor /cursor, asOf /asOf, cursorExpired /cursorExpired,
                     selected /selected, renders /renders, context /context
data: { items: <response.items>, scope, query, cursor: response.nextCursor, asOf: response.asOf, cursorExpired, …opts }
```

Every prop is bound, so a host answers `ainui.picker.more` / `scope` / `search` with a single
`updateDataModel` on the same surface instead of a new surface.

## 6. Hosts

- **aindrive** (producer): `web/shared/a2ui/` builds both catalogs (`index.ts` basic,
  `ainui.ts` AINUI builders + `dispatchAinuiAction`, pure; `renderer.js` draws both);
  `web/lib/ainui.ts` wires them to `runSkill`, the allow-list, the live role and
  `lib/mime`; `web/lib/mcp-http.ts` (MCP), `web/lib/agui.ts` (AG-UI) and
  `web/lib/aindrive-agent.ts` (A2A) negotiate; `a2ui_action` accepts the new actions;
  `web/lib/require-access.ts` + `web/lib/session.ts` `getRequestUser` accept the bearer
  on `fs/thumbnail|stream|download`. Tests: `web/lib/__tests__/ainui*.test.ts`.
- **ainmem** (consumer): `lib/aindrive.ts` sends `X-AINUI: 1` and keeps `_meta`;
  `/api/ainui/aindrive` runs actions as the right person, **confines every path to the
  linked folder's root**, and returns the surface; `/api/aindrive/thumb` resolves thumb
  assets; `components/ainui/` renders AINUI (basic + extended) in ainmem's look,
  mobile-first. ainmem's hand-built drive browser is replaced by it.

## 7. Package and payment transport

Install `ain-ui` from npm. Source: https://github.com/ainetwork-ai/AIN-UI.
`ain-ui/react` extends the official A2UI React renderer, and `ain-ui/renderer`
provides the DOM renderer for MCP Apps. The protocol builders and action
dispatcher are exported from `ain-ui`; hosts supply their own authorization
and storage callbacks. `ain-ui/catalog.json` is the generated catalog.

For HTTP paid shares, `X-AINUI: 1` returns a `messages` array alongside
the standard x402 body and `PAYMENT-REQUIRED` header. The embedded quote
is identical to the header. A payment click uses that quote and the host's
wallet to sign; the host submits `PAYMENT-SIGNATURE` to the original share
resource. The server revalidates current requirements and grants access.
`ain-ui/x402` uses official x402 SDKs for EIP-3009 signing. Permit2 approval
remains a host operation. Surface rendering never initiates a signature.
