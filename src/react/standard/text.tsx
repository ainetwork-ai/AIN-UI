"use client";

/** Standard catalog — text: headings, body text, inline marks, badges, code, markdown, math, links, tooltips. */
import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { renderMarkdown } from "@a2ui/markdown-it";
import { Kids, color, cx, kid, px, safeUrl, space, standard, useHost, type ViewProps } from "../core.js";

/** True inside an element that only takes phrasing content (a paragraph, a button): block text renders a `span`. */
export const InlineContext = createContext(false);

const WEIGHT: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };
const ALIGN = ["start", "center", "end"];
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Text colour tokens name roles (`secondary` is quieter text), unlike the tone colours of `color()`. */
function textColor(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  if (v === "default" || v === "prose" || v === "emphasis") return "var(--ainui-fg)";
  if (v === "secondary" || v === "tertiary") return "var(--ainui-muted)";
  return color(v);
}

/** http(s), site-relative and mailto. Anything else gives "". */
export function linkUrl(v: unknown): string {
  return safeUrl(v) || (typeof v === "string" && /^mailto:[^\s<>"]+$/i.test(v.trim()) ? v.trim() : "");
}

function Anchor({ href, title, className, children }: { href: unknown; title?: unknown; className?: string; children: React.ReactNode }) {
  const host = useHost();
  const url = linkUrl(href);
  const viaHost = host.openUrl && safeUrl(url) ? host.openUrl : undefined;
  return <a className={cx("ainui-link", className)} href={url || undefined} title={typeof title === "string" && title ? title : undefined}
    target={url ? "_blank" : undefined} rel={url ? "noopener noreferrer" : undefined}
    onClick={viaHost ? (e) => { e.preventDefault(); viaHost(url); } : undefined}>{children}</a>;
}

const INLINE = /\\([\\`*_~+[\]()])|(`+)(.+?)\2|\*\*(?=\S)(.+?)(?<=\S)\*\*|\*(?=\S)(.+?)(?<=\S)\*|~~(.+?)~~|\+\+(.+?)\+\+|\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/gs;

/** Inline markdown as React elements (never HTML): bold, italic, strike, underline, code, links. */
export function inlineMarkdown(source: string, depth = 0): React.ReactNode[] {
  if (depth > 6 || !/[\\`*~+[]/.test(source)) return [source];
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of source.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(source.slice(last, at));
    last = at + m[0].length;
    const key = `${depth}:${at}`;
    const inner = (s: string) => inlineMarkdown(s, depth + 1);
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[3] !== undefined) out.push(<code key={key} className="ainui-code">{m[3]}</code>);
    else if (m[4] !== undefined) out.push(<strong key={key}>{inner(m[4])}</strong>);
    else if (m[5] !== undefined) out.push(<em key={key}>{inner(m[5])}</em>);
    else if (m[6] !== undefined) out.push(<s key={key}>{inner(m[6])}</s>);
    else if (m[7] !== undefined) out.push(<u key={key}>{inner(m[7])}</u>);
    else if (linkUrl(m[9])) out.push(<Anchor key={key} href={m[9]} title={m[10]}>{inner(m[8])}</Anchor>);
    else out.push(m[0]);
  }
  if (last < source.length) out.push(source.slice(last));
  return out;
}

const plain = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");
const rich = (v: unknown): React.ReactNode => (typeof v === "string" ? inlineMarkdown(v) : plain(v) || null);

/** The typography props Title, Text, Caption, Label and ShimmerText share. */
function typography(p: Record<string, any>, base: string, size: string, weight?: number) {
  const lines = num(p.maxLines), min = num(p.minLines);
  const decoration = [p.underline && "underline", p.lineThrough && "line-through"].filter(Boolean).join(" ");
  const style: React.CSSProperties = {
    color: textColor(p.color), fontWeight: WEIGHT[p.fontWeight] ?? weight, textAlign: ALIGN.includes(p.textAlign) ? p.textAlign : undefined,
    fontStyle: p.italic ? "italic" : undefined, fontVariantNumeric: p.tabularNums ? "tabular-nums" : undefined,
    width: px(p.width), fontSize: px(p.fontSize), lineHeight: num(p.lineHeight) ?? (typeof p.lineHeight === "string" && p.lineHeight ? p.lineHeight : undefined),
    minHeight: min && min > 0 ? `calc(${min} * 1lh)` : undefined, textDecoration: decoration || undefined,
    whiteSpace: p.preserveWhitespace ? "pre-wrap" : undefined,
    ...(lines && lines > 0 ? { WebkitLineClamp: Math.round(lines) } : {}),
    ...(typeof p.weight === "number" ? { flex: `${p.weight} 1 0%`, minWidth: 0 } : {}),
  };
  const className = cx(base, `${base}-${typeof p.size === "string" && /^[a-z0-9]+$/.test(p.size) ? p.size : size}`,
    p.truncate && "ainui-truncate", !!lines && lines > 0 && "ainui-clamp");
  return { className, style };
}

const HEADING: Record<string, "h2" | "h3" | "h4"> = { sm: "h4", md: "h3", lg: "h3" };
const Title = standard("Title", ({ props }) => {
  const Tag = HEADING[props.size ?? "md"] ?? (typeof props.size === "string" ? "h2" : "h3");
  return <Tag {...typography(props, "ainui-title", "md", props.strong === false ? 400 : 700)}>{plain(props.text)}</Tag>;
});

const HIGHLIGHT: Record<string, string> = { green: "success", orange: "warning", pink: "danger" };
const Text = standard("Text", ({ props, buildChild }) => {
  const nested = useContext(InlineContext);
  const Tag = nested || props.inline ? "span" : "p";
  const t = typography(props, "ainui-text", "md", props.strong ? 600 : undefined);
  const body = rich(props.text);
  return <Tag className={cx(t.className, props.inline && "ainui-text-inline")} style={t.style}>
    {props.highlight ? <mark className="ainui-highlight" style={{ background: `var(--ainui-${HIGHLIGHT[props.highlight] ?? "warning"}-soft)` }}>{body}</mark> : body}
    <InlineContext.Provider value={true}><Kids of={props.children} buildChild={buildChild} /></InlineContext.Provider>
  </Tag>;
});

const Caption = standard("Caption", ({ props }) => {
  const Tag = useContext(InlineContext) ? "span" : "div";
  return <Tag {...typography(props, "ainui-caption", "lg")}>{rich(props.text)}</Tag>;
});

const Label = standard("Label", ({ props }) =>
  <label htmlFor={typeof props.htmlFor === "string" && props.htmlFor ? props.htmlFor : undefined} {...typography(props, "ainui-label", "sm", 500)}>{plain(props.text)}</label>);

const Bold = standard("Bold", ({ props }) => <strong className="ainui-bold" style={{ fontWeight: WEIGHT[props.fontWeight] }}>{plain(props.text)}</strong>);
const Italic = standard("Italic", ({ props }) => <em className="ainui-italic">{plain(props.text)}</em>);
const Underline = standard("Underline", ({ props }) => <u className="ainui-underline">{plain(props.text)}</u>);
const Strikethrough = standard("Strikethrough", ({ props }) => <s className="ainui-strikethrough">{plain(props.text)}</s>);

const BADGE_COLORS = ["secondary", "success", "danger", "warning", "info", "discovery"];
const Badge = standard("Badge", ({ props }) => {
  const pick = (v: unknown, of: string[], fallback: string) => (typeof v === "string" && of.includes(v) ? v : fallback);
  return <span className={cx("ainui-badge", `ainui-badge-${pick(props.variant, ["soft", "solid", "outline"], "soft")}`, `ainui-badge-${pick(props.color, BADGE_COLORS, "secondary")}`,
    `ainui-badge-${pick(props.size, ["sm", "md", "lg"], "md")}`, props.pill !== false && "ainui-badge-pill")}
    style={{ fontWeight: WEIGHT[props.fontWeight], maxWidth: px(props.maxWidth), padding: space(props.padding) }}>{plain(props.label)}</span>;
});

const Blockquote = standard("Blockquote", ({ props }) => <blockquote className="ainui-blockquote">{rich(props.text)}</blockquote>);

const Code = standard("Code", ({ props }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const source = plain(props.text);
  const language = typeof props.language === "string" ? props.language.trim().replace(/[^\w+#.-]/g, "") : "";
  if (!language) return <code className="ainui-code">{source}</code>;
  const copy = async () => {
    try { await globalThis.navigator?.clipboard?.writeText(source); } catch { /* clipboard denied: the button still confirms nothing was thrown */ }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };
  return <div className="ainui-code-block">
    <div className="ainui-code-bar">
      <span className="ainui-code-language">{language}</span>
      <button type="button" className="ainui-code-copy" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
    </div>
    <pre tabIndex={0}><code className={`language-${language}`}>{source}</code></pre>
  </div>;
});

const Markdown = standard("Markdown", ({ props }) => {
  const source = plain(props.text);
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const asked = useRef(0), shown = useRef(0);
  useEffect(() => {
    const turn = ++asked.current;
    // A slow render never replaces a newer one, and the previous HTML stays until this one is ready.
    const show = (out: unknown) => { if (turn > shown.current && typeof out === "string") { shown.current = turn; setHtml(out); } };
    try {
      const out: unknown = renderMarkdown(source);
      if (out && typeof (out as Promise<string>).then === "function") (out as Promise<string>).then(show, () => undefined);
      else show(out);
    } catch { /* the plain source stays visible */ }
  }, [source]);
  useLayoutEffect(() => {
    ref.current?.querySelectorAll?.("a[href]").forEach((a) => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
  }, [html]);
  const className = cx("ainui-markdown", props.streaming && "ainui-markdown-streaming");
  const busy = props.streaming ? true : undefined;
  return html === null
    ? <div className={cx(className, "ainui-markdown-plain")} aria-busy={busy}>{source}</div>
    : <div ref={ref} className={className} aria-busy={busy} dangerouslySetInnerHTML={{ __html: html }} />;
});

type Katex = { renderToString: (tex: string, options?: Record<string, unknown>) => string };
let katexLoad: Promise<Katex | null> | undefined;
const loadKatex = () => (katexLoad ??= (async () => {
  try {
    const mod: any = await import("katex");
    const k = mod?.default?.renderToString ? mod.default : mod;
    return typeof k?.renderToString === "function" ? (k as Katex) : null;
  } catch { return null; }
})());

const Math_ = standard("Math", ({ props }) => {
  const tex = plain(props.value), block = !!props.block;
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadKatex().then((k) => {
      if (!live) return;
      try { setHtml(k ? k.renderToString(tex, { throwOnError: false, displayMode: block }) : null); } catch { setHtml(null); }
    });
    return () => { live = false; };
  }, [tex, block]);
  const Tag = block ? "div" : "span";
  const className = cx("ainui-math", block && "ainui-math-block");
  return html === null
    ? <Tag className={className}><code className="ainui-math-source">{tex}</code></Tag>
    : <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

const ShimmerText = standard("ShimmerText", ({ props }) => {
  const t = typography(props, "ainui-shimmer-text", "md");
  const { color: base, ...style } = t.style;
  return <span className={t.className} aria-busy="true"
    style={{ ...style, ...(base ? { "--ainui-shimmer-base": base } as React.CSSProperties : {}), ...(style.width || style.textAlign ? { display: "block" } : {}) }}>{plain(props.text)}</span>;
});

const Link = standard("Link", ({ props }) => <Anchor href={props.href} title={props.title}>{plain(props.text)}</Anchor>);

const Tooltip = standard("Tooltip", ({ props, buildChild }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const has = props.content != null && props.content !== "";
  return <span className="ainui-tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
    <span className="ainui-tooltip-trigger" tabIndex={0} aria-describedby={has ? id : undefined}>
      <InlineContext.Provider value={true}>{kid(buildChild, props.trigger)}</InlineContext.Provider>
    </span>
    {has && <span id={id} role="tooltip" className="ainui-tooltip-content" hidden={!open}>
      <InlineContext.Provider value={true}>{kid(buildChild, props.content)}</InlineContext.Provider>
    </span>}
  </span>;
});

export const text = [Title, Text, Caption, Label, Bold, Italic, Underline, Strikethrough, Badge, Blockquote, Code, Markdown, Math_, ShimmerText, Link, Tooltip];
