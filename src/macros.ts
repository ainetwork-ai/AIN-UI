/**
 * AIN-UI's own macros: one short call the model writes, expanded on the server into standard components
 * (see `defineMacro` in ./agent.ts). They keep the model's output small where the layout never varies.
 */
import { defineMacro, type Macro } from "./agent.js";

const str = (description: string) => ({ type: "string", description });

/** One file: name, a line of detail, and Open / Download. */
export const FileCard = defineMacro({
  name: "FileCard",
  description: "One file as a card with its name, a detail line (size, date) and an Open button. Sends \"aindrive.open\" with the path.",
  props: { name: str("File name"), path: str("Path of the file in the drive"), detail: str("Size, date or another short note"), driveId: str("The drive id"), kind: { type: "string", enum: ["image", "video", "audio", "pdf", "folder", "file"], description: "What the entry is" } },
  required: ["name", "path"],
  expand: (p, id) => [
    { component: "Card", variant: "outline", children: [id("row")] },
    { id: id("row"), component: "Row", justify: "spaceBetween", children: [id("text"), id("open")] },
    { id: id("text"), component: "Column", gap: 1, children: [id("name"), ...(p.detail ? [id("detail")] : [])] },
    { id: id("name"), component: "Row", gap: 2, children: [id("icon"), id("title")] },
    { id: id("icon"), component: "Icon", name: p.kind === "folder" ? "folder" : p.kind === "image" ? "image" : p.kind === "video" ? "film" : p.kind === "audio" ? "music" : "file-text" },
    { id: id("title"), component: "Text", text: p.name, strong: true, truncate: true },
    ...(p.detail ? [{ id: id("detail"), component: "Caption", text: p.detail }] : []),
    { id: id("open"), component: "Button", label: "Open", variant: "soft", onClick: { event: { name: "aindrive.open", context: { drive_id: p.driveId ?? "", path: p.path, is_dir: p.kind === "folder" } } } },
  ],
});

/** x402 payment terms with the pay button. The terms must be the ones the paid resource quoted. */
export const PaymentCard = defineMacro({
  name: "PaymentCard",
  description: "What is being bought and its x402 payment terms, with a pay button. Use the exact amount, currency, network and recipient you were given; rendering it moves no money.",
  props: { title: str("What is being bought"), amount: str("Amount as a decimal string"), currency: str("Currency symbol, for example USDC"), network: str("Network, for example eip155:8453"), payTo: str("Recipient address"), shareToken: str("The paid share's token"), paymentRequired: str("The PAYMENT-REQUIRED header value that produced these terms") },
  required: ["title", "amount", "currency", "network", "payTo"],
  expand: (p, id) => [
    { component: "Card", children: [id("title"), id("pay")] },
    { id: id("title"), component: "Title", text: p.title, size: "md" },
    { id: id("pay"), component: "X402Payment", amount: p.amount, currency: p.currency, network: p.network, payTo: p.payTo,
      action: { event: { name: "aindrive.x402.pay", context: { share_token: p.shareToken ?? "", paymentRequired: p.paymentRequired ?? "" } } } },
  ],
});

/** One agent: name, what it does, its skills, and a button to use it. */
export const AgentCard = defineMacro({
  name: "AgentCard",
  description: "One agent as a card: name, description, up to four skills as badges, status, and a button that sends \"ainui.picker.pick\" with the agent's key.",
  props: { name: str("Display name"), description: str("What the agent does"), agentKey: str("registryIssuer#agentId"), status: { type: "string", enum: ["active", "disabled", "stopped", "deleted"], description: "Default active" }, skills: { type: "array", items: { type: "string" }, description: "Skill names" } },
  required: ["name", "agentKey"],
  expand: (p, id) => {
    const skills: string[] = Array.isArray(p.skills) ? p.skills.slice(0, 4) : [];
    const active = !p.status || p.status === "active";
    return [
      { component: "Card", variant: "outline", children: [id("head"), ...(p.description ? [id("desc")] : []), ...(skills.length ? [id("skills")] : []), id("use")] },
      { id: id("head"), component: "Row", justify: "spaceBetween", children: [id("name"), id("status")] },
      { id: id("name"), component: "Title", text: p.name, size: "sm" },
      { id: id("status"), component: "Badge", label: p.status ?? "active", color: active ? "success" : "secondary" },
      ...(p.description ? [{ id: id("desc"), component: "Text", text: p.description, color: "muted" }] : []),
      ...(skills.length ? [{ id: id("skills"), component: "Row", gap: 2, children: skills.map((_, i) => id(`skill${i}`)) }, ...skills.map((s, i) => ({ id: id(`skill${i}`), component: "Badge", label: s, variant: "outline" }))] : []),
      { id: id("use"), component: "Button", label: "Use this agent", variant: "primary", disabled: !active, onClick: { event: { name: "ainui.picker.pick", context: { kind: "agent", agentKey: p.agentKey } } } },
    ];
  },
});

export const AINUI_MACROS: readonly Macro[] = [FileCard, PaymentCard, AgentCard];
