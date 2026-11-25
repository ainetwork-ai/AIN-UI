"use client";

/** Standard catalog — rich: dashboard building blocks (headings, KPIs, trends, progress, notes, people, timelines). */
import React, { useId, useState } from "react";
import { Kids, cx, mediaUrl, standard, useHost } from "../core.js";
import { IconGlyph } from "./media.js";

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
const list = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const display = (v: unknown): string => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-US") : str(v));

type Mood = "positive" | "negative" | "warning" | "info" | "accent" | "neutral";
const MOODS = new Set(["positive", "negative", "warning", "info", "accent"]);
const toneMood = (tone: unknown): Mood | undefined => (typeof tone === "string" && MOODS.has(tone) ? (tone as Mood) : undefined);
type Trend = "up" | "down" | "flat";
/** The trend as given, or read from the delta's sign ("+4%" is up, "-2" is down). */
function trendOf(trend: unknown, delta: unknown): Trend | undefined {
  if (trend === "up" || trend === "down" || trend === "flat") return trend;
  const d = str(delta).trim();
  return /^\+/.test(d) ? "up" : /^[-−–]/.test(d) ? "down" : undefined;
}
/** An explicit tone wins (a falling churn can be positive); otherwise up is good and down is bad. */
const moodOf = (tone: unknown, trend: Trend | undefined): Mood =>
  toneMood(tone) ?? (trend === "up" ? "positive" : trend === "down" ? "negative" : "neutral");

function Delta({ delta, trend, mood }: { delta: string; trend?: Trend; mood: Mood }) {
  if (!delta) return null;
  const glyph = trend === "up" ? "arrow-up-right" : trend === "down" ? "arrow-down-right" : trend === "flat" ? "arrow-right" : "";
  return <span className={cx("ainui-delta", `ainui-delta-${mood}`, `ainui-rich-${mood}`)}>
    {glyph && <IconGlyph name={glyph} size={14} strokeWidth={2.25} />}<span>{delta}</span>
  </span>;
}

/** A Lucide icon name, or an emoji / short text shown as written. */
function Glyph({ icon, size = 18 }: { icon: string; size?: number }) {
  return /^[a-z][a-z0-9-]*$/i.test(icon) ? <IconGlyph name={icon} size={size} /> : <span className="ainui-emoji" aria-hidden="true">{icon}</span>;
}

/* ---------- Heading, Section ---------- */

const Heading = standard("Heading", ({ props }) => {
  const level = ["1", "2", "3"].includes(String(props.level)) ? String(props.level) : "1";
  const H = `h${level}` as "h1";
  const eyebrow = str(props.eyebrow), subtitle = str(props.subtitle);
  return <header className={cx("ainui-heading", `ainui-heading-${level}`)}>
    {eyebrow && <p className="ainui-eyebrow">{eyebrow}</p>}
    <H className="ainui-heading-title">{str(props.text)}</H>
    {subtitle && <p className="ainui-heading-subtitle">{subtitle}</p>}
  </header>;
});

const Section = standard("Section", ({ props, buildChild }) => {
  const id = useId();
  const eyebrow = str(props.eyebrow), title = str(props.title), description = str(props.description);
  return <section className="ainui-section" aria-labelledby={title ? id : undefined}>
    {(eyebrow || title || description) && <div className="ainui-section-head">
      {(title || eyebrow) && <div className="ainui-section-titles">
        {title && <h3 id={id} className="ainui-section-title">{title}</h3>}
        {eyebrow && <span className="ainui-eyebrow">{eyebrow}</span>}
      </div>}
      {description && <p className="ainui-section-description">{description}</p>}
    </div>}
    <div className="ainui-section-body"><Kids of={props.children} buildChild={buildChild} /></div>
  </section>;
});

/* ---------- Stat, StatGroup, Sparkline ---------- */

const Stat = standard("Stat", ({ props }) => {
  const trend = trendOf(props.trend, props.delta);
  const mood = moodOf(props.tone, trend);
  const icon = str(props.icon), caption = str(props.caption);
  return <div className={cx("ainui-stat", `ainui-stat-${mood}`, `ainui-rich-${mood}`)}>
    <div className="ainui-stat-label">{icon && <Glyph icon={icon} size={15} />}<span>{str(props.label)}</span></div>
    <div className="ainui-stat-line">
      <span className="ainui-stat-value">{display(props.value) || "—"}</span>
      <Delta delta={str(props.delta)} trend={trend} mood={mood} />
    </div>
    {caption && <div className="ainui-stat-caption">{caption}</div>}
  </div>;
});

const StatGroup = standard("StatGroup", ({ props }) => {
  const items = list(props.items).map(obj).filter((i) => str(i.label) || display(i.value));
  return <div className="ainui-stat-group" role="group">
    {items.map((item, i) => {
      const trend = trendOf(item.trend, item.delta);
      const mood = moodOf(undefined, trend);
      return <div key={i} className={cx("ainui-stat-group-item", `ainui-stat-${mood}`, `ainui-rich-${mood}`)}>
        <div className="ainui-stat-label">{str(item.label)}</div>
        <div className="ainui-stat-line">
          <span className="ainui-stat-value">{display(item.value) || "—"}</span>
          <Delta delta={str(item.delta)} trend={trend} mood={mood} />
        </div>
      </div>;
    })}
  </div>;
});

const W = 120, H = 36;
const Sparkline = standard("Sparkline", ({ props }) => {
  const gradient = `ainui-spark-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const values = list(props.values).map(num).filter((v): v is number => v !== undefined);
  const delta = str(props.delta);
  const trend = trendOf(undefined, delta) ?? (values.length > 1 ? (values[values.length - 1] > values[0] ? "up" : values[values.length - 1] < values[0] ? "down" : "flat") : undefined);
  const tone = props.tone === "positive" || props.tone === "negative" ? props.tone : undefined;
  const lineMood: Mood = tone ?? "accent";
  const deltaMood = moodOf(tone, trend);
  const value = str(props.value) || (values.length ? values[values.length - 1].toLocaleString("en-US") : "");
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const points = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * W : W / 2, 3 + (1 - (v - min) / span) * (H - 6)] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const label = str(props.label);
  return <div className={cx("ainui-sparkline", `ainui-sparkline-${lineMood}`, `ainui-rich-${lineMood}`)}>
    <div className="ainui-sparkline-text">
      {label && <div className="ainui-stat-label">{label}</div>}
      <div className="ainui-stat-line">
        {value && <span className="ainui-sparkline-value">{value}</span>}
        <Delta delta={delta} trend={trend} mood={deltaMood} />
      </div>
    </div>
    {points.length > 1 && <svg className="ainui-sparkline-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      aria-label={`${label ? `${label}: ` : ""}${values.length} values from ${values[0]} to ${values[values.length - 1]}`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} /><stop offset="100%" stopColor="currentColor" stopOpacity={0} />
      </linearGradient></defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${gradient})`} stroke="none" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>}
  </div>;
});

/* ---------- Progress ---------- */

const Progress = standard("Progress", ({ props }) => {
  const value = Math.max(0, Math.min(100, num(props.value) ?? 0));
  const mood = toneMood(props.tone) ?? "accent";
  const label = str(props.label), caption = str(props.caption);
  const shown = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return <div className={cx("ainui-progress", `ainui-progress-${mood}`, `ainui-rich-${mood}`)}>
    <div className="ainui-progress-head">
      <span className="ainui-progress-label">{label}</span>
      <span className="ainui-progress-percent">{shown}%</span>
    </div>
    <div className="ainui-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} aria-label={label || "Progress"}>
      <div className="ainui-progress-fill" style={{ width: `${value}%` }} />
    </div>
    {caption && <div className="ainui-progress-caption">{caption}</div>}
  </div>;
});

/* ---------- Callout, Alert ---------- */

function ActionButton({ label, onAction, className }: { label: string; onAction?: unknown; className?: string }) {
  if (!label) return null;
  return <button type="button" className={cx("ainui-rich-button", className)} disabled={typeof onAction !== "function"}
    onClick={() => { if (typeof onAction === "function") void onAction(); }}>{label}</button>;
}

const Callout = standard("Callout", ({ props }) => {
  const icon = str(props.icon) || "lightbulb", title = str(props.title);
  return <aside className="ainui-callout">
    <span className="ainui-callout-icon"><Glyph icon={icon} size={18} /></span>
    <div className="ainui-callout-body">
      {title && <div className="ainui-callout-title">{title}</div>}
      <div className="ainui-callout-text">{str(props.text)}</div>
      <ActionButton label={str(props.actionLabel)} onAction={props.onAction} className="ainui-callout-action" />
    </div>
  </aside>;
});

const ALERT_ICON: Record<string, string> = { info: "info", success: "circle-check", warning: "triangle-alert", error: "circle-alert" };
const Alert = standard("Alert", ({ props }) => {
  const tone = props.tone in ALERT_ICON ? (props.tone as string) : "info";
  const message = str(props.message);
  return <div className={cx("ainui-alert", `ainui-alert-${tone}`)} role={tone === "error" || tone === "warning" ? "alert" : "status"}>
    <span className="ainui-alert-icon"><IconGlyph name={ALERT_ICON[tone]} size={18} /></span>
    <div className="ainui-alert-body">
      <div className="ainui-alert-title">{str(props.title)}</div>
      {message && <div className="ainui-alert-message">{message}</div>}
    </div>
  </div>;
});

/* ---------- Avatar ---------- */

const HUES = ["info", "success", "warning", "discovery", "danger", "caution", "secondary"];
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length > 1 ? [parts[0], parts[parts.length - 1]].map((p) => Array.from(p)[0]) : Array.from(parts[0] ?? "").slice(0, 2);
  return chars.join("").toUpperCase() || "?";
};
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.codePointAt(0)!) >>> 0; return HUES[h % HUES.length]; };

const Avatar = standard("Avatar", ({ props }) => {
  const host = useHost();
  const [broken, setBroken] = useState(false);
  const name = str(props.name), subtitle = str(props.subtitle);
  const size = ["sm", "md", "lg"].includes(props.size) ? props.size : "md";
  const status = ["online", "away", "offline"].includes(props.status) ? props.status : "";
  const src = broken ? "" : mediaUrl(props.image, host);
  const hue = hueOf(name);
  return <div className={cx("ainui-avatar", `ainui-avatar-${size}`)}>
    <span className="ainui-avatar-circle" style={src ? undefined : { background: `var(--ainui-${hue}-soft)`, color: `var(--ainui-${hue})` }}>
      {src ? <img src={src} alt="" onError={() => setBroken(true)} /> : <span aria-hidden="true">{initials(name)}</span>}
      {status && <span className={cx("ainui-avatar-status", `ainui-avatar-status-${status}`)} role="img" aria-label={status} />}
    </span>
    {(name || subtitle) && <span className="ainui-avatar-text">
      {name && <span className="ainui-avatar-name">{name}</span>}
      {subtitle && <span className="ainui-avatar-subtitle">{subtitle}</span>}
    </span>}
  </div>;
});

/* ---------- KeyValueList, Timeline, TagList ---------- */

const KeyValueList = standard("KeyValueList", ({ props }) => {
  const items = list(props.items).map(obj).filter((i) => str(i.label) || display(i.value));
  const columns = Math.max(1, Math.min(3, Math.round(num(props.columns) ?? 1)));
  const title = str(props.title);
  return <div className="ainui-kv">
    {title && <div className="ainui-kv-title">{title}</div>}
    <dl className={cx("ainui-kv-grid", `ainui-kv-columns-${columns}`)}>
      {items.map((item, i) => <div key={i} className="ainui-kv-row">
        <dt className="ainui-kv-label">{str(item.label)}{str(item.hint) && <span className="ainui-kv-hint">{str(item.hint)}</span>}</dt>
        <dd className="ainui-kv-value">{display(item.value)}</dd>
      </div>)}
    </dl>
  </div>;
});

const Timeline = standard("Timeline", ({ props }) => {
  const items = list(props.items).map(obj).filter((i) => str(i.title));
  return <ol className="ainui-timeline">
    {items.map((item, i) => {
      const status = ["done", "current", "upcoming"].includes(item.status) ? item.status : "upcoming";
      const icon = str(item.icon) || (status === "done" ? "check" : "");
      const time = str(item.time), description = str(item.description);
      return <li key={i} className={cx("ainui-timeline-item", `ainui-timeline-${status}`)} aria-current={status === "current" ? "step" : undefined}>
        <span className="ainui-timeline-marker">{icon && (status === "done" && !str(item.icon) ? <IconGlyph name="check" size={14} strokeWidth={3} /> : <Glyph icon={icon} size={13} />)}</span>
        <div className="ainui-timeline-content">
          <div className="ainui-timeline-head">
            <span className="ainui-timeline-title">{str(item.title)}</span>
            {time && <span className="ainui-timeline-time">{time}</span>}
          </div>
          {description && <div className="ainui-timeline-description">{description}</div>}
        </div>
      </li>;
    })}
  </ol>;
});

const TagList = standard("TagList", ({ props }) => {
  const tags = list(props.tags).map(str).filter(Boolean);
  const mood = toneMood(props.tone) ?? "neutral";
  return <ul className={cx("ainui-tag-list", `ainui-tag-list-${mood}`, `ainui-rich-${mood}`)}>
    {tags.map((t, i) => <li key={`${t}:${i}`} className="ainui-tag">{t}</li>)}
  </ul>;
});

/* ---------- EmptyState ---------- */

const EmptyState = standard("EmptyState", ({ props }) => {
  const description = str(props.description);
  return <div className="ainui-empty-state">
    <span className="ainui-empty-state-icon"><Glyph icon={str(props.icon) || "inbox"} size={24} /></span>
    <div className="ainui-empty-state-title">{str(props.title)}</div>
    {description && <p className="ainui-empty-state-description">{description}</p>}
    <ActionButton label={str(props.actionLabel)} onAction={props.onAction} className="ainui-empty-state-action" />
  </div>;
});

export const rich = [Heading, Section, Stat, StatGroup, Sparkline, Progress, Callout, Alert, Avatar, KeyValueList, Timeline, TagList, EmptyState];
