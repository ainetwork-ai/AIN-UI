/**
 * A live example per component, shown on /components/<Name>, and the macro examples on /components/macros.
 *
 * Plain data, no imports: each example is an A2UI 1.0 surface — a flat `components` list with one id "root" —
 * and the data model its bindings read and write. `test/demo-examples.test.tsx` checks every one against the
 * catalog and draws it.
 *
 * The FilePicker, AgentPicker, FolderChat and X402Payment examples are the output of the library's builders
 * (`ainuiFilePicker`, `ainuiAgentPicker`, `ainuiFolderChat`, `ainuiPayment`), and the macro expansions are the
 * output of `expandMacros` with `AINUI_MACROS`; regenerate them with those functions when the shapes change.
 */
export type ExampleSpec = { components: any[]; data?: Record<string, unknown> };

const photo = (seed: string, w = 640, h = 400) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const event = (name: string, context: Record<string, unknown> = {}) => ({ event: { name, context } });
const at = (path: string) => ({ "@path": path });

const VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const AUDIO = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

const MONTHLY = [
  { month: "Jan", revenue: 42000, costs: 31000 }, { month: "Feb", revenue: 46500, costs: 32500 }, { month: "Mar", revenue: 51200, costs: 34100 },
  { month: "Apr", revenue: 49800, costs: 33900 }, { month: "May", revenue: 57300, costs: 36200 }, { month: "Jun", revenue: 63100, costs: 38400 },
];

export const EXAMPLES: Record<string, ExampleSpec> = {
  // ── Layout ────────────────────────────────────────────────────────────────
  Box: {
    components: [
      { id: "root", component: "Box", direction: "row", gap: 3, wrap: "wrap", children: ["plan", "usage", "alert"] },
      { id: "plan", component: "Box", border: true, radius: "lg", padding: 4, gap: 1, minWidth: 160, flex: 1, children: ["planLabel", "planValue"] },
      { id: "planLabel", component: "Caption", text: "Plan" },
      { id: "planValue", component: "Text", text: "Team, 12 seats", fontWeight: "medium" },
      { id: "usage", component: "Box", background: "surface-secondary", radius: "lg", padding: 4, gap: 1, minWidth: 160, flex: 1, children: ["usageLabel", "usageValue"] },
      { id: "usageLabel", component: "Caption", text: "Storage used" },
      { id: "usageValue", component: "Text", text: "48.2 GB of 100 GB", fontWeight: "medium" },
      { id: "alert", component: "Box", direction: "row", align: "center", gap: 2, border: true, borderColor: "warning", background: "warning", radius: "lg", padding: 4, minWidth: 160, flex: 1, children: ["alertIcon", "alertText"] },
      { id: "alertIcon", component: "Icon", name: "triangle-alert", color: "warning" },
      { id: "alertText", component: "Text", text: "Invoice due in 3 days" },
    ],
  },
  Column: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["title", "intro", "steps", "note"] },
      { id: "title", component: "Title", text: "Getting to the venue", size: "lg" },
      { id: "intro", component: "Text", text: "The conference hall is a ten-minute walk from Central Station." },
      { id: "steps", component: "Column", gap: 1, children: ["s1", "s2", "s3"] },
      { id: "s1", component: "Text", text: "**1.** Leave the station by the north exit." },
      { id: "s2", component: "Text", text: "**2.** Follow Harbour Street to the river." },
      { id: "s3", component: "Text", text: "**3.** The hall is the glass building on the left." },
      { id: "note", component: "Caption", text: "Doors open at 8:30. Bring a photo ID." },
    ],
  },
  Row: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["subtotal", "shipping", "total", "buttons"] },
      { id: "subtotal", component: "Row", justify: "spaceBetween", children: ["subtotalLabel", "subtotalValue"] },
      { id: "subtotalLabel", component: "Caption", text: "Subtotal" },
      { id: "subtotalValue", component: "Text", text: "$128.00", fontWeight: "medium" },
      { id: "shipping", component: "Row", justify: "spaceBetween", children: ["shippingLabel", "shippingValue"] },
      { id: "shippingLabel", component: "Caption", text: "Shipping" },
      { id: "shippingValue", component: "Text", text: "$6.50", fontWeight: "medium" },
      { id: "total", component: "Row", justify: "spaceBetween", children: ["totalLabel", "totalValue"] },
      { id: "totalLabel", component: "Caption", text: "Total" },
      { id: "totalValue", component: "Text", text: "$134.50", fontWeight: "bold" },
      { id: "buttons", component: "Row", gap: 2, justify: "end", children: ["back", "pay"] },
      { id: "back", component: "Button", label: "Back to cart", variant: "borderless", onClick: event("checkout.back") },
      { id: "pay", component: "Button", label: "Pay $134.50", variant: "primary", onClick: event("checkout.pay", { total: 134.5 }) },
    ],
  },
  Grid: {
    components: [
      { id: "root", component: "Grid", columns: 3, gap: 3, children: { componentId: "cell", path: "/metrics" } },
      { id: "cell", component: "GridItem", border: true, radius: "lg", padding: 4, gap: 1, children: ["cellLabel", "cellValue", "cellChange"] },
      { id: "cellLabel", component: "Caption", text: at("label") },
      { id: "cellValue", component: "Title", text: at("value"), size: "lg" },
      { id: "cellChange", component: "Text", text: at("change"), size: "sm", color: "secondary" },
    ],
    data: { metrics: [
      { label: "Visitors", value: "18,420", change: "+12% this week" }, { label: "Sign-ups", value: "1,204", change: "+4% this week" },
      { label: "Conversion", value: "6.5%", change: "-0.3 points" }, { label: "Revenue", value: "$63,100", change: "+10% this month" },
      { label: "Refunds", value: "14", change: "2 open" }, { label: "Support tickets", value: "37", change: "Median reply 42 min" },
    ] },
  },
  GridItem: {
    components: [
      { id: "root", component: "Grid", columns: 3, gap: 3, children: ["hero", "side", "a", "b", "c"] },
      { id: "hero", component: "GridItem", span: 2, border: true, radius: "lg", padding: 4, gap: 1, children: ["heroTitle", "heroText"] },
      { id: "heroTitle", component: "Title", text: "Spring release", size: "md" },
      { id: "heroText", component: "Text", text: "This cell has span 2: it covers two of the three columns." },
      { id: "side", component: "GridItem", rowSpan: 2, background: "surface-secondary", radius: "lg", padding: 4, gap: 1, children: ["sideTitle", "sideText"] },
      { id: "sideTitle", component: "Title", text: "Checklist", size: "sm" },
      { id: "sideText", component: "Text", text: "This cell has rowSpan 2: it is as tall as two rows." },
      { id: "a", component: "GridItem", border: true, radius: "lg", padding: 4, children: ["aText"] },
      { id: "aText", component: "Text", text: "Docs updated" },
      { id: "b", component: "GridItem", border: true, radius: "lg", padding: 4, children: ["bText"] },
      { id: "bText", component: "Text", text: "Changelog written" },
      { id: "c", component: "GridItem", span: 3, border: true, radius: "lg", padding: 4, children: ["cText"] },
      { id: "cText", component: "Text", text: "A span that covers all three columns fills the row." },
    ],
  },
  Card: {
    components: [
      { id: "root", component: "Grid", columns: 2, gap: 3, children: ["plain", "outline", "soft", "elevated"] },
      { id: "plain", component: "Card", children: ["plainTitle", "plainCaption", "plainSeats", "plainSave"] },
      { id: "plainTitle", component: "Title", text: "Seats" },
      { id: "plainCaption", component: "Caption", text: "Variant \"default\": the panel for controls." },
      { id: "plainSeats", component: "Slider", label: "Seats", min: 1, max: 50, value: at("/seats") },
      { id: "plainSave", component: "Button", label: "Update plan", variant: "primary", onClick: event("plan.update", { seats: at("/seats") }) },
      { id: "outline", component: "Card", variant: "outline", children: ["outlineTitle", "outlineCaption", "outlineToggle"] },
      { id: "outlineTitle", component: "Title", text: "Notifications" },
      { id: "outlineCaption", component: "Caption", text: "Variant \"outline\": always a box." },
      { id: "outlineToggle", component: "CheckBox", label: "Email me the weekly report", value: at("/weekly") },
      { id: "soft", component: "Card", variant: "soft", size: "lg", children: ["softTitle", "softCaption", "softTheme"] },
      { id: "softTitle", component: "Title", text: "Appearance" },
      { id: "softCaption", component: "Caption", text: "Variant \"soft\", size \"lg\": a filled panel with 24px padding." },
      { id: "softTheme", component: "SegmentedControl", label: "Theme", options: ["Light", "Dark", "System"], value: at("/theme") },
      { id: "elevated", component: "Card", variant: "elevated", size: "sm", children: ["elevatedTitle", "elevatedCaption", "elevatedButton"] },
      { id: "elevatedTitle", component: "Title", text: "Export" },
      { id: "elevatedCaption", component: "Caption", text: "Variant \"elevated\", size \"sm\": a shadow and 8px padding." },
      { id: "elevatedButton", component: "Button", label: "Download CSV", icon: "download", onClick: event("export.csv") },
    ],
    data: { seats: 12, weekly: true, theme: "System" },
  },
  Flow: {
    components: [
      { id: "root", component: "Flow", columns: 4, gap: 2, children: ["f1", "f2", "f3", "f4", "f5"] },
      { id: "f1", component: "FlowItem", span: 2, rowSpan: 2, children: ["i1"] },
      { id: "i1", component: "Image", url: photo("harbor", 640, 640), description: "A harbour at dusk", fit: "cover", width: "100%", height: "100%", radius: "lg" },
      { id: "f2", component: "FlowItem", children: ["i2"] },
      { id: "i2", component: "Image", url: photo("forest", 320, 320), description: "A path through a forest", fit: "cover", width: "100%", height: "100%", radius: "lg" },
      { id: "f3", component: "FlowItem", children: ["i3"] },
      { id: "i3", component: "Image", url: photo("desert", 320, 320), description: "Dunes in a desert", fit: "cover", width: "100%", height: "100%", radius: "lg" },
      { id: "f4", component: "FlowItem", span: 2, aspectRatio: "2 / 1", children: ["i4"] },
      { id: "i4", component: "Image", url: photo("glacier", 640, 320), description: "A glacier under a clear sky", fit: "cover", width: "100%", height: "100%", radius: "lg" },
      { id: "f5", component: "FlowItem", span: 4, aspectRatio: "4 / 1", background: "surface-secondary", radius: "lg", padding: 4, justify: "center", children: ["t5"] },
      { id: "t5", component: "Text", text: "Five cells of different sizes, packed into four columns." },
    ],
  },
  FlowItem: {
    components: [
      { id: "root", component: "Flow", columns: 3, gap: 2, children: ["wide", "tall", "small", "text"] },
      { id: "wide", component: "FlowItem", span: 2, aspectRatio: "2 / 1", border: true, radius: "lg", padding: 4, justify: "center", children: ["wideText"] },
      { id: "wideText", component: "Text", text: "span 2, aspectRatio \"2 / 1\"" },
      { id: "tall", component: "FlowItem", rowSpan: 2, aspectRatio: "1 / 2", background: "surface-secondary", radius: "lg", padding: 4, justify: "center", children: ["tallText"] },
      { id: "tallText", component: "Text", text: "rowSpan 2" },
      { id: "small", component: "FlowItem", children: ["smallImage"] },
      { id: "smallImage", component: "Image", url: photo("lighthouse", 320, 320), description: "A lighthouse on a cliff", fit: "cover", width: "100%", height: "100%", radius: "lg" },
      { id: "text", component: "FlowItem", aspectMode: "soft", border: true, radius: "lg", padding: 4, children: ["softText"] },
      { id: "softText", component: "Text", text: "aspectMode \"soft\": the cell grows when its content is taller than the square." },
    ],
  },
  Carousel: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["carousel", "position"] },
      { id: "carousel", component: "Carousel", label: "Weekend trips", activeIndex: at("/slide"), children: ["s1", "s2", "s3", "s4"] },
      { id: "s1", component: "CarouselMediaItem", url: photo("lisbon"), description: "Tiled houses on a hill in Lisbon", children: ["c1"] },
      { id: "c1", component: "Caption", text: "Lisbon, from $210" },
      { id: "s2", component: "CarouselMediaItem", url: photo("kyoto"), description: "A temple gate in Kyoto", children: ["c2"] },
      { id: "c2", component: "Caption", text: "Kyoto, from $640" },
      { id: "s3", component: "CarouselMediaItem", url: photo("reykjavik"), description: "A waterfall near Reykjavik", children: ["c3"] },
      { id: "c3", component: "Caption", text: "Reykjavik, from $380" },
      { id: "s4", component: "CarouselItem", width: 240, border: true, radius: "lg", padding: 4, gap: 2, justify: "center", children: ["moreTitle", "moreButton"] },
      { id: "moreTitle", component: "Title", text: "42 more trips", size: "sm" },
      { id: "moreButton", component: "Button", label: "See all", onClick: event("trips.all") },
      { id: "position", component: "Caption", text: at("/slide") },
    ],
    data: { slide: 0 },
  },
  CarouselItem: {
    components: [
      { id: "root", component: "Carousel", label: "Customer reviews", children: ["r1", "r2", "r3"] },
      { id: "r1", component: "CarouselItem", width: 280, border: true, radius: "lg", padding: 4, gap: 2, children: ["q1", "n1"] },
      { id: "q1", component: "Text", text: "Set up in an afternoon. The import from our old tool lost nothing." },
      { id: "n1", component: "Caption", text: "Maya Okafor, operations lead" },
      { id: "r2", component: "CarouselItem", width: 280, border: true, radius: "lg", padding: 4, gap: 2, children: ["q2", "n2"] },
      { id: "q2", component: "Text", text: "Support answered within the hour, twice, on a Sunday." },
      { id: "n2", component: "Caption", text: "Daniel Reyes, founder" },
      { id: "r3", component: "CarouselItem", width: 280, border: true, radius: "lg", padding: 4, gap: 2, children: ["q3", "n3"] },
      { id: "q3", component: "Text", text: "The weekly report replaced three spreadsheets." },
      { id: "n3", component: "Caption", text: "Ines Laurent, finance" },
    ],
  },
  CarouselMediaItem: {
    components: [
      { id: "root", component: "Carousel", label: "Apartment photos", children: ["m1", "m2", "m3"] },
      { id: "m1", component: "CarouselMediaItem", size: "lg", url: photo("livingroom"), description: "A living room with a grey sofa", children: ["m1Title", "m1Text"] },
      { id: "m1Title", component: "Text", text: "Living room", fontWeight: "medium" },
      { id: "m1Text", component: "Caption", text: "28 m², south-facing" },
      { id: "m2", component: "CarouselMediaItem", size: "lg", url: photo("kitchen"), description: "A kitchen with an island", children: ["m2Title", "m2Text"] },
      { id: "m2Title", component: "Text", text: "Kitchen", fontWeight: "medium" },
      { id: "m2Text", component: "Caption", text: "Induction hob, dishwasher" },
      { id: "m3", component: "CarouselMediaItem", size: "lg", url: photo("balcony"), description: "A balcony over a courtyard", lightbox: false, onClick: event("listing.photo", { room: "Balcony" }), children: ["m3Title", "m3Text"] },
      { id: "m3Title", component: "Text", text: "Balcony", fontWeight: "medium" },
      { id: "m3Text", component: "Caption", text: "A click on this one sends an event" },
    ],
  },
  Spacer: {
    components: [
      { id: "root", component: "Row", align: "center", border: true, radius: "lg", padding: 3, children: ["logo", "name", "gap", "docs", "signIn"] },
      { id: "logo", component: "Icon", name: "hexagon" },
      { id: "name", component: "Text", text: "Northwind", fontWeight: "semibold" },
      { id: "gap", component: "Spacer" },
      { id: "docs", component: "Button", label: "Docs", variant: "borderless", onClick: event("nav.docs") },
      { id: "signIn", component: "Button", label: "Sign in", variant: "primary", onClick: event("nav.sign_in") },
    ],
  },
  Divider: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["account", "line", "billing", "strong", "stats"] },
      { id: "account", component: "Text", text: "**Account** — maya@northwind.example" },
      { id: "line", component: "Divider" },
      { id: "billing", component: "Text", text: "**Billing** — Visa ending 4242, renews 1 March" },
      { id: "strong", component: "Divider", color: "strong", size: 2 },
      { id: "stats", component: "Row", gap: 4, align: "center", children: ["open", "v1", "closed", "v2", "overdue"] },
      { id: "open", component: "Text", text: "12 open" },
      { id: "v1", component: "Divider", axis: "vertical" },
      { id: "closed", component: "Text", text: "48 closed" },
      { id: "v2", component: "Divider", axis: "vertical" },
      { id: "overdue", component: "Text", text: "3 overdue", color: "danger" },
    ],
  },
  Tabs: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["tabs", "open"] },
      { id: "tabs", component: "Tabs", selectedIndex: at("/tab"), tabs: [{ title: "Overview", child: "overview" }, { title: "Specs", child: "specs" }, { title: "Reviews", child: "reviews" }] },
      { id: "overview", component: "Text", text: "The Aero 14 is a 1.2 kg laptop with an all-day battery and a matte 14-inch display." },
      { id: "specs", component: "List", items: [{ label: "Display", value: "14\" 2880 × 1800" }, { label: "Memory", value: "32 GB" }, { label: "Storage", value: "1 TB SSD" }, { label: "Battery", value: "18 hours" }] },
      { id: "reviews", component: "Column", gap: 2, children: ["review1", "review2"] },
      { id: "review1", component: "Blockquote", text: "The quietest laptop I have used. — *Priya*" },
      { id: "review2", component: "Blockquote", text: "Great screen, average speakers. — *Tom*" },
      { id: "open", component: "Caption", text: at("/tab") },
    ],
    data: { tab: 0 },
  },

  // ── Text ──────────────────────────────────────────────────────────────────
  Title: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["page", "section", "sub", "small", "muted"] },
      { id: "page", component: "Title", text: "Quarterly report", size: "2xl" },
      { id: "section", component: "Title", text: "Revenue by region", size: "lg" },
      { id: "sub", component: "Title", text: "Europe", size: "md" },
      { id: "small", component: "Title", text: "Notes", size: "sm" },
      { id: "muted", component: "Title", text: "A lighter heading, centered", size: "md", strong: false, color: "secondary", textAlign: "center" },
    ],
  },
  Text: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["body", "secondary", "status", "clamp", "price"] },
      { id: "body", component: "Text", text: "Your order **#48213** ships on *Thursday*. Track it on the [carrier's page](https://example.com/track/48213) or reply `HELP`." },
      { id: "secondary", component: "Text", text: "Delivery is free above $50.", color: "secondary", size: "sm" },
      { id: "status", component: "Text", text: "Payment", children: ["paid"] },
      { id: "paid", component: "Badge", label: "Paid", color: "success" },
      { id: "clamp", component: "Text", maxLines: 2, text: "With maxLines 2, a long paragraph is cut after two lines: the Aero 14 is a 1.2 kg laptop with an all-day battery, a matte 14-inch display, two Thunderbolt ports, a headphone jack, a fingerprint reader and a keyboard with 1.5 mm of travel, in silver or graphite." },
      { id: "price", component: "Text", text: "$1,599.00", size: "lg", fontWeight: "bold", tabularNums: true, highlight: "green" },
    ],
  },
  Caption: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["field", "hint", "row"] },
      { id: "field", component: "TextField", label: "Workspace URL", placeholder: "northwind", value: at("/slug") },
      { id: "hint", component: "Caption", text: "Lowercase letters, digits and hyphens. You can change it **once**." },
      { id: "row", component: "Row", justify: "spaceBetween", children: ["label", "value"] },
      { id: "label", component: "Caption", text: "Last backup", size: "md" },
      { id: "value", component: "Caption", text: "Today, 04:00", size: "md", color: "success" },
    ],
    data: { slug: "" },
  },
  Label: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["label", "row", "small"] },
      { id: "label", component: "Label", text: "Delivery address" },
      { id: "row", component: "Row", gap: 3, align: "center", children: ["width", "value"] },
      { id: "width", component: "Label", text: "Parcel weight", width: 120 },
      { id: "value", component: "Text", text: "2.4 kg" },
      { id: "small", component: "Label", text: "Optional", size: "xs", color: "secondary", fontWeight: "normal" },
    ],
  },
  Bold: {
    components: [
      { id: "root", component: "Text", text: "The meeting moves to ", children: ["when", "rest"] },
      { id: "when", component: "Bold", text: "Friday at 10:00" },
      { id: "rest", component: "Text", text: " in room 4B.", inline: true },
    ],
  },
  Italic: {
    components: [
      { id: "root", component: "Text", text: "This week's book is ", children: ["book", "rest"] },
      { id: "book", component: "Italic", text: "The Left Hand of Darkness" },
      { id: "rest", component: "Text", text: " by Ursula K. Le Guin.", inline: true },
    ],
  },
  Underline: {
    components: [
      { id: "root", component: "Text", text: "Return the signed form ", children: ["deadline", "rest"] },
      { id: "deadline", component: "Underline", text: "before 30 June" },
      { id: "rest", component: "Text", text: " to keep your place.", inline: true },
    ],
  },
  Strikethrough: {
    components: [
      { id: "root", component: "Row", gap: 2, align: "baseline", children: ["name", "old", "now"] },
      { id: "name", component: "Text", text: "Annual plan" },
      { id: "old", component: "Strikethrough", text: "$240" },
      { id: "now", component: "Text", text: "$192 per year", fontWeight: "bold" },
    ],
  },
  Badge: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["status", "solid", "outline", "sizes"] },
      { id: "status", component: "Row", gap: 2, wrap: "wrap", children: ["draft", "live", "failed", "review", "info", "beta"] },
      { id: "draft", component: "Badge", label: "Draft" },
      { id: "live", component: "Badge", label: "Live", color: "success" },
      { id: "failed", component: "Badge", label: "Failed", color: "danger" },
      { id: "review", component: "Badge", label: "In review", color: "warning" },
      { id: "info", component: "Badge", label: "Scheduled", color: "info" },
      { id: "beta", component: "Badge", label: "Beta", color: "discovery" },
      { id: "solid", component: "Row", gap: 2, children: ["solidLive", "solidFailed"] },
      { id: "solidLive", component: "Badge", label: "Live", color: "success", variant: "solid" },
      { id: "solidFailed", component: "Badge", label: "Failed", color: "danger", variant: "solid" },
      { id: "outline", component: "Row", gap: 2, children: ["tag1", "tag2"] },
      { id: "tag1", component: "Badge", label: "v2.4.1", variant: "outline", pill: false },
      { id: "tag2", component: "Badge", label: "eu-west-1", variant: "outline", pill: false },
      { id: "sizes", component: "Row", gap: 2, align: "center", children: ["sm", "md", "lg"] },
      { id: "sm", component: "Badge", label: "Small", size: "sm", color: "info" },
      { id: "md", component: "Badge", label: "Medium", size: "md", color: "info" },
      { id: "lg", component: "Badge", label: "Large", size: "lg", color: "info" },
    ],
  },
  Blockquote: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["intro", "quote", "source"] },
      { id: "intro", component: "Text", text: "From the customer interview on 12 May:" },
      { id: "quote", component: "Blockquote", text: "We did not switch for the features. We switched because the export **just worked** the first time." },
      { id: "source", component: "Caption", text: "Maya Okafor, operations lead at Northwind" },
    ],
  },
  Code: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["intro", "install", "usage"] },
      { id: "intro", component: "Text", text: "Install the package, then draw a surface:" },
      { id: "install", component: "Code", language: "bash", text: "npm install ain-ui" },
      { id: "usage", component: "Code", language: "tsx", text: "import { AinuiSurface } from \"ain-ui/react\";\nimport \"ain-ui/styles.css\";\n\nexport function Reply({ messages }) {\n  return <AinuiSurface messages={messages} onAction={(action) => console.log(action.name)} />;\n}" },
    ],
  },
  Markdown: {
    components: [
      { id: "root", component: "Row", gap: 4, align: "start", wrap: "wrap", children: ["chart", "notes"] },
      { id: "chart", component: "Chart", chartType: "bar", xKey: "month", series: ["revenue"], format: "currency", height: 220, data: MONTHLY.slice(3) },
      { id: "notes", component: "Markdown", text: "### What changed in Q2\n\n- **June** was the best month so far, at $63,100.\n- April dipped after the price change, then recovered.\n- Costs grew more slowly than revenue.\n\n| Month | Margin |\n| --- | --- |\n| April | 32% |\n| May | 37% |\n| June | 39% |\n\nSee the [full report](https://example.com/reports/q2)." },
    ],
  },
  Math: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["intro", "formula", "line"] },
      { id: "intro", component: "Text", text: "The monthly payment on a loan of P at monthly rate r over n months:" },
      { id: "formula", component: "Math", block: true, value: "M = P \\cdot \\frac{r(1+r)^n}{(1+r)^n - 1}" },
      { id: "line", component: "Row", gap: 2, align: "center", children: ["lineText", "inlineMath"] },
      { id: "lineText", component: "Text", text: "For a 4.8% yearly rate," },
      { id: "inlineMath", component: "Math", value: "r = \\frac{0.048}{12} = 0.004" },
    ],
  },
  ShimmerText: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["searching", "row"] },
      { id: "searching", component: "ShimmerText", text: "Searching 1,284 documents…" },
      { id: "row", component: "Row", gap: 2, align: "center", children: ["icon", "writing"] },
      { id: "icon", component: "Icon", name: "pen-line", size: "sm" },
      { id: "writing", component: "ShimmerText", text: "Writing the summary", size: "sm", color: "secondary" },
    ],
  },
  Link: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["docs", "mail", "row"] },
      { id: "docs", component: "Link", text: "Read the A2UI specification", href: "https://a2ui.org", title: "Opens a2ui.org in a new tab" },
      { id: "mail", component: "Link", text: "Email support", href: "mailto:support@example.com" },
      { id: "row", component: "Row", gap: 1, children: ["before", "inline"] },
      { id: "before", component: "Text", text: "Source code on" },
      { id: "inline", component: "Link", text: "GitHub", href: "https://github.com/ainetwork-ai/AIN-UI" },
    ],
  },
  Tooltip: {
    components: [
      { id: "root", component: "Row", gap: 4, align: "center", children: ["label", "tipIcon", "tipBadge"] },
      { id: "label", component: "Text", text: "Annual recurring revenue: **$756,000**" },
      { id: "tipIcon", component: "Tooltip", trigger: "infoIcon", content: "infoText" },
      { id: "infoIcon", component: "Icon", name: "info", label: "How this is calculated" },
      { id: "infoText", component: "Text", text: "June's recurring revenue multiplied by 12.", size: "sm" },
      { id: "tipBadge", component: "Tooltip", trigger: "badge", content: "badgeText" },
      { id: "badge", component: "Badge", label: "Estimate", color: "warning" },
      { id: "badgeText", component: "Text", text: "Final numbers arrive after the books close on 5 July.", size: "sm" },
    ],
  },

  // ── Inputs ────────────────────────────────────────────────────────────────
  Button: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["variants", "states", "actions", "sizes"] },
      { id: "variants", component: "Row", gap: 2, wrap: "wrap", children: ["primary", "plain", "soft", "borderless", "danger"] },
      { id: "primary", component: "Button", label: "Save changes", variant: "primary", onClick: event("example.clicked", { button: "primary" }) },
      { id: "plain", component: "Button", label: "Preview", onClick: event("example.clicked", { button: "default" }) },
      { id: "soft", component: "Button", label: "Duplicate", variant: "soft", onClick: event("example.clicked", { button: "soft" }) },
      { id: "borderless", component: "Button", label: "Cancel", variant: "borderless", onClick: event("example.clicked", { button: "borderless" }) },
      { id: "danger", component: "Button", label: "Delete project", color: "danger", variant: "primary", confirm: "Delete the project and its 14 files?", onClick: event("example.clicked", { button: "danger" }) },
      { id: "states", component: "Row", gap: 2, wrap: "wrap", children: ["loading", "disabled", "checked"] },
      { id: "loading", component: "Button", label: "Publishing", loading: true },
      { id: "disabled", component: "Button", label: "Out of stock", disabled: true },
      { id: "checked", component: "Button", label: "Accept and continue", variant: "primary", onClick: event("example.clicked", { button: "checked" }), checks: [{ condition: at("/agreed"), message: "Tick the box first" }] },
      { id: "actions", component: "Row", gap: 2, wrap: "wrap", align: "center", children: ["agree", "copy", "link", "icon"] },
      { id: "agree", component: "CheckBox", label: "I agree to the terms", value: at("/agreed") },
      { id: "copy", component: "Button", label: "Copy invite code", icon: "copy", copy: "NORTHWIND-2026" },
      { id: "link", component: "Button", label: "Open docs", icon: "external-link", variant: "soft", href: "https://a2ui.org" },
      { id: "icon", component: "Button", icon: "refresh-cw", uniform: true, label: "Refresh", onClick: event("example.clicked", { button: "refresh" }) },
      { id: "sizes", component: "Row", gap: 2, align: "center", children: ["sizeSm", "sizeMd", "sizeLg"] },
      { id: "sizeSm", component: "Button", label: "Small", size: "sm", onClick: event("example.clicked", { button: "sm" }) },
      { id: "sizeMd", component: "Button", label: "Medium", size: "md", pill: false, onClick: event("example.clicked", { button: "md" }) },
      { id: "sizeLg", component: "Button", label: "Large", size: "lg", onClick: event("example.clicked", { button: "lg" }) },
    ],
    data: { agreed: false },
  },
  Pressable: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["flight1", "flight2", "soldOut"] },
      { id: "flight1", component: "Pressable", border: true, radius: "lg", padding: 4, hoverBackground: "surface-secondary", tooltip: "Choose this flight", onClick: event("flight.choose", { flight: "NW 204" }), children: ["f1Row"] },
      { id: "f1Row", component: "Row", gap: 3, align: "center", justify: "spaceBetween", children: ["f1Text", "f1Price"] },
      { id: "f1Text", component: "Column", gap: 1, children: ["f1Title", "f1Meta"] },
      { id: "f1Title", component: "Text", text: "NW 204 · 07:40 → 10:05", fontWeight: "medium" },
      { id: "f1Meta", component: "Caption", text: "Direct, 2 h 25 min" },
      { id: "f1Price", component: "Text", text: "$184", fontWeight: "bold" },
      { id: "flight2", component: "Pressable", border: true, radius: "lg", padding: 4, hoverBackground: "surface-secondary", onClick: event("flight.choose", { flight: "NW 318" }), children: ["f2Row"] },
      { id: "f2Row", component: "Row", gap: 3, align: "center", justify: "spaceBetween", children: ["f2Text", "f2Price"] },
      { id: "f2Text", component: "Column", gap: 1, children: ["f2Title", "f2Meta"] },
      { id: "f2Title", component: "Text", text: "NW 318 · 13:15 → 17:00", fontWeight: "medium" },
      { id: "f2Meta", component: "Caption", text: "1 stop, 3 h 45 min" },
      { id: "f2Price", component: "Text", text: "$129", fontWeight: "bold" },
      { id: "soldOut", component: "Pressable", border: true, radius: "lg", padding: 4, disabled: true, onClick: event("flight.choose", { flight: "NW 422" }), children: ["f3Title"] },
      { id: "f3Title", component: "Text", text: "NW 422 · 19:30 → 21:55 — sold out", color: "secondary" },
    ],
  },
  Form: {
    components: [
      { id: "root", component: "Card", children: ["title", "caption", "form"] },
      { id: "title", component: "Title", text: "Book a table" },
      { id: "caption", component: "Caption", text: "Press Enter in a field or the button to submit." },
      { id: "form", component: "Form", label: "Book a table", gap: 3, onSubmit: event("booking.submit", { name: at("/booking/name"), guests: at("/booking/guests"), when: at("/booking/when"), notes: at("/booking/notes") }), children: ["name", "guests", "when", "notes", "buttons"] },
      { id: "name", component: "TextField", label: "Name", required: true, value: at("/booking/name"), checks: [{ condition: { call: "required", args: { value: at("/booking/name") } }, message: "Enter a name" }] },
      { id: "guests", component: "Slider", label: "Guests", min: 1, max: 8, value: at("/booking/guests") },
      { id: "when", component: "DateTimeInput", label: "Date and time", enableDate: true, enableTime: true, timeStep: 30, value: at("/booking/when") },
      { id: "notes", component: "TextArea", label: "Notes for the kitchen", placeholder: "Allergies, a high chair…", value: at("/booking/notes") },
      { id: "buttons", component: "Row", gap: 2, justify: "end", children: ["submit"] },
      { id: "submit", component: "Button", label: "Request booking", variant: "primary", submit: true },
    ],
    data: { booking: { name: "", guests: 2, when: "2026-12-04T19:00", notes: "" } },
  },
  TextField: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["name", "email", "password", "amount", "bio", "echo"] },
      { id: "name", component: "TextField", label: "Full name", placeholder: "Maya Okafor", value: at("/form/name") },
      { id: "email", component: "TextField", label: "Work email", variant: "email", required: true, placeholder: "you@company.com", value: at("/form/email"), checks: [{ condition: { call: "email", args: { value: at("/form/email") } }, message: "Enter a valid email address" }] },
      { id: "password", component: "TextField", label: "Password", variant: "obscured", value: at("/form/password") },
      { id: "amount", component: "TextField", label: "Monthly budget (USD)", variant: "number", size: "md", value: at("/form/budget") },
      { id: "bio", component: "TextField", label: "About you", variant: "longText", placeholder: "Two or three sentences", value: at("/form/bio") },
      { id: "echo", component: "Caption", text: at("/form/name") },
    ],
    data: { form: { name: "", email: "", password: "", budget: 500, bio: "" } },
  },
  TextArea: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["feedback", "send"] },
      { id: "feedback", component: "TextArea", label: "What could we do better?", placeholder: "Tell us what slowed you down this week", rows: 4, maxRows: 10, autoResize: true, value: at("/feedback") },
      { id: "send", component: "Button", label: "Send feedback", variant: "primary", onClick: event("feedback.send", { text: at("/feedback") }) },
    ],
    data: { feedback: "" },
  },
  Select: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["country", "plan", "apply"] },
      { id: "country", component: "Select", label: "Country", icon: "globe", searchable: true, clearable: true, placeholder: "Choose a country", options: ["Canada", "France", "Germany", "Japan", "South Korea", "United Kingdom", "United States"], value: at("/form/country") },
      { id: "plan", component: "Select", label: "Plan", block: true, options: [{ value: "free", label: "Free", description: "1 seat, 1 GB" }, { value: "team", label: "Team", description: "Up to 20 seats, 100 GB" }, { value: "business", label: "Business", description: "Unlimited seats, 1 TB" }], value: at("/form/plan") },
      { id: "apply", component: "Button", label: "Apply", variant: "primary", onClick: event("settings.apply", { country: at("/form/country"), plan: at("/form/plan") }) },
    ],
    data: { form: { country: "", plan: "team" } },
  },
  CheckBox: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["title", "milk", "bread", "coffee", "terms", "done"] },
      { id: "title", component: "Title", text: "Shopping list", size: "sm" },
      { id: "milk", component: "CheckBox", label: "Oat milk, 2 cartons", lineThrough: true, value: at("/list/milk") },
      { id: "bread", component: "CheckBox", label: "Sourdough loaf", lineThrough: true, value: at("/list/bread") },
      { id: "coffee", component: "CheckBox", label: "Coffee beans, 500 g", lineThrough: true, value: at("/list/coffee") },
      { id: "terms", component: "CheckBox", label: "Deliver without a signature", shape: "square", value: at("/list/noSignature") },
      { id: "done", component: "Button", label: "Place order", variant: "primary", onClick: event("order.place", { list: at("/list") }) },
    ],
    data: { list: { milk: true, bread: false, coffee: false, noSignature: false } },
  },
  Radio: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["question", "standard", "express", "pickup", "note"] },
      { id: "question", component: "Label", text: "Delivery" },
      { id: "standard", component: "Radio", label: "Standard, 3 to 5 days — free", value: "standard" },
      { id: "express", component: "Radio", label: "Express, next day — $9", value: "express" },
      { id: "pickup", component: "Radio", label: "Pick up in store — closed this week", value: "pickup", disabled: true },
      { id: "note", component: "Caption", text: "A lone Radio keeps no value. Use RadioGroup to read the choice." },
    ],
  },
  RadioGroup: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["plan", "billing", "confirm"] },
      { id: "plan", component: "RadioGroup", label: "Plan", variant: "cards", direction: "col", options: [{ value: "free", label: "Free", description: "For one person, 1 GB" }, { value: "team", label: "Team", description: "Up to 20 seats, 100 GB" }, { value: "business", label: "Business", description: "Unlimited seats, 1 TB" }], value: at("/plan") },
      { id: "billing", component: "RadioGroup", label: "Billing", variant: "pills", options: [{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly, 2 months free" }], value: at("/billing") },
      { id: "confirm", component: "Button", label: "Continue", variant: "primary", onClick: event("plan.choose", { plan: at("/plan"), billing: at("/billing") }) },
    ],
    data: { plan: "team", billing: "yearly" },
  },
  Slider: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["volume", "budget", "rating", "apply"] },
      { id: "volume", component: "Slider", label: "Volume", unit: "%", value: at("/volume") },
      { id: "budget", component: "Slider", label: "Monthly budget", min: 0, max: 2000, step: 50, unit: " USD", marks: [{ value: 0, label: "$0" }, { value: 1000, label: "$1,000" }, { value: 2000, label: "$2,000" }], value: at("/budget") },
      { id: "rating", component: "Slider", label: "Spice level", min: 1, max: 5, steps: 4, sliderStyle: "discrete", value: at("/spice") },
      { id: "apply", component: "Button", label: "Apply", variant: "primary", onClick: event("settings.apply", { volume: at("/volume"), budget: at("/budget"), spice: at("/spice") }) },
    ],
    data: { volume: 60, budget: 750, spice: 2 },
  },
  SegmentedControl: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["range", "unit", "view", "chosen"] },
      { id: "range", component: "SegmentedControl", label: "Range", options: ["Day", "Week", "Month", "Year"], value: at("/range") },
      { id: "unit", component: "SegmentedControl", label: "Temperature", variant: "solid", size: "md", options: [{ value: "c", label: "Celsius" }, { value: "f", label: "Fahrenheit" }], value: at("/unit") },
      { id: "view", component: "SegmentedControl", label: "Layout", variant: "outline", block: true, options: [{ value: "list", label: "List" }, { value: "board", label: "Board" }, { value: "calendar", label: "Calendar" }], value: at("/view") },
      { id: "chosen", component: "Caption", text: at("/range") },
    ],
    data: { range: "Week", unit: "c", view: "board" },
  },
  ChoicePicker: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["toppings", "size", "city", "order"] },
      { id: "toppings", component: "ChoicePicker", label: "Toppings", variant: "multipleSelection", displayStyle: "chips", options: ["Mushrooms", "Olives", "Peppers", "Onions", "Basil", "Extra cheese"], value: at("/pizza/toppings") },
      { id: "size", component: "ChoicePicker", label: "Size", options: [{ value: "s", label: "Small", description: "25 cm" }, { value: "m", label: "Medium", description: "30 cm" }, { value: "l", label: "Large", description: "38 cm" }], value: at("/pizza/size") },
      { id: "city", component: "ChoicePicker", label: "Deliver to", variant: "multipleSelection", filterable: true, options: ["Amsterdam", "Berlin", "Copenhagen", "Dublin", "Lisbon", "Madrid", "Oslo", "Vienna"], value: at("/pizza/cities") },
      { id: "order", component: "Button", label: "Add to order", variant: "primary", onClick: event("pizza.add", { pizza: at("/pizza") }) },
    ],
    data: { pizza: { toppings: ["Mushrooms", "Basil"], size: ["m"], cities: ["Lisbon"] } },
  },
  DateTimeInput: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["date", "time", "both", "book"] },
      { id: "date", component: "DateTimeInput", label: "Check-in", min: "2026-12-01", max: "2027-03-31", clearable: true, value: at("/stay/checkIn") },
      { id: "time", component: "DateTimeInput", label: "Arrival time", enableTime: true, timeStep: 30, min: "14:00", max: "22:00", value: at("/stay/arrival") },
      { id: "both", component: "DateTimeInput", label: "Airport pickup", enableDate: true, enableTime: true, block: true, value: at("/stay/pickup") },
      { id: "book", component: "Button", label: "Book", variant: "primary", onClick: event("stay.book", { stay: at("/stay") }) },
    ],
    data: { stay: { checkIn: "2026-12-12", arrival: "15:30", pickup: "2026-12-12T13:45" } },
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  Table: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["title", "table"] },
      { id: "title", component: "Title", text: "Invoices", size: "md" },
      { id: "table", component: "Table", caption: "Invoices of the last four months", cellComponents: ["paid", "due", "overdue", "remind"],
        columns: ["Invoice", "Customer", { label: "Amount", align: "end" }, "Status", { label: "", align: "end" }],
        rows: [
          ["INV-1042", "Northwind Traders", "$4,200.00", { componentId: "paid" }, ""],
          ["INV-1043", "Blue Yonder Airlines", "$1,860.00", { componentId: "paid" }, ""],
          ["INV-1044", "Contoso Coffee", "$920.50", { componentId: "due" }, ""],
          ["INV-1045", "Fabrikam Robotics", "$7,310.00", { componentId: "overdue" }, { componentId: "remind" }],
        ] },
      { id: "paid", component: "Badge", label: "Paid", color: "success" },
      { id: "due", component: "Badge", label: "Due 30 Nov", color: "warning" },
      { id: "overdue", component: "Badge", label: "Overdue", color: "danger" },
      { id: "remind", component: "Button", label: "Remind", size: "sm", onClick: event("invoice.remind", { invoice: "INV-1045" }) },
    ],
  },
  TableSection: {
    components: [
      { id: "root", component: "Table", caption: "Opening hours", children: ["head", "body"] },
      { id: "head", component: "TableSection", header: true, children: ["headRow"] },
      { id: "headRow", component: "TableRow", children: ["hDay", "hOpen", "hClose"] },
      { id: "hDay", component: "TableCell", text: "Day" },
      { id: "hOpen", component: "TableCell", text: "Opens" },
      { id: "hClose", component: "TableCell", text: "Closes" },
      { id: "body", component: "TableSection", rowDivider: true, children: ["weekdays", "saturday", "sunday"] },
      { id: "weekdays", component: "TableRow", children: ["wDay", "wOpen", "wClose"] },
      { id: "wDay", component: "TableCell", text: "Monday to Friday" },
      { id: "wOpen", component: "TableCell", text: "08:00" },
      { id: "wClose", component: "TableCell", text: "20:00" },
      { id: "saturday", component: "TableRow", children: ["sDay", "sOpen", "sClose"] },
      { id: "sDay", component: "TableCell", text: "Saturday" },
      { id: "sOpen", component: "TableCell", text: "09:00" },
      { id: "sClose", component: "TableCell", text: "18:00" },
      { id: "sunday", component: "TableRow", children: ["uDay", "uClosed"] },
      { id: "uDay", component: "TableCell", text: "Sunday" },
      { id: "uClosed", component: "TableCell", text: "Closed", colSpan: 2, align: "center" },
    ],
  },
  TableRow: {
    components: [
      { id: "root", component: "Table", caption: "Order summary", children: ["head", "rows", "total"] },
      { id: "head", component: "TableRow", header: true, children: ["hItem", "hQty", "hPrice"] },
      { id: "hItem", component: "TableCell", text: "Item" },
      { id: "hQty", component: "TableCell", text: "Qty", align: "end" },
      { id: "hPrice", component: "TableCell", text: "Price", align: "end" },
      { id: "rows", component: "TableSection", children: { componentId: "row", path: "/order/lines" } },
      { id: "row", component: "TableRow", children: ["item", "qty", "price"] },
      { id: "item", component: "TableCell", text: at("item") },
      { id: "qty", component: "TableCell", text: at("qty"), align: "end" },
      { id: "price", component: "TableCell", text: at("price"), align: "end" },
      { id: "total", component: "TableRow", label: "Total", labelColSpan: 2, children: ["sum"] },
      { id: "sum", component: "TableCell", text: at("/order/total"), align: "end" },
    ],
    data: { order: { total: "$71.50", lines: [
      { item: "Ceramic mug, blue", qty: 2, price: "$28.00" }, { item: "Pour-over kettle", qty: 1, price: "$39.00" }, { item: "Paper filters, 100", qty: 1, price: "$4.50" },
    ] } },
  },
  TableCell: {
    components: [
      { id: "root", component: "Table", caption: "Team availability", children: ["head", "maya", "daniel"] },
      { id: "head", component: "TableRow", children: ["hName", "hRole", "hStatus", "hAction"] },
      { id: "hName", component: "TableCell", header: true, text: "Name", width: 160 },
      { id: "hRole", component: "TableCell", header: true, text: "Role" },
      { id: "hStatus", component: "TableCell", header: true, text: "Status", align: "center" },
      { id: "hAction", component: "TableCell", header: true, text: "", align: "end" },
      { id: "maya", component: "TableRow", children: ["mName", "mRole", "mStatus", "mAction"] },
      { id: "mName", component: "TableCell", vAlign: "center", children: ["mNameText", "mMail"] },
      { id: "mNameText", component: "Text", text: "Maya Okafor", fontWeight: "medium" },
      { id: "mMail", component: "Caption", text: "maya@northwind.example" },
      { id: "mRole", component: "TableCell", vAlign: "center", text: "Operations lead" },
      { id: "mStatus", component: "TableCell", vAlign: "center", align: "center", children: ["mBadge"] },
      { id: "mBadge", component: "Badge", label: "Available", color: "success" },
      { id: "mAction", component: "TableCell", vAlign: "center", align: "end", children: ["mButton"] },
      { id: "mButton", component: "Button", label: "Message", size: "sm", onClick: event("team.message", { to: "maya" }) },
      { id: "daniel", component: "TableRow", children: ["dName", "dAway"] },
      { id: "dName", component: "TableCell", text: "Daniel Reyes" },
      { id: "dAway", component: "TableCell", colSpan: 3, align: "center", text: "On leave until 2 December" },
    ],
  },
  List: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["specsTitle", "specs", "citiesTitle", "cities", "stepsTitle", "steps"] },
      { id: "specsTitle", component: "Title", text: "Key facts", size: "sm" },
      { id: "specs", component: "List", marker: "none", items: [{ label: "Price", value: "$1,599" }, { label: "Weight", value: "1.2 kg" }, { label: "Battery", value: "18 hours" }, { label: "Warranty", value: "2 years" }] },
      { id: "citiesTitle", component: "Title", text: "Pick a destination", size: "sm" },
      { id: "cities", component: "List", marker: "rich", action: event("trip.pick", { from: "destinations" }), items: [
        { label: "Lisbon", description: "2 h 50 min, direct", icon: "plane", value: "LIS" }, { label: "Kyoto", description: "13 h 20 min, 1 stop", icon: "plane", value: "KIX" }, { label: "Reykjavik", description: "3 h 10 min, direct", icon: "plane", value: "KEF" },
      ] },
      { id: "stepsTitle", component: "Title", text: "Setup", size: "sm" },
      { id: "steps", component: "List", marker: "number", items: ["Create a workspace", "Invite your team", "Connect a data source"] },
    ],
  },
  ListItem: {
    components: [
      { id: "root", component: "List", marker: "rich", connector: "solid", children: ["ordered", "packed", "shipped", "delivered"] },
      { id: "ordered", component: "ListItem", label: "Order placed", description: "Monday, 09:12", icon: "check", value: "Done" },
      { id: "packed", component: "ListItem", label: "Packed at the warehouse", description: "Monday, 16:40", icon: "package", value: "Done" },
      { id: "shipped", component: "ListItem", label: "On its way", description: "Arrives Thursday", icon: "truck", action: event("order.track", { order: "48213" }), children: ["carrier"] },
      { id: "carrier", component: "Caption", text: "Carrier: Polar Express, tracking PX-7710-221. Pick this item to track it." },
      { id: "delivered", component: "ListItem", label: "Delivered", description: "Not yet", marker: "4", disabled: true },
    ],
  },
  Chart: {
    components: [
      { id: "root", component: "Tabs", tabs: [{ title: "Bar", child: "bar" }, { title: "Line", child: "line" }, { title: "Area", child: "area" }, { title: "Pie", child: "pie" }, { title: "Donut", child: "donut" }, { title: "Scatter", child: "scatter" }] },
      { id: "bar", component: "Chart", chartType: "bar", title: "Revenue and costs", xKey: "month", series: [{ key: "revenue", label: "Revenue" }, { key: "costs", label: "Costs" }], format: "currency", barRadius: 4, yAxis: { label: "USD", min: 0 }, data: at("/monthly") },
      { id: "line", component: "Chart", chartType: "line", title: "Revenue trend", xKey: "month", series: [{ key: "revenue", label: "Revenue" }, { key: "costs", label: "Costs" }], format: "currency", showDots: true, data: at("/monthly") },
      { id: "area", component: "Chart", chartType: "area", title: "Sessions by device", xKey: "week", series: ["desktop", "mobile"], stacked: true, data: at("/sessions") },
      { id: "pie", component: "Chart", chartType: "pie", title: "Traffic sources", xKey: "source", series: ["visits"], showValueLabels: true, data: at("/sources") },
      { id: "donut", component: "Chart", chartType: "donut", title: "Budget split", xKey: "team", series: ["share"], format: "percent", innerRadius: "60%", paddingAngle: 2, cornerRadius: 4, data: at("/budget") },
      { id: "scatter", component: "Chart", chartType: "scatter", title: "Price against rating", xKey: "price", series: [{ key: "rating", label: "Rating" }], yAxis: { label: "Rating", min: 3, max: 5 }, data: at("/products") },
    ],
    data: {
      monthly: MONTHLY,
      sessions: [{ week: "W1", desktop: 3200, mobile: 4100 }, { week: "W2", desktop: 3400, mobile: 4600 }, { week: "W3", desktop: 3100, mobile: 5200 }, { week: "W4", desktop: 3600, mobile: 5900 }],
      sources: [{ source: "Search", visits: 8200 }, { source: "Direct", visits: 4300 }, { source: "Social", visits: 3100 }, { source: "Email", visits: 1900 }, { source: "Referral", visits: 920 }],
      budget: [{ team: "Engineering", share: 0.45 }, { team: "Marketing", share: 0.25 }, { team: "Support", share: 0.18 }, { team: "Operations", share: 0.12 }],
      products: [{ price: 19, rating: 3.9 }, { price: 29, rating: 4.2 }, { price: 35, rating: 4.1 }, { price: 49, rating: 4.6 }, { price: 59, rating: 4.4 }, { price: 79, rating: 4.8 }, { price: 99, rating: 4.7 }],
    },
  },
  Map: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["title", "map", "picked"] },
      { id: "title", component: "Title", text: "A day in Lisbon", size: "md" },
      { id: "map", component: "Map", route: true, height: 320, selected: at("/stop"), markers: [
        { label: "Praça do Comércio", lat: 38.7075, lng: -9.1364, category: "Square" },
        { label: "Sé Cathedral", lat: 38.7098, lng: -9.1326, category: "Church" },
        { label: "Castelo de São Jorge", lat: 38.7139, lng: -9.1335, category: "Castle" },
        { label: "Miradouro da Graça", lat: 38.7164, lng: -9.1312, category: "Viewpoint" },
      ] },
      { id: "picked", component: "Caption", text: at("/stop") },
    ],
    data: { stop: "Sé Cathedral" },
  },

  // ── Media ─────────────────────────────────────────────────────────────────
  Image: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["header", "row", "caption"] },
      { id: "header", component: "Image", variant: "header", url: photo("mountains", 960, 320), description: "A mountain range at sunrise", aspectRatio: "3 / 1", radius: "lg", hoverZoom: true, actionOverlay: { label: "Save", icon: "bookmark" }, onOverlayClick: event("photo.save", { photo: "mountains" }) },
      { id: "row", component: "Row", gap: 3, align: "center", children: ["avatar", "small", "framed", "broken"] },
      { id: "avatar", component: "Image", variant: "avatar", url: photo("portrait", 80, 80), description: "Maya Okafor" },
      { id: "small", component: "Image", variant: "smallFeature", url: photo("coffee", 320, 240), description: "A cup of coffee on a wooden table", radius: "md" },
      { id: "framed", component: "Image", url: photo("poster", 240, 320), description: "A concert poster", width: 120, height: 160, fit: "contain", frame: true, lightbox: false },
      { id: "broken", component: "Image", url: "https://example.invalid/missing.jpg", description: "A product photo", width: 120, height: 90, fallback: "No photo" },
      { id: "caption", component: "Caption", text: "Header with an overlay button, an avatar, a small feature, a framed image, and a fallback for a URL that does not load." },
    ],
  },
  Icon: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["sizes", "colors", "inline"] },
      { id: "sizes", component: "Row", gap: 3, align: "center", children: ["sm", "md", "lg", "xl", "px"] },
      { id: "sm", component: "Icon", name: "cloud", size: "sm", label: "Cloud, small" },
      { id: "md", component: "Icon", name: "cloud", size: "md", label: "Cloud, medium" },
      { id: "lg", component: "Icon", name: "cloud", size: "lg", label: "Cloud, large" },
      { id: "xl", component: "Icon", name: "cloud", size: "xl", label: "Cloud, extra large" },
      { id: "px", component: "Icon", name: "cloud", size: 48, strokeWeight: "bold", label: "Cloud, 48 pixels" },
      { id: "colors", component: "Row", gap: 3, align: "center", children: ["ok", "warn", "bad", "a2ui", "custom"] },
      { id: "ok", component: "Icon", name: "circle-check", color: "success", label: "Passed" },
      { id: "warn", component: "Icon", name: "triangle-alert", color: "warning", label: "Warning" },
      { id: "bad", component: "Icon", name: "circle-x", color: "danger", label: "Failed" },
      { id: "a2ui", component: "Icon", name: "arrowBack", label: "Back" },
      { id: "custom", component: "Icon", name: { svgPath: "M12 2 2 22h20L12 2z" }, label: "Triangle" },
      { id: "inline", component: "Row", gap: 2, align: "center", children: ["inlineIcon", "inlineText"] },
      { id: "inlineIcon", component: "Icon", name: "calendar", size: "sm" },
      { id: "inlineText", component: "Text", text: "Thursday, 4 December" },
    ],
  },
  Favicon: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["s1", "s2", "s3"] },
      { id: "s1", component: "Row", gap: 2, align: "center", children: ["f1", "t1"] },
      { id: "f1", component: "Favicon", url: "https://developer.mozilla.org", alt: "MDN" },
      { id: "t1", component: "Text", text: "developer.mozilla.org" },
      { id: "s2", component: "Row", gap: 2, align: "center", children: ["f2", "t2"] },
      { id: "f2", component: "Favicon", url: "https://www.wikipedia.org", alt: "Wikipedia", size: 24 },
      { id: "t2", component: "Text", text: "wikipedia.org, 24 pixels" },
      { id: "s3", component: "Row", gap: 2, align: "center", children: ["f3", "t3"] },
      { id: "f3", component: "Favicon", url: "https://github.com", alt: "GitHub", size: 24, frame: true },
      { id: "t3", component: "Text", text: "github.com, with a frame" },
    ],
  },
  Svg: {
    components: [
      { id: "root", component: "Row", gap: 4, align: "center", wrap: "wrap", children: ["plan", "logo"] },
      { id: "plan", component: "Svg", label: "Floor plan: a living room, a kitchen and a bedroom", viewBox: "0 0 240 140", width: 320,
        rects: [{ x: 4, y: 4, width: 232, height: 132, rx: 6, fill: "none", stroke: "currentColor" }, { x: 150, y: 4, width: 86, height: 70, fill: "none", stroke: "currentColor" }],
        lines: [{ x1: 4, y1: 90, x2: 150, y2: 90, stroke: "currentColor" }, { x1: 150, y1: 74, x2: 150, y2: 136, stroke: "currentColor" }],
        circles: [{ cx: 40, cy: 46, r: 14, fill: "none", stroke: "info" }, { cx: 193, cy: 104, r: 6, fill: "warning" }],
        texts: [{ x: 76, y: 50, text: "Living room", size: 11, anchor: "middle" }, { x: 193, y: 42, text: "Kitchen", size: 11, anchor: "middle" }, { x: 76, y: 118, text: "Bedroom", size: 11, anchor: "middle" }] },
      { id: "logo", component: "Svg", label: "A check mark in a circle", viewBox: "0 0 24 24", size: 64, fill: "none", stroke: "success", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
        circles: [{ cx: 12, cy: 12, r: 10, fill: "none", stroke: "success" }], paths: [{ d: "M7 12.5l3.5 3.5L17 9" }] },
    ],
  },
  Video: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["video", "caption"] },
      { id: "video", component: "Video", url: VIDEO, title: "A flower opening, time-lapse", posterUrl: photo("flower", 960, 540), maxWidth: 640 },
      { id: "caption", component: "Caption", text: "A video file with a poster. A YouTube link plays in the privacy-enhanced player." },
    ],
  },
  AudioPlayer: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["audio", "caption"] },
      { id: "audio", component: "AudioPlayer", url: AUDIO, description: "Sound sample: a T-rex roar, 2 seconds" },
      { id: "caption", component: "Caption", text: "From the museum's audio guide, stop 14." },
    ],
  },
  HtmlView: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["view", "caption"] },
      { id: "view", component: "HtmlView", title: "Email preview: your receipt", height: 260,
        html: "<!doctype html><html><body style=\"font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f6f7f9;color:#1c2330\"><div style=\"max-width:420px;margin:auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e3e6eb\"><h2 style=\"margin:0 0 8px\">Thanks for your order</h2><p style=\"margin:0 0 16px;color:#5b6472\">Order #48213 ships on Thursday.</p><table style=\"width:100%;border-collapse:collapse\"><tr><td>Ceramic mug, blue × 2</td><td style=\"text-align:right\">$28.00</td></tr><tr><td>Pour-over kettle</td><td style=\"text-align:right\">$39.00</td></tr><tr><td style=\"border-top:1px solid #e3e6eb;padding-top:8px\"><b>Total</b></td><td style=\"border-top:1px solid #e3e6eb;padding-top:8px;text-align:right\"><b>$67.00</b></td></tr></table></div></body></html>" },
      { id: "caption", component: "Caption", text: "The HTML runs in a sandboxed iframe: no scripts, no access to this page." },
    ],
  },

  // ── Feedback ──────────────────────────────────────────────────────────────
  PulseIndicator: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["live", "recording", "alone"] },
      { id: "live", component: "Row", gap: 2, align: "center", children: ["liveDot", "liveText"] },
      { id: "liveDot", component: "PulseIndicator" },
      { id: "liveText", component: "Text", text: "Live — 1,204 people watching" },
      { id: "recording", component: "Row", gap: 2, align: "center", children: ["recDot", "recText"] },
      { id: "recDot", component: "PulseIndicator", color: "danger", size: 10, duration: 900 },
      { id: "recText", component: "Text", text: "Recording 00:14:32" },
      { id: "alone", component: "PulseIndicator", color: "warning", size: 16, label: "Deployment in progress" },
    ],
  },
  FlashcardFlip: {
    components: [
      { id: "root", component: "Grid", columns: 2, gap: 3, children: ["card1", "card2"] },
      { id: "card1", component: "FlashcardFlip", front: "What is the capital of Australia?", back: "Canberra", hint: "Click to flip" },
      { id: "card2", component: "FlashcardFlip", front: "la biblioteca", back: "the library", hint: "Spanish → English" },
    ],
  },
  Popover: {
    components: [
      { id: "root", component: "Row", gap: 4, align: "center", children: ["filters", "help"] },
      { id: "filters", component: "Popover", children: ["filtersTrigger", "filtersContent"] },
      { id: "filtersTrigger", component: "PopoverTrigger", children: ["filtersIcon", "filtersLabel"] },
      { id: "filtersIcon", component: "Icon", name: "sliders-horizontal", size: "sm" },
      { id: "filtersLabel", component: "Text", text: "Filters" },
      { id: "filtersContent", component: "PopoverContent", align: "start", width: 70, children: ["inStock", "onSale", "apply"] },
      { id: "inStock", component: "CheckBox", label: "In stock only", value: at("/filters/inStock") },
      { id: "onSale", component: "CheckBox", label: "On sale", value: at("/filters/onSale") },
      { id: "apply", component: "Button", label: "Apply filters", variant: "primary", size: "sm", onClick: event("filters.apply", { filters: at("/filters") }) },
      { id: "help", component: "Popover", showOnHover: true, hoverOpenDelay: 150, children: ["helpTrigger", "helpContent"] },
      { id: "helpTrigger", component: "PopoverTrigger", children: ["helpText"] },
      { id: "helpText", component: "Text", text: "Shipping: $6.50", underline: true },
      { id: "helpContent", component: "PopoverContent", side: "top", width: 60, children: ["helpBody"] },
      { id: "helpBody", component: "Text", size: "sm", text: "Flat rate inside the EU. Free above $50." },
    ],
    data: { filters: { inStock: true, onSale: false } },
  },
  PopoverTrigger: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["inline", "block"] },
      { id: "inline", component: "Popover", children: ["inlineTrigger", "inlineContent"] },
      { id: "inlineTrigger", component: "PopoverTrigger", children: ["avatar", "who"] },
      { id: "avatar", component: "Icon", name: "circle-user" },
      { id: "who", component: "Text", text: "Maya Okafor" },
      { id: "inlineContent", component: "PopoverContent", align: "start", children: ["mail", "role"] },
      { id: "mail", component: "Text", text: "maya@northwind.example" },
      { id: "role", component: "Caption", text: "Operations lead, Lisbon" },
      { id: "block", component: "Popover", children: ["blockTrigger", "blockContent"] },
      { id: "blockTrigger", component: "PopoverTrigger", block: true, children: ["blockText"] },
      { id: "blockText", component: "Text", text: "A full-width trigger: block true" },
      { id: "blockContent", component: "PopoverContent", children: ["blockBody"] },
      { id: "blockBody", component: "Text", text: "The trigger is already a button, so its children are a Text or an Icon." },
    ],
  },
  PopoverContent: {
    components: [
      { id: "root", component: "Row", gap: 4, justify: "center", padding: 12, children: ["below", "right"] },
      { id: "below", component: "Popover", children: ["belowTrigger", "belowContent"] },
      { id: "belowTrigger", component: "PopoverTrigger", children: ["belowLabel"] },
      { id: "belowLabel", component: "Text", text: "Share" },
      { id: "belowContent", component: "PopoverContent", side: "bottom", align: "start", sideOffset: 10, width: 72, children: ["shareTitle", "shareLink", "shareCopy"] },
      { id: "shareTitle", component: "Title", text: "Share this report", size: "sm" },
      { id: "shareLink", component: "Caption", text: "example.com/r/q2-revenue" },
      { id: "shareCopy", component: "Button", label: "Copy link", icon: "copy", size: "sm", copy: "https://example.com/r/q2-revenue" },
      { id: "right", component: "Popover", children: ["rightTrigger", "rightContent"] },
      { id: "rightTrigger", component: "PopoverTrigger", children: ["rightLabel"] },
      { id: "rightLabel", component: "Text", text: "Shortcuts" },
      { id: "rightContent", component: "PopoverContent", side: "right", align: "center", children: ["keys"] },
      { id: "keys", component: "List", marker: "none", items: [{ label: "Search", value: "/" }, { label: "New report", value: "N" }, { label: "Help", value: "?" }] },
    ],
  },
  Modal: {
    components: [
      { id: "root", component: "Row", gap: 3, children: ["invite", "terms"] },
      { id: "invite", component: "Modal", title: "Invite a teammate", trigger: "inviteButton", content: "inviteBody", open: at("/inviteOpen") },
      { id: "inviteButton", component: "Button", label: "Invite teammate", variant: "primary", icon: "user-plus" },
      { id: "inviteBody", component: "Column", gap: 3, children: ["inviteEmail", "inviteRole", "inviteSend"] },
      { id: "inviteEmail", component: "TextField", label: "Email", variant: "email", placeholder: "name@company.com", value: at("/invite/email") },
      { id: "inviteRole", component: "RadioGroup", label: "Role", options: ["Viewer", "Editor", "Admin"], value: at("/invite/role") },
      { id: "inviteSend", component: "Button", label: "Send invite", variant: "primary", onClick: event("team.invite", { email: at("/invite/email"), role: at("/invite/role") }) },
      { id: "terms", component: "Modal", title: "Refund policy", maxWidth: 560, trigger: "termsText", content: "termsBody" },
      { id: "termsText", component: "Text", text: "Read the refund policy", underline: true },
      { id: "termsBody", component: "Markdown", text: "You can cancel within **30 days** for a full refund.\n\n- Yearly plans are refunded pro rata after 30 days.\n- Add-ons are not refundable once used.\n\nWrite to billing@example.com with your invoice number." },
    ],
    data: { inviteOpen: false, invite: { email: "", role: "Editor" } },
  },

  // ── Composites ────────────────────────────────────────────────────────────
  LinkCard: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["article", "docs", "bound"] },
      { id: "article", component: "LinkCard", href: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout", title: "CSS grid layout", description: "The CSS grid layout module excels at dividing a page into major regions and defining the relationship between its parts.", image: photo("gridlayout", 320, 200) },
      { id: "docs", component: "LinkCard", href: "https://a2ui.org", title: "A2UI: agent-to-user interfaces", description: "An open format that lets an agent describe a UI the host draws with its own components.", domain: "a2ui.org" },
      { id: "bound", component: "LinkCard", href: "https://example.com/products/aero-14", title: "Aero 14 laptop — $1,599", description: "This card sends an event instead of opening its link.", favicon: false, image: photo("laptop", 320, 200), onClick: event("product.open", { sku: "aero-14" }) },
    ],
  },
  Citation: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["p1", "p2"] },
      { id: "p1", component: "Text", text: "Honeybees can recognise human faces after a few training sessions.", children: ["c1"] },
      { id: "c1", component: "Citation", index: 1, title: "Honeybees can be trained to recognise human faces", url: "https://journals.biologists.com/jeb/article/208/24/4709", source: "Journal of Experimental Biology", snippet: "Bees learned to distinguish photographs of faces and remembered them two days later." },
      { id: "p2", component: "Text", text: "A colony keeps its brood nest close to 35 °C all year.", children: ["c2", "c3"] },
      { id: "c2", component: "Citation", index: 2, title: "Thermoregulation in honey bee colonies", url: "https://en.wikipedia.org/wiki/Honey_bee", snippet: "Workers heat the nest by shivering their flight muscles and cool it by fanning water." },
      { id: "c3", component: "Citation", label: "usda.gov", title: "Honey bee health", url: "https://www.usda.gov/topics/pollinators", snippet: "Brood develops normally only within a narrow temperature range." },
    ],
  },
  FollowUp: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["answer", "sends", "event"] },
      { id: "answer", component: "Text", text: "Lisbon is warmest from June to September, with highs near 28 °C and almost no rain." },
      { id: "sends", component: "FollowUp", title: "Ask next", items: ["What about October?", { label: "Find flights", message: "Find flights to Lisbon for the first week of July" }, "Where should I stay?"] },
      { id: "event", component: "FollowUp", title: "These send an event instead", items: ["Compare with Porto", "Show a 3-day plan"], onFollowUp: event("followup.picked", { topic: "lisbon" }) },
    ],
  },
  EntityCard: {
    components: [
      { id: "root", component: "Grid", columns: 2, gap: 3, children: ["product", "place", "person"] },
      { id: "product", component: "EntityCard", title: "Aero 14", subtitle: "Northwind laptops", description: "A 1.2 kg laptop with an 18-hour battery and a matte 14-inch display.", image: photo("laptop"), meta: "$1,599", badge: { label: "In stock", color: "success" }, rating: 4.6, ratingCount: 1284,
        actions: [{ label: "Add to cart", variant: "solid" }, { label: "Compare", variant: "outline" }, { label: "Specs", href: "https://example.com/products/aero-14", variant: "ghost" }], onAction: event("product.action", { sku: "aero-14" }) },
      { id: "place", component: "EntityCard", title: "Café Aurora", subtitle: "Bakery and coffee, Alfama", description: "Custard tarts baked every hour, and a terrace over the river.", image: photo("cafe"), meta: "Open until 22:00", rating: 4.8, ratingCount: 312, onClick: event("place.open", { place: "cafe-aurora" }) },
      { id: "person", component: "EntityCard", layout: "horizontal", title: "Maya Okafor", subtitle: "Operations lead", description: "Runs onboarding and the weekly report. Based in Lisbon.", image: photo("portrait", 320, 320), imageAspectRatio: "1 / 1", badge: { label: "Away", color: "warning" }, actions: [{ label: "Message" }], onAction: event("person.action", { person: "maya" }) },
    ],
  },
  ImageGrid: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["bento", "grid"] },
      { id: "bento", component: "ImageGrid", layout: "bento", columns: 3, images: [
        { url: photo("coast", 800, 800), description: "A rocky coast at sunset", caption: "Day 1: the coast road" },
        { url: photo("village", 400, 400), description: "White houses in a hill village", caption: "Day 2: Óbidos" },
        { url: photo("market", 400, 400), description: "Fruit at a market stall", caption: "Day 3: the market" },
        { url: photo("tram", 400, 400), description: "A yellow tram on a steep street", caption: "Day 4: tram 28" },
        { url: photo("bridge", 400, 400), description: "A red suspension bridge", caption: "Day 5: the bridge" },
      ] },
      { id: "grid", component: "ImageGrid", columns: 4, aspectRatio: "4 / 3", gap: 1, images: [
        { url: photo("tiles", 400, 300), description: "Blue and white wall tiles" }, { url: photo("pastry", 400, 300), description: "Custard tarts on a tray" },
        { url: photo("beach", 400, 300), description: "A beach under a cliff" }, { url: photo("sunset", 400, 300), description: "The sun setting over the sea", href: "https://picsum.photos" },
      ] },
    ],
  },

  // ── AIN ───────────────────────────────────────────────────────────────────
  Toolbar: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["toolbar", "inventory"] },
      { id: "toolbar", component: "Toolbar", children: ["search", "searchButton", "view", "upload"] },
      { id: "search", component: "TextField", label: "Search file names", value: at("/query") },
      { id: "searchButton", component: "Button", label: "Search", onClick: event("aindrive.search", { drive_id: at("/drive_id"), path: at("/path"), query: at("/query") }) },
      { id: "view", component: "Segmented", options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }], value: at("/view"), action: event("aindrive.view", { drive_id: at("/drive_id"), path: at("/path") }) },
      { id: "upload", component: "FileUpload", label: "Upload file", action: event("aindrive.upload", { drive_id: at("/drive_id"), path: at("/path") }) },
      { id: "inventory", component: "Caption", text: "12 photos · 3 files · 2 folders · This folder only" },
    ],
    data: { drive_id: "drv_demo", path: "trips/lisbon", query: "", view: "grid" },
  },
  Tile: {
    components: [
      { id: "root", component: "Grid", columns: 4, gap: 4, children: { componentId: "tile", path: "/items" } },
      { id: "tile", component: "Tile", media: at("thumb"), kind: at("kind"), label: at("name"), caption: at("meta"), action: event("aindrive.open", { drive_id: at("drive_id"), path: at("path"), is_dir: at("is_dir") }) },
    ],
    data: { items: [
      { name: "itinerary", path: "trips/lisbon/itinerary", is_dir: true, kind: "folder", meta: "folder", drive_id: "drv_demo", thumb: null },
      { name: "tram-28.jpg", path: "trips/lisbon/tram-28.jpg", is_dir: false, kind: "image", meta: "1.8 MB", drive_id: "drv_demo", thumb: photo("tram", 352, 352) },
      { name: "coast-road.jpg", path: "trips/lisbon/coast-road.jpg", is_dir: false, kind: "image", meta: "2.4 MB", drive_id: "drv_demo", thumb: photo("coast", 352, 352) },
      { name: "market.jpg", path: "trips/lisbon/market.jpg", is_dir: false, kind: "image", meta: "2.1 MB", drive_id: "drv_demo", thumb: photo("market", 352, 352) },
      { name: "sunset.mp4", path: "trips/lisbon/sunset.mp4", is_dir: false, kind: "video", meta: "48.2 MB", drive_id: "drv_demo", thumb: photo("sunset", 352, 352) },
      { name: "tickets.pdf", path: "trips/lisbon/tickets.pdf", is_dir: false, kind: "pdf", meta: "212.4 KB", drive_id: "drv_demo", thumb: null },
      { name: "budget.xlsx", path: "trips/lisbon/budget.xlsx", is_dir: false, kind: "file", meta: "18.0 KB", drive_id: "drv_demo", thumb: null },
      { name: "voice-note.mp3", path: "trips/lisbon/voice-note.mp3", is_dir: false, kind: "audio", meta: "640.0 KB", drive_id: "drv_demo", thumb: null },
    ] },
  },
  FileView: {
    components: [
      { id: "root", component: "Tabs", tabs: [{ title: "Image", child: "image" }, { title: "Video", child: "video" }, { title: "Audio", child: "audio" }] },
      { id: "image", component: "FileView", src: photo("tram", 1280, 800), name: "tram-28.jpg", mime: "image/jpeg", size: 1887436 },
      { id: "video", component: "FileView", src: VIDEO, name: "flower.mp4", mime: "video/mp4", size: 1114112 },
      { id: "audio", component: "FileView", src: AUDIO, name: "t-rex-roar.mp3", mime: "audio/mpeg", size: 20480 },
    ],
  },
  Breadcrumbs: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["crumbs", "note"] },
      { id: "crumbs", component: "Breadcrumbs", items: at("/crumbs"), action: event("aindrive.open", { drive_id: at("/drive_id"), is_dir: true }) },
      { id: "note", component: "Caption", text: "A click on a folder sends the action with that folder's path. The last item is where you are." },
    ],
    data: { drive_id: "drv_demo", crumbs: [
      { label: "/", path: "", is_dir: true }, { label: "trips", path: "trips", is_dir: true }, { label: "lisbon", path: "trips/lisbon", is_dir: true }, { label: "photos", path: "trips/lisbon/photos", is_dir: true },
    ] },
  },
  Segmented: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["view", "sort", "chosen"] },
      { id: "view", component: "Segmented", options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }], value: at("/view"), action: event("aindrive.view", { drive_id: "drv_demo", path: "trips/lisbon" }) },
      { id: "sort", component: "Segmented", options: [{ value: "name", label: "Name" }, { value: "modified", label: "Modified" }, { value: "size", label: "Size" }], value: at("/sort"), action: event("aindrive.sort", { drive_id: "drv_demo", path: "trips/lisbon" }) },
      { id: "chosen", component: "Caption", text: at("/view") },
    ],
    data: { view: "grid", sort: "modified" },
  },
  FileUpload: {
    components: [
      { id: "root", component: "Column", gap: 2, children: ["upload", "small", "note"] },
      { id: "upload", component: "FileUpload", label: "Upload file", maxBytes: 8388608, action: event("aindrive.upload", { drive_id: "drv_demo", path: "trips/lisbon" }) },
      { id: "small", component: "FileUpload", label: "Upload a receipt (1 MiB at most)", maxBytes: 1048576, action: event("expenses.receipt", { report: "2026-11" }) },
      { id: "note", component: "Caption", text: "The action carries the file's name and its content in base64. Nothing leaves this page: the log below shows the action." },
    ],
  },
  X402Payment: {
    // ainuiPayment({ shareToken: "shr_q2report", title: "Q2 market report (PDF, 48 pages)", required, paymentRequired, symbol: "USDC", decimals: 6 })
    components: [
      { id: "root", component: "Column", children: ["title", "payment"] },
      { id: "title", component: "Title", text: at("/title"), size: "lg" },
      { id: "payment", component: "X402Payment", amount: at("/amount"), currency: at("/currency"), network: at("/network"), payTo: at("/payTo"),
        action: event("aindrive.x402.pay", { share_token: at("/share_token"), paymentRequired: at("/paymentRequired") }) },
    ],
    data: {
      title: "Q2 market report (PDF, 48 pages)", share_token: "shr_q2report", paymentRequired: "eyJ4NDAyVmVyc2lvbiI6MiwiZGVtbyI6dHJ1ZX0",
      amount: "2.5", currency: "USDC", network: "eip155:8453", payTo: "0x7EDE5aC5eBeA04C5f0Dc33fDf6e24F610262bCBE",
    },
  },
  FolderChat: {
    // ainuiFolderChat({ driveId: "drv_demo", path: "trips/lisbon", agents, agentId: "cloud", messages, busy: false })
    components: [
      { id: "root", component: "FolderChat", value: at("/chat"), action: event("aindrive.chat", { drive_id: "drv_demo", path: "trips/lisbon" }) },
    ],
    data: { chat: {
      driveId: "drv_demo", path: "trips/lisbon",
      agents: [{ id: "cloud", label: "Cloud agent" }, { id: "gallery-guide", label: "Gallery guide", remote: true }],
      agentId: "cloud", busy: false,
      messages: [
        { role: "user", text: "Which photos in this folder were taken on the coast road?" },
        { role: "agent", text: "Three of them: coast-road.jpg, sunset.mp4 and beach.jpg. All were taken on day 1 between 17:40 and 19:10." },
        { role: "user", text: "Put them in a folder called day-1." },
        { role: "agent", text: "Done. trips/lisbon/day-1 now holds the three files." },
      ],
    } },
  },
  FilePicker: {
    // ainuiFilePicker("files", response, { scope: "shared_with_me", selection: "multiple", selected: [fileKey(first)], context: { requestId: "example" } })
    components: [
      { id: "root", component: "FilePicker", items: at("/items"), scope: at("/scope"), query: at("/query"), cursor: at("/cursor"), asOf: at("/asOf"), cursorExpired: at("/cursorExpired"), selection: at("/selection"), selected: at("/selected"), context: at("/context") },
    ],
    data: {
      items: [
        { ref: { contract: "1.0", issuer: "https://aindrive.ainetwork.ai", driveId: "drv_7f3a", fileId: "p1:3c8f0b1d2e4a5b6c7d8e9f0a1b2c3d4e", revision: "m1790600000000-s48213", kind: "file", mimeType: "application/pdf", displayName: "Exhibition guide.pdf",
          ownerRef: { kind: "account", issuer: "https://auth.comcom.ai", subject: "acc_8Qk2ZpL0vX1", displayName: "Maya Okafor" }, availability: { state: "online", lastSeenAt: "2026-11-24T06:00:00Z" },
          sourceUrl: "https://aindrive.ainetwork.ai/d/drv_7f3a/exhibitions/2026-12/Exhibition%20guide.pdf", legacy: { path: "/exhibitions/2026-12/Exhibition guide.pdf" }, size: 48213 }, role: "viewer", shareOrigin: "direct", sharedAt: "2026-11-20T10:00:00Z" },
        { ref: { contract: "1.0", issuer: "https://aindrive.ainetwork.ai", driveId: "drv_7f3a", fileId: "p1:77aa0b1d2e4a5b6c7d8e9f0a1b2c3d4e", revision: "m1790700000000-s1887436", kind: "file", mimeType: "image/jpeg", displayName: "Floor plan.jpg",
          ownerRef: { kind: "org", issuer: "https://auth.comcom.ai", subject: "org_gallery", displayName: "Uncommon Gallery" }, availability: { state: "online", lastSeenAt: "2026-11-24T06:00:00Z" },
          sourceUrl: "https://aindrive.ainetwork.ai/d/drv_7f3a/exhibitions/2026-12/Floor%20plan.jpg", legacy: { path: "/exhibitions/2026-12/Floor plan.jpg" }, size: 1887436 }, role: "editor", shareOrigin: "org", modifiedAt: "2026-11-22T08:30:00Z" },
        { ref: { contract: "1.0", issuer: "https://aindrive.ainetwork.ai", driveId: "drv_2c90", fileId: "p1:off10b1d2e4a5b6c7d8e9f0a1b2c3d4e", revision: "m1788000000000-s902114", kind: "file", mimeType: "video/mp4", displayName: "Opening night.mp4",
          ownerRef: { kind: "account", issuer: "https://auth.comcom.ai", subject: "acc_1Lm9TrW4dQ7", displayName: "Daniel Reyes" }, availability: { state: "offline", lastSeenAt: "2026-11-01T00:00:00Z" },
          sourceUrl: "https://aindrive.ainetwork.ai/d/drv_2c90/video/Opening%20night.mp4", legacy: { path: "/video/Opening night.mp4" }, size: 902114 }, role: "viewer", shareOrigin: "link", sharedAt: "2026-10-30T18:00:00Z" },
        { ref: { contract: "1.0", issuer: "https://aindrive.ainetwork.ai", driveId: "drv_2c90", fileId: "p1:paid0b1d2e4a5b6c7d8e9f0a1b2c3d4e", revision: "m1790100000000-s3312000", kind: "file", mimeType: "application/pdf", displayName: "Q2 market report.pdf",
          ownerRef: { kind: "account", issuer: "https://auth.comcom.ai", subject: "acc_1Lm9TrW4dQ7", displayName: "Daniel Reyes" }, availability: { state: "online", lastSeenAt: "2026-11-24T06:00:00Z" },
          sourceUrl: "https://aindrive.ainetwork.ai/d/drv_2c90/reports/Q2%20market%20report.pdf", legacy: { path: "/reports/Q2 market report.pdf" }, size: 3312000 }, role: "none", shareOrigin: "paid", paid: { entitled: false, pricingRef: "price_q2report" }, sharedAt: "2026-11-18T09:00:00Z" },
      ],
      scope: "shared_with_me", query: "", cursor: "page-2", asOf: "2026-11-24T06:00:00Z", cursorExpired: false, selection: "multiple",
      selected: ["https://aindrive.ainetwork.ai#drv_7f3a#p1:3c8f0b1d2e4a5b6c7d8e9f0a1b2c3d4e"], context: { requestId: "example" },
    },
  },
  AgentPicker: {
    // ainuiAgentPicker("agents", response, { scope: "shared_with_org", renders: ["streaming", "cancel", "ainui"], selected: agentKey(first), context: { requestId: "example" } })
    components: [
      { id: "root", component: "AgentPicker", items: at("/items"), scope: at("/scope"), query: at("/query"), cursor: at("/cursor"), asOf: at("/asOf"), cursorExpired: at("/cursorExpired"), selected: at("/selected"), renders: at("/renders"), context: at("/context") },
    ],
    data: {
      items: [
        { ref: { contract: "1.0", registryIssuer: "https://ainize.ai", agentId: "gallery-guide", releaseId: "v3", ownerRef: { kind: "wallet", issuer: "https://ainize.ai", subject: "0x7ede5ac5ebea04c5f0dc33fdf6e24f610262bcbe" }, visibility: "org",
          orgRef: { kind: "org", issuer: "https://auth.comcom.ai", subject: "org_gallery" }, agentCardUrl: "https://ainize.ai/agents/gallery-guide/.well-known/agent-card.json", endpoint: "https://ainize.ai/agents/gallery-guide",
          supportedProtocolVersions: ["0.3.0"], skills: [{ id: "guide", name: "Exhibition guide", description: "Answers questions about the works and the schedule" }, { id: "tickets", name: "Tickets", description: "Finds a time slot and books it" }],
          inputModes: ["text/plain"], outputModes: ["text/plain", "application/a2ui+json"], uiCapabilities: ["streaming", "cancel", "a2ui_basic"], status: "active", displayName: "Gallery guide",
          description: "Reads the exhibition folder and answers visitors' questions.", updatedAt: "2026-11-24T06:00:00Z" }, canInvoke: true },
        { ref: { contract: "1.0", registryIssuer: "https://ainize.ai", agentId: "report-writer", releaseId: "v12", ownerRef: { kind: "account", issuer: "https://auth.comcom.ai", subject: "acc_8Qk2ZpL0vX1" }, visibility: "private",
          agentCardUrl: "https://ainize.ai/agents/report-writer/.well-known/agent-card.json", endpoint: "https://ainize.ai/agents/report-writer",
          supportedProtocolVersions: ["0.3.0"], skills: [{ id: "weekly", name: "Weekly report", description: "Summarises the week's numbers from a spreadsheet" }],
          inputModes: ["text/plain"], outputModes: ["text/plain", "application/a2ui+json"], uiCapabilities: ["streaming", "ainui", "file_refs_out"], status: "active", displayName: "Report writer",
          description: "Turns a folder of spreadsheets into a weekly report.", updatedAt: "2026-11-21T12:00:00Z" }, canInvoke: true },
        { ref: { contract: "1.0", registryIssuer: "https://ainize.ai", agentId: "translator", releaseId: "v5", ownerRef: { kind: "org", issuer: "https://auth.comcom.ai", subject: "org_gallery" }, visibility: "org",
          orgRef: { kind: "org", issuer: "https://auth.comcom.ai", subject: "org_gallery" }, agentCardUrl: "https://ainize.ai/agents/translator/.well-known/agent-card.json", endpoint: "https://ainize.ai/agents/translator",
          supportedProtocolVersions: ["0.3.0"], skills: [{ id: "translate", name: "Translate", description: "Translates a document and keeps its layout" }],
          inputModes: ["text/plain"], outputModes: ["text/plain"], uiCapabilities: ["streaming"], status: "active", displayName: "Translator",
          description: "You can see this agent, but you may not call it.", updatedAt: "2026-11-10T09:00:00Z" }, canInvoke: false },
        { ref: { contract: "1.0", registryIssuer: "https://ainize.ai", agentId: "audio-tour", releaseId: "v1", ownerRef: { kind: "org", issuer: "https://auth.comcom.ai", subject: "org_gallery" }, visibility: "public",
          agentCardUrl: "https://ainize.ai/agents/audio-tour/.well-known/agent-card.json", endpoint: "https://ainize.ai/agents/audio-tour",
          supportedProtocolVersions: ["0.3.0"], skills: [{ id: "tour", name: "Audio tour", description: "Reads a tour of the current room aloud" }],
          inputModes: ["text/plain"], outputModes: ["text/plain", "audio/mpeg"], uiCapabilities: ["audio_out", "cancel"], status: "stopped", displayName: "Audio tour",
          description: "Stopped by its owner: it takes no new calls.", updatedAt: "2026-10-02T15:00:00Z" }, canInvoke: true },
      ],
      scope: "shared_with_org", query: "", cursor: null, asOf: "2026-11-24T06:00:00Z", cursorExpired: false,
      selected: "https://ainize.ai#gallery-guide", renders: ["streaming", "cancel", "ainui"], context: { requestId: "example" },
    },
  },
  // ── Rich ──────────────────────────────────────────────────────────────────
  Heading: {
    components: [
      { id: "root", component: "Heading", eyebrow: "Growth · Week 47", text: "Weekly Signups & Onboarding", subtitle: "Total volume increased 18.4% over last week with strong referral conversion" },
    ],
  },
  Section: {
    components: [
      { id: "root", component: "Section", eyebrow: "Trends", title: "Daily signups volume", description: "New account creations from Monday through Sunday", children: ["grid"] },
      { id: "grid", component: "Grid", columns: 2, gap: 3, children: ["web", "mobile"] },
      { id: "web", component: "Sparkline", label: "Web", values: [420, 460, 510, 590, 640, 560, 610], value: "3,750", delta: "+9.6%", tone: "positive" },
      { id: "mobile", component: "Sparkline", label: "Mobile", values: [130, 120, 145, 160, 150, 170, 185], value: "1,060", delta: "+14.1%", tone: "positive" },
    ],
  },
  Stat: {
    components: [
      { id: "root", component: "Grid", minChildWidth: 220, gap: 3, children: ["signups", "conversion", "churn"] },
      { id: "signups", component: "Stat", label: "Total signups", value: 3842, delta: "+18.4%", trend: "up", caption: "vs. 3,245 prior week", tone: "positive" },
      { id: "conversion", component: "Stat", label: "Visitor conversion", value: "4.8%", delta: "+0.6%", trend: "up", caption: "Landing page to signup" },
      { id: "churn", component: "Stat", label: "Trial churn", value: "2.1%", delta: "-0.4%", trend: "down", caption: "7-day dropout rate", tone: "positive" },
    ],
  },
  StatGroup: {
    components: [
      { id: "root", component: "StatGroup", items: [
        { label: "MRR", value: "$84.2k", delta: "+4.2%", trend: "up" },
        { label: "Active customers", value: 1284, delta: "+38", trend: "up" },
        { label: "Net churn", value: "1.9%", delta: "+0.3%", trend: "down" },
        { label: "NPS", value: 61, delta: "0", trend: "flat" },
      ] },
    ],
  },
  Sparkline: {
    components: [
      { id: "root", component: "Grid", minChildWidth: 220, gap: 3, children: ["users", "latency", "errors"] },
      { id: "users", component: "Sparkline", label: "Active users", values: [812, 860, 845, 910, 980, 1040, 1122, 1180], value: "1,180", delta: "+12.4%", tone: "positive" },
      { id: "latency", component: "Sparkline", label: "p95 latency", values: [210, 198, 230, 260, 245, 290, 310, 305], value: "305 ms", delta: "+45 ms", tone: "negative" },
      { id: "errors", component: "Sparkline", label: "Error rate", values: [0.8, 0.7, 0.9, 0.6, 0.5, 0.55, 0.4, 0.38], value: "0.38%", delta: "-0.42pt", tone: "positive" },
    ],
  },
  Progress: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["goal", "budget", "coverage"] },
      { id: "goal", component: "Progress", label: "Q4 signup goal", value: 76, caption: "15,200 of 20,000 accounts", tone: "positive" },
      { id: "budget", component: "Progress", label: "Ad budget used", value: 92, caption: "$9,200 of $10,000 — 6 days left", tone: "warning" },
      { id: "coverage", component: "Progress", label: "Test coverage", value: at("/coverage"), caption: "Line coverage on main" },
    ],
    data: { coverage: 64.5 },
  },
  Callout: {
    components: [
      { id: "root", component: "Callout", icon: "lightbulb", title: "Referral links convert 3× better", text: "Visitors who arrive from a shared referral link finish signup at 14%, against 4.8% overall. Put the invite link on the onboarding checklist.", actionLabel: "Add to checklist", onAction: event("callout.add_referral_step") },
    ],
  },
  Alert: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["info", "success", "warning", "error"] },
      { id: "info", component: "Alert", tone: "info", title: "Maintenance window", message: "The dashboard is read-only on Sunday from 02:00 to 03:00 UTC." },
      { id: "success", component: "Alert", tone: "success", title: "Export finished", message: "signups-week-47.csv is ready in your Downloads folder." },
      { id: "warning", component: "Alert", tone: "warning", title: "Ad budget almost spent", message: "92% of this month's budget is used with 6 days to go." },
      { id: "error", component: "Alert", tone: "error", title: "Payment failed", message: "The card ending in 4242 was declined. Update it to keep the Team plan." },
    ],
  },
  Avatar: {
    components: [
      { id: "root", component: "Column", gap: 4, children: ["lead", "row"] },
      { id: "lead", component: "Avatar", name: "Maya Okafor", subtitle: "Product lead · Seoul", size: "lg", status: "online" },
      { id: "row", component: "Row", gap: 5, wrap: "wrap", children: ["dan", "ines", "kenji"] },
      { id: "dan", component: "Avatar", name: "Daniel Reyes", subtitle: "Reviewer", image: photo("daniel-avatar", 96, 96), status: "away" },
      { id: "ines", component: "Avatar", name: "Inês Costa", subtitle: "Design", status: "offline" },
      { id: "kenji", component: "Avatar", name: "Kenji Watanabe", size: "sm" },
    ],
  },
  KeyValueList: {
    components: [
      { id: "root", component: "KeyValueList", title: "Order #10482", columns: 2, items: [
        { label: "Placed", value: "24 Nov 2026, 09:12" }, { label: "Status", value: "Packed" },
        { label: "Items", value: 3 }, { label: "Shipping", value: "Express (1–2 days)" },
        { label: "Subtotal", value: "$128.00" }, { label: "Total", value: "$141.50", hint: "incl. VAT and shipping" },
      ] },
    ],
  },
  Timeline: {
    components: [
      { id: "root", component: "Timeline", items: [
        { title: "Order placed", time: "Nov 24, 09:12", description: "Paid with the card ending in 4242.", status: "done" },
        { title: "Packed", time: "Nov 24, 11:40", description: "Two boxes, 3.4 kg.", status: "done" },
        { title: "In transit", time: "Nov 25, 08:05", description: "Left the Incheon hub; next stop Seoul Gangnam.", status: "current", icon: "truck" },
        { title: "Out for delivery", time: "Expected Nov 26", status: "upcoming" },
        { title: "Delivered", status: "upcoming" },
      ] },
    ],
  },
  TagList: {
    components: [
      { id: "root", component: "Column", gap: 3, children: ["stack", "good", "risks"] },
      { id: "stack", component: "TagList", tags: ["React 19", "TypeScript", "A2UI 1.0", "Vite", "Postgres"] },
      { id: "good", component: "TagList", tags: ["Fast onboarding", "Clear pricing", "Great docs"], tone: "positive" },
      { id: "risks", component: "TagList", tags: ["Slow exports", "No SSO on Starter"], tone: "warning" },
    ],
  },
  EmptyState: {
    components: [
      { id: "root", component: "EmptyState", icon: "search-x", title: "No signups match these filters", description: "Try a wider date range or remove the \"Referral\" source filter.", actionLabel: "Clear filters", onAction: event("filters.clear") },
    ],
  },
};

/** The three macros of `ain-ui/macros`: the call a model writes, and the standard components the server sends for it. */
export const MACRO_EXAMPLES: Array<{ name: string; description: string; express: string; components: any[] }> = [
  {
    name: "FileCard",
    description: "One file as a card with its name, a detail line (size, date) and an Open button. Sends \"aindrive.open\" with the path.",
    express: "root = FileCard(name=\"Q2 market report.pdf\", path=\"reports/Q2 market report.pdf\", detail=\"3.2 MB · 18 Nov 2026\", driveId=\"drv_2c90\", kind=\"pdf\")",
    components: [
      { component: "Card", variant: "outline", children: ["root__row"], id: "root" },
      { id: "root__row", component: "Row", justify: "spaceBetween", children: ["root__text", "root__open"] },
      { id: "root__text", component: "Column", gap: 1, children: ["root__name", "root__detail"] },
      { id: "root__name", component: "Row", gap: 2, children: ["root__icon", "root__title"] },
      { id: "root__icon", component: "Icon", name: "file-text" },
      { id: "root__title", component: "Text", text: "Q2 market report.pdf", strong: true, truncate: true },
      { id: "root__detail", component: "Caption", text: "3.2 MB · 18 Nov 2026" },
      { id: "root__open", component: "Button", label: "Open", variant: "soft", onClick: { event: { name: "aindrive.open", context: { drive_id: "drv_2c90", path: "reports/Q2 market report.pdf", is_dir: false } } } },
    ],
  },
  {
    name: "PaymentCard",
    description: "What is being bought and its x402 payment terms, with a pay button. Use the exact amount, currency, network and recipient you were given; rendering it moves no money.",
    express: "root = PaymentCard(title=\"Q2 market report (PDF, 48 pages)\", amount=\"2.5\", currency=\"USDC\", network=\"eip155:8453\", payTo=\"0x7EDE5aC5eBeA04C5f0Dc33fDf6e24F610262bCBE\", shareToken=\"shr_q2report\")",
    components: [
      { component: "Card", children: ["root__title", "root__pay"], id: "root" },
      { id: "root__title", component: "Title", text: "Q2 market report (PDF, 48 pages)", size: "md" },
      { id: "root__pay", component: "X402Payment", amount: "2.5", currency: "USDC", network: "eip155:8453", payTo: "0x7EDE5aC5eBeA04C5f0Dc33fDf6e24F610262bCBE", action: { event: { name: "aindrive.x402.pay", context: { share_token: "shr_q2report", paymentRequired: "" } } } },
    ],
  },
  {
    name: "AgentCard",
    description: "One agent as a card: name, description, up to four skills as badges, status, and a button that sends \"ainui.picker.pick\" with the agent's key.",
    express: "root = AgentCard(name=\"Gallery guide\", description=\"Reads the exhibition folder and answers visitors' questions.\", agentKey=\"https://ainize.ai#gallery-guide\", status=\"active\", skills=[\"Exhibition guide\", \"Tickets\", \"Opening hours\"])",
    components: [
      { component: "Card", variant: "outline", children: ["root__head", "root__desc", "root__skills", "root__use"], id: "root" },
      { id: "root__head", component: "Row", justify: "spaceBetween", children: ["root__name", "root__status"] },
      { id: "root__name", component: "Title", text: "Gallery guide", size: "sm" },
      { id: "root__status", component: "Badge", label: "active", color: "success" },
      { id: "root__desc", component: "Text", text: "Reads the exhibition folder and answers visitors' questions.", color: "muted" },
      { id: "root__skills", component: "Row", gap: 2, children: ["root__skill0", "root__skill1", "root__skill2"] },
      { id: "root__skill0", component: "Badge", label: "Exhibition guide", variant: "outline" },
      { id: "root__skill1", component: "Badge", label: "Tickets", variant: "outline" },
      { id: "root__skill2", component: "Badge", label: "Opening hours", variant: "outline" },
      { id: "root__use", component: "Button", label: "Use this agent", variant: "primary", disabled: false, onClick: { event: { name: "ainui.picker.pick", context: { kind: "agent", agentKey: "https://ainize.ai#gallery-guide" } } } },
    ],
  },
];
