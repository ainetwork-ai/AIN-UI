import React, { useEffect, useMemo, useState } from "react";
import { AinuiSurface } from "ain-ui/react";
import { AINUI_CATALOG } from "ain-ui";
import { EXAMPLES, MACRO_EXAMPLES } from "./examples";
import { THEMES, useSettings } from "./settings";

const GROUPS: Array<[string, string[]]> = [
  ["Layout", "Box Column Row Grid GridItem Card Flow FlowItem Carousel CarouselItem CarouselMediaItem Spacer Divider Tabs".split(" ")],
  ["Text", "Title Text Caption Label Bold Italic Underline Strikethrough Badge Blockquote Code Markdown Math ShimmerText Link Tooltip".split(" ")],
  ["Inputs", "Button Pressable Form TextField TextArea Select CheckBox Radio RadioGroup Slider SegmentedControl ChoicePicker DateTimeInput".split(" ")],
  ["Data", "Table TableSection TableRow TableCell List ListItem Chart Map".split(" ")],
  ["Media", "Image Icon Favicon Svg Video AudioPlayer HtmlView".split(" ")],
  ["Feedback", "PulseIndicator FlashcardFlip Popover PopoverTrigger PopoverContent Modal".split(" ")],
  ["Composites", "LinkCard Citation FollowUp EntityCard ImageGrid".split(" ")],
  ["AIN", "Toolbar Tile FileView Breadcrumbs Segmented FileUpload X402Payment FolderChat FilePicker AgentPicker".split(" ")],
];

function typeOf(schema: any, depth = 0): string {
  if (!schema || typeof schema !== "object") return "any";
  if (schema.$ref) return String(schema.$ref).split("/").pop()!;
  if ("const" in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((v: unknown) => JSON.stringify(v)).join(" | ");
  const alts = schema.anyOf ?? schema.oneOf;
  if (alts) { const parts = [...new Set((alts as any[]).map((a) => typeOf(a, depth + 1)).filter((p) => p !== "DataBinding" && p !== "FunctionCall"))]; return parts.join(" | ") || "any"; }
  if (schema.type === "array") return `${typeOf(schema.items, depth + 1)}[]`;
  if (schema.type === "object") { const keys = Object.keys(schema.properties ?? {}); return keys.length && depth < 2 ? `{ ${keys.join(", ")} }` : "object"; }
  return Array.isArray(schema.type) ? schema.type.join(" | ") : String(schema.type ?? "any");
}
const bindable = (schema: any) => JSON.stringify(schema ?? {}).includes("DataBinding");

function Example({ name, example, theme }: { name: string; example: { components: any[]; data?: Record<string, unknown> }; theme: string }) {
  const [log, setLog] = useState<string[]>([]);
  const [view, setView] = useState<"preview" | "json" | "express">("preview");
  const [express, setExpress] = useState<string>("");
  const messages = useMemo(() => [{ version: "1.0", createSurface: { surfaceId: `example-${name}`, catalogId: AINUI_CATALOG, components: example.components, dataModel: example.data ?? {} } }], [name, example]);
  useEffect(() => { setLog([]); setView("preview"); setExpress(""); }, [name]);
  useEffect(() => {
    if (view !== "express" || express) return;
    fetch("/api/decompile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages }) })
      .then((r) => r.json()).then((d) => setExpress(d.express ?? `// ${d.error?.message ?? "not available"}`)).catch(() => setExpress("// not available"));
  }, [view, express, messages]);
  return <section className="example">
    <div className="example-tabs" role="tablist">{(["preview", "json", "express"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>{v === "preview" ? "Preview" : v === "json" ? "JSON" : "Express"}</button>)}</div>
    {view === "preview" ? <div className="example-stage"><AinuiSurface messages={messages as never} theme={theme} resolveAsset={(a) => `/sample/${a.path}`}
      onAction={(a) => setLog((l) => [`action ${a.name} ${JSON.stringify(a.context ?? {})}`, ...l].slice(0, 5))} sendMessage={(t) => setLog((l) => [`message "${t}"`, ...l].slice(0, 5))} /></div>
      : <pre className="doc-code"><code>{view === "json" ? JSON.stringify(messages, null, 1) : express || "…"}</code></pre>}
    {log.length > 0 && <ul className="example-log" aria-live="polite">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
  </section>;
}

export function Components({ path }: { path: string }) {
  const [catalog, setCatalog] = useState<any>(null);
  const [settings, set] = useSettings();
  useEffect(() => { fetch("/catalog.json").then((r) => r.json()).then(setCatalog).catch(() => setCatalog({ components: {} })); }, []);
  const name = decodeURIComponent(path.split("/")[2] ?? "");
  const component = catalog?.components?.[name];
  const macros = name === "macros";

  return <div className="docs">
    <nav className="docs-nav" aria-label="Components">
      <a href="/components" aria-current={!name ? "page" : undefined}>Overview</a>
      <a href="/components/macros" aria-current={macros ? "page" : undefined}>Macros</a>
      {GROUPS.map(([group, names]) => <div key={group}><h2>{group}</h2>{names.map((n) => <a key={n} href={`/components/${n}`} aria-current={n === name ? "page" : undefined}>{n}</a>)}</div>)}
    </nav>
    <main className="doc">
      <div className="pg-controls docs-controls"><label>Design <select value={settings.theme} onChange={(e) => set({ theme: e.target.value })}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label></div>
      {!catalog ? <p className="pg-note">Loading…</p> : macros ? <>
        <h1>Macros</h1>
        <p>A macro is one short call the model writes that the server expands into standard components before anything is sent. The renderer never sees the macro's name, so a macro works with any A2UI 1.0 renderer that has the standard components.</p>
        {MACRO_EXAMPLES.map((m) => <section key={m.name}>
          <h2>{m.name}</h2><p>{m.description}</p>
          <p className="pg-note">The model writes {m.express.length} characters; {m.components.length} standard components are sent.</p>
          <pre className="doc-code"><code>{m.express}</code></pre>
          <Example name={m.name} example={{ components: m.components }} theme={settings.theme} />
        </section>)}
      </> : component ? <>
        <h1>{name}</h1>
        <p>{component.description}</p>
        {EXAMPLES[name] ? <Example name={name} example={EXAMPLES[name]} theme={settings.theme} /> : <p className="pg-note">No example yet.</p>}
        <h2>Props</h2>
        <div className="table-scroll"><table className="doc-table">
          <thead><tr><th>Prop</th><th>Type</th><th>Notes</th></tr></thead>
          <tbody>{Object.entries<any>(component.properties ?? {}).filter(([k]) => k !== "component").map(([k, v]) => <tr key={k}>
            <td><code>{k}</code>{(component.required ?? []).includes(k) && <span className="pg-chip">required</span>}</td>
            <td><code>{typeOf(v)}</code>{bindable(v) && <span className="pg-chip" title="Accepts a data binding">bindable</span>}</td>
            <td>{v.description ?? ""}</td>
          </tr>)}</tbody>
        </table></div>
      </> : name ? <><h1>{name}</h1><p>There is no component with this name in the catalog.</p></> : <>
        <h1>Components</h1>
        <p>{Object.keys(catalog.components ?? {}).length} components in one A2UI 1.0 catalog (<a href="/catalog.json">catalog.json</a>): the 69 standard generative-UI components — the same names and props as CopilotKit's Gen UI 2.0 standard catalog, so an agent written for one draws on the other — and AIN's own for files, upload, x402 payment, folder chat and pickers.</p>
        {GROUPS.map(([group, names]) => <section key={group}><h2>{group}</h2>
          <div className="docs-grid">{names.filter((n) => catalog.components?.[n]).map((n) => <a key={n} href={`/components/${n}`} className="docs-card"><strong>{n}</strong><span>{String(catalog.components[n].description ?? "").split(". ")[0]}.</span></a>)}</div>
        </section>)}
      </>}
    </main>
  </div>;
}
