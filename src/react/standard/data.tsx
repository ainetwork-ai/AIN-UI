"use client";

/** Standard catalog — data: tables, lists, charts and maps. Charts and maps are drawn here, without a library. */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Kids, color, cx, fire, kid, px, safeUrl, space, standard, useHost, type BuildChild, type ChildRef } from "../core.js";
import { IconGlyph } from "./media.js";

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const list = <T = any,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const refKey = (ref: ChildRef, i: number) => (typeof ref === "string" ? ref : `${ref.id}:${ref.basePath ?? i}`);
const refId = (ref: ChildRef) => (typeof ref === "string" ? ref : ref?.id);

/** The width the element has on screen, so an SVG can be drawn at real pixel size. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const w = el.clientWidth; if (w > 0) setWidth(w); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ---------- Table ---------- */

const ALIGNS = ["start", "center", "end"];
const VALIGN: Record<string, string> = { start: "top", center: "middle", end: "bottom" };
const span = (v: unknown) => (typeof v === "number" && v > 1 ? Math.floor(v) : undefined);
const TableContext = createContext<{ header: boolean }>({ header: false });

/** A cell value of the `columns`/`rows` form: text, or a component by `{componentId}`. */
function cellContent(cell: unknown, buildChild: BuildChild): React.ReactNode {
  if (cell == null || typeof cell === "boolean") return cell === true ? "Yes" : cell === false ? "No" : null;
  if (typeof cell === "string" || typeof cell === "number") return cell;
  const c = obj(cell);
  const id = typeof c.componentId === "string" ? c.componentId : typeof c.id === "string" ? c.id : "";
  if (id) return kid(buildChild, typeof c.basePath === "string" ? { id, basePath: c.basePath } : id);
  return str(c.label ?? c.text ?? c.value);
}

const Table = standard("Table", ({ props, buildChild, context }) => {
  const columns = list(props.columns);
  const rows = list(props.rows).filter(Array.isArray) as unknown[][];
  const children = list<ChildRef>(props.children);
  const emptyLabel = str(props.emptyLabel) || "No rows";
  const className = cx("ainui-table", props.dividers !== false && "ainui-table-dividers", props.stickyHeader && "ainui-table-sticky", props.columnSizing === "equal" && "ainui-table-equal");
  const caption = str(props.caption) ? <caption className="ainui-table-caption">{str(props.caption)}</caption> : null;
  const width = Math.max(columns.length, ...rows.map((r) => r.length), 1);
  const align = (i: number) => (ALIGNS.includes(obj(columns[i]).align) ? (obj(columns[i]).align as "start" | "center" | "end") : undefined);

  let body: React.ReactNode;
  if (children.length) {
    // Rows given straight to the table are gathered into a body, as HTML requires.
    const groups: Array<{ row: boolean; refs: ChildRef[] }> = [];
    // The binder hands back node ids; the component each one is comes from the ids as written.
    const written = (context.componentModel.properties as Record<string, unknown>).children;
    children.forEach((ref, at) => {
      const id = Array.isArray(written) ? String(written[at]) : (written as { componentId?: string } | undefined)?.componentId ?? refId(ref);
      const row = context.surfaceComponents?.get?.(id)?.type !== "TableSection";
      const last = groups[groups.length - 1];
      if (row && last?.row) last.refs.push(ref); else groups.push({ row, refs: [ref] });
    });
    body = groups.map((g, i) => (g.row
      ? <div key={`rows${i}`} role="rowgroup" className="ainui-table-section ainui-table-body"><Kids of={g.refs} buildChild={buildChild} /></div>
      : <React.Fragment key={refKey(g.refs[0], i)}>{kid(buildChild, g.refs[0])}</React.Fragment>));
  } else {
    body = <>
      {columns.length > 0 && <thead className="ainui-table-section ainui-table-head"><tr className="ainui-table-row">
        {columns.map((c, i) => <th key={i} scope="col" className="ainui-table-cell" style={{ textAlign: align(i), width: px(obj(c).width) }}>
          {typeof c === "string" || typeof c === "number" ? c : typeof obj(c).componentId === "string" || (typeof obj(c).id === "string" && obj(c).label === undefined) ? cellContent(c, buildChild) : str(obj(c).label)}
        </th>)}
      </tr></thead>}
      <tbody className="ainui-table-section ainui-table-body">
        {rows.map((r, y) => <tr key={y} className="ainui-table-row">
          {Array.from({ length: width }, (_, x) => <td key={x} className="ainui-table-cell" style={{ textAlign: align(x) }}>{cellContent(r[x], buildChild)}</td>)}
        </tr>)}
        {rows.length === 0 && <tr className="ainui-table-row"><td className="ainui-table-cell ainui-table-empty" colSpan={width}>{emptyLabel}</td></tr>}
      </tbody>
    </>;
  }
  // Built from children, every part sits inside its own wrapper element, which HTML does not allow between
  // <table>, <tbody>, <tr> and <td>. So that form is the same table by role and by CSS (display: table-*).
  return <div className={cx("ainui-table-wrap", props.stickyHeader && "ainui-table-wrap-sticky")}>
    {children.length
      ? <div role="table" aria-label={str(props.caption) || undefined} className={cx(className, "ainui-table-grid")}>{body}</div>
      : <table className={className}>{caption}{body}</table>}
  </div>;
});

const TableSection = standard("TableSection", ({ props, buildChild }) => {
  const header = !!props.header;
  return <div role="rowgroup" className={cx("ainui-table-section", header ? "ainui-table-head" : "ainui-table-body", props.rowDivider === false && "ainui-table-section-plain", props.rowDivider === true && "ainui-table-section-divided")}>
    <TableContext.Provider value={{ header }}><Kids of={props.children} buildChild={buildChild} /></TableContext.Provider>
  </div>;
});

const TableRow = standard("TableRow", ({ props, buildChild }) => {
  const inherited = useContext(TableContext);
  const header = !!props.header || inherited.header;
  const label = str(props.label);
  return <div role="row" className={cx("ainui-table-row", header && "ainui-table-row-header")}>
    {label && <div role={header ? "columnheader" : "rowheader"} className="ainui-table-cell ainui-table-th ainui-table-row-label">{label}</div>}
    <TableContext.Provider value={{ header }}><Kids of={props.children} buildChild={buildChild} /></TableContext.Provider>
  </div>;
});

const TableCell = standard("TableCell", ({ props, buildChild }) => {
  const inherited = useContext(TableContext);
  const header = !!props.header || inherited.header;
  return <div role={header ? (inherited.header ? "columnheader" : "rowheader") : "cell"} className={cx("ainui-table-cell", header && "ainui-table-th")}
    aria-colspan={span(props.colSpan)} aria-rowspan={span(props.rowSpan)}
    style={{ textAlign: ALIGNS.includes(props.align) ? props.align : undefined, verticalAlign: VALIGN[props.vAlign] ?? "top", width: px(props.width), padding: space(props.padding) }}>
    {str(props.text)}<Kids of={props.children} buildChild={buildChild} />
  </div>;
});

/* ---------- List ---------- */

type Pick = (item: { index: number; label: string; value: unknown }) => void;
type ListScope = { marker: string; index: number; start: number; last?: boolean; markerSize?: number; pick?: Pick };
const ListContext = createContext<ListScope>({ marker: "bullet", index: 0, start: 1 });
const MARKERS = ["bullet", "number", "rich", "none"];
const LIST_ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };

function ListRow({ scope, label, value, description, icon, marker, markerSize, disabled, onPick, children }: {
  scope: ListScope; label: string; value?: unknown; description?: string; icon?: string; marker?: string; markerSize?: number; disabled?: boolean;
  onPick?: () => void; children?: React.ReactNode;
}) {
  const shown = scope.marker === "none" ? null
    : marker ? marker
      : scope.marker === "number" ? `${scope.start + scope.index}.`
        : scope.marker === "rich" ? (icon ? <IconGlyph name={icon} size={16} /> : `${scope.start + scope.index}`)
          : "•";
  const size = markerSize ?? scope.markerSize;
  const side = str(value);
  const text = <span className="ainui-list-item-text">
    <span className="ainui-list-item-line">
      {icon && scope.marker !== "rich" && <IconGlyph name={icon} size={16} className="ainui-list-item-icon" />}
      <span className="ainui-list-item-label">{label}</span>
      {side && !onPick && <span className="ainui-list-item-value">{side}</span>}
    </span>
    {description && <span className="ainui-list-item-description">{description}</span>}
  </span>;
  // A div with the list item role: an item built from a ListItem child sits in its own wrapper element, which <ul> does not allow.
  return <div role="listitem" className={cx("ainui-list-item", scope.last && "ainui-list-item-last", disabled && "ainui-list-item-disabled", side && !onPick && "ainui-list-item-fact")} aria-disabled={disabled || undefined}>
    {shown != null && <span className={cx("ainui-list-marker", scope.marker === "rich" && "ainui-list-marker-rich")} aria-hidden="true" style={size ? { width: size, flexBasis: size } : undefined}>{shown}</span>}
    <span className="ainui-list-item-body">
      {onPick ? <button type="button" className="ainui-list-item-button" disabled={disabled} onClick={onPick}>{text}</button> : text}
      {children}
    </span>
  </div>;
}

const List = standard("List", ({ props, buildChild, context }) => {
  const marker = MARKERS.includes(props.marker) ? (props.marker as string) : "bullet";
  const horizontal = props.direction === "horizontal";
  const start = num(props.start) ?? 1;
  const pick: Pick | undefined = props.action ? (item) => void fire(context, "action", item) : undefined;
  const scope = (index: number, count: number): ListScope => ({ marker, index, start, last: index === count - 1, markerSize: num(props.maxMarkerSize), pick });
  const children = list<ChildRef>(props.children);
  const items = list(props.items).filter((it) => typeof it === "string" || typeof it === "number" || str(obj(it).label));
  return <div role="list"
    className={cx("ainui-list", `ainui-list-${marker}`, horizontal && "ainui-list-horizontal", props.connector === "solid" && "ainui-list-connector")}
    style={{ gap: space(props.gap), alignItems: LIST_ALIGN[props.align] }}>
    {children.length > 0
      ? children.map((ref, i) => <ListContext.Provider key={refKey(ref, i)} value={scope(i, children.length)}>{kid(buildChild, ref)}</ListContext.Provider>)
      : items.map((it, i) => {
        const label = typeof it === "object" ? str(it.label) : str(it);
        const value = typeof it === "object" ? it.value : undefined;
        return <ListRow key={i} scope={scope(i, items.length)} label={label} value={value} description={str(obj(it).description)} icon={str(obj(it).icon)}
          onPick={pick ? () => pick({ index: i, label, value: value ?? label }) : undefined} />;
      })}
  </div>;
});

const ListItem = standard("ListItem", ({ props, buildChild }) => {
  const scope = useContext(ListContext);
  const label = str(props.label);
  const disabled = !!props.disabled;
  const onPick = disabled ? undefined
    : props.action ? () => void props.action()
      : scope.pick ? () => scope.pick?.({ index: scope.index, label, value: props.value ?? label })
        : undefined;
  return <ListRow scope={scope} label={label} value={props.value} description={str(props.description)} icon={str(props.icon)} marker={str(props.marker)}
    markerSize={num(props.markerSize)} disabled={disabled} onPick={onPick ?? (disabled && (props.action || scope.pick) ? () => undefined : undefined)}>
    {list(props.children).length > 0 && <span className="ainui-list-item-children"><Kids of={props.children} buildChild={buildChild} /></span>}
  </ListRow>;
});

/* ---------- Chart ---------- */

const TONES = ["primary", "info", "success", "warning", "discovery", "danger"];
const tone = (i: number) => `var(--ainui-${TONES[i % TONES.length]})`;
const CHART_TYPES = ["bar", "line", "area", "scatter", "pie", "donut"];
type Series = { key: string; label: string; color: string };

function numberFormat(format: unknown, currency: unknown) {
  const options: Intl.NumberFormatOptions = format === "currency" ? { style: "currency", currency: str(currency) || "USD", maximumFractionDigits: 2, trailingZeroDisplay: "stripIfInteger" } as Intl.NumberFormatOptions
    : format === "percent" ? { style: "percent", maximumFractionDigits: 1 } : { maximumFractionDigits: 2 };
  const build = (o: Intl.NumberFormatOptions) => {
    try { return new Intl.NumberFormat(undefined, o); }
    catch { return new Intl.NumberFormat(undefined, format === "currency" ? { ...o, currency: "USD" } : {}); }
  };
  const full = build(options), compact = build({ ...options, notation: "compact" });
  return { value: (v: number) => full.format(v), tick: (v: number) => (Math.abs(v) >= 10000 ? compact.format(v) : full.format(v)) };
}

/** Round tick values covering min..max. */
function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) max = min + (Math.abs(min) || 1);
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999 && out.length < 50; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

function axis(values: number[], lo: unknown, hi: unknown, zero: boolean) {
  let min = Math.min(...values), max = Math.max(...values);
  if (zero) { min = Math.min(0, min); max = Math.max(0, max); }
  const fixedMin = num(lo), fixedMax = num(hi);
  if (fixedMin !== undefined) min = fixedMin;
  if (fixedMax !== undefined) max = fixedMax;
  if (!(max > min)) max = min + (Math.abs(min) || 1);
  let ticks = niceTicks(min, max);
  const from = fixedMin ?? ticks[0], to = fixedMax ?? ticks[ticks.length - 1];
  ticks = ticks.filter((t) => t >= from - 1e-9 && t <= to + 1e-9);
  return { from, to, ticks, at: (v: number) => (to === from ? 0 : (Math.max(from, Math.min(to, v)) - from) / (to - from)) };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);
const polar = (cx0: number, cy0: number, r: number, deg: number): [number, number] => [cx0 + r * Math.cos((deg * Math.PI) / 180), cy0 - r * Math.sin((deg * Math.PI) / 180)];
const f = (n: number) => Number(n.toFixed(2));

function slicePath(cx0: number, cy0: number, inner: number, outer: number, a0: number, a1: number): string {
  if (Math.abs(a1 - a0) >= 360) a1 = a0 + Math.sign(a1 - a0) * 359.99;
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 < a0 ? 1 : 0;
  const [x0, y0] = polar(cx0, cy0, outer, a0), [x1, y1] = polar(cx0, cy0, outer, a1);
  if (inner <= 0) return `M${f(cx0)},${f(cy0)}L${f(x0)},${f(y0)}A${f(outer)},${f(outer)} 0 ${large} ${sweep} ${f(x1)},${f(y1)}Z`;
  const [x2, y2] = polar(cx0, cy0, inner, a1), [x3, y3] = polar(cx0, cy0, inner, a0);
  return `M${f(x0)},${f(y0)}A${f(outer)},${f(outer)} 0 ${large} ${sweep} ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${f(inner)},${f(inner)} 0 ${large} ${1 - sweep} ${f(x3)},${f(y3)}Z`;
}
const radiusOf = (v: unknown, max: number, fallback: number) => {
  const n = num(v);
  if (n !== undefined) return Math.max(0, Math.min(max, n));
  const pct = typeof v === "string" ? /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(v) : null;
  return pct ? Math.max(0, Math.min(max, (max * Number(pct[1])) / 100)) : fallback;
};

const Chart = standard("Chart", ({ props }) => {
  const [ref, width] = useWidth(640);
  const height = Math.max(120, num(props.height) ?? 240);
  const type = CHART_TYPES.includes(props.chartType) ? (props.chartType as string) : "bar";
  const title = str(props.title);
  const rows = list(props.data).filter((r) => r && typeof r === "object" && !Array.isArray(r)) as Array<Record<string, unknown>>;
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const xKey = str(props.xKey) || keys.find((k) => rows.some((r) => typeof r[k] === "string")) || keys[0] || "";
  const declared = list(props.series).map((s) => (typeof s === "string" ? { key: s } : obj(s))).filter((s) => typeof s.key === "string" && s.key);
  const series: Series[] = (declared.length ? declared : keys.filter((k) => k !== xKey && rows.some((r) => num(r[k]) !== undefined)).map((key) => ({ key } as Record<string, any>)))
    .map((s, i) => ({ key: s.key as string, label: str(s.label) || (s.key as string), color: color(s.color) ?? tone(i) }));
  const val = (r: Record<string, unknown>, key: string) => num(r[key]) ?? (typeof r[key] === "string" && r[key] !== "" && Number.isFinite(Number(r[key])) ? Number(r[key]) : undefined);
  const fmt = numberFormat(props.format, props.currency);
  const cat = (r: Record<string, unknown>, i: number) => str(r[xKey]) || `${i + 1}`;
  const round = type === "pie" || type === "donut";
  const usable = rows.length > 0 && series.length > 0 && rows.some((r) => series.some((s) => val(r, s.key) !== undefined));
  const slices = round && usable ? rows.map((r, i) => ({ name: cat(r, i), value: Math.max(0, val(r, series[0].key) ?? 0), color: tone(i) })).filter((s) => s.value > 0) : [];
  const total = slices.reduce((a, s) => a + s.value, 0);

  if (!usable || (round && total <= 0)) {
    return <figure className="ainui-chart ainui-chart-empty" ref={ref as never}>
      {title && <figcaption className="ainui-chart-title">{title}</figcaption>}
      <p className="ainui-chart-message" style={{ minHeight: Math.min(height, 120) }}>No data</p>
    </figure>;
  }

  const tip = (text: string) => (props.showTooltip === false ? null : <title>{text}</title>);
  const labels = !!props.showValueLabels;
  const yAxis = obj(props.yAxis);
  const marks: React.ReactNode[] = [];
  let legend: Array<{ label: string; color: string }> = series.map((s) => ({ label: s.label, color: s.color }));
  let showLegend = props.showLegend !== false && (series.length > 1 || props.showLegend === true);

  if (round) {
    legend = slices.map((s) => ({ label: s.name, color: s.color }));
    showLegend = props.showLegend !== false;
    const cx0 = width / 2, cy0 = height / 2;
    const maxR = Math.max(10, Math.min(width, height) / 2 - 4);
    const outer = radiusOf(props.outerRadius, maxR, maxR * (labels ? 0.72 : 0.96));
    const inner = Math.min(outer - 1, radiusOf(props.innerRadius, maxR, type === "donut" ? outer * 0.6 : 0));
    const start = num(props.startAngle) ?? 90, end = num(props.endAngle) ?? -270;
    const sweep = end - start || -360;
    const pad = slices.length > 1 ? Math.max(0, Math.min(20, num(props.paddingAngle) ?? 0)) : 0;
    const corner = Math.max(0, Math.min(12, num(props.cornerRadius) ?? 0));
    let acc = 0;
    slices.forEach((s, i) => {
      const dir = Math.sign(sweep);
      const a0 = start + (sweep * acc) / total + (dir * pad) / 2;
      acc += s.value;
      const a1 = start + (sweep * acc) / total - (dir * pad) / 2;
      if ((a1 - a0) * dir <= 0) return;
      const text = `${s.name}: ${fmt.value(s.value)} (${Math.round((s.value / total) * 1000) / 10}%)`;
      // Rounded corners are approximated by a round-joined outline of the slice's own colour.
      marks.push(<path key={`s${i}`} className="ainui-chart-slice" d={slicePath(cx0, cy0, inner + corner / 2, outer - corner / 2, a0, a1)}
        style={{ fill: s.color, stroke: corner ? s.color : undefined, strokeWidth: corner || undefined, strokeLinejoin: corner ? "round" : undefined }}>{tip(text)}</path>);
      if (labels) {
        const mid = (a0 + a1) / 2;
        const [lx, ly] = polar(cx0, cy0, outer + 14, mid), [x0, y0] = polar(cx0, cy0, outer + 2, mid), [x1, y1] = polar(cx0, cy0, outer + 10, mid);
        const side = Math.cos((mid * Math.PI) / 180);
        if (props.showLabelLines !== false) marks.push(<line key={`l${i}`} className="ainui-chart-label-line" x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} />);
        marks.push(<text key={`t${i}`} className="ainui-chart-value" x={f(lx)} y={f(ly)} dominantBaseline="middle" textAnchor={Math.abs(side) < 0.2 ? "middle" : side > 0 ? "start" : "end"}>{fmt.value(s.value)}</text>);
      }
    });
  } else {
    const horizontal = props.layout === "horizontal" && type === "bar";
    const stacked = !!props.stacked && (type === "bar" || type === "area");
    const n = rows.length;
    const names = rows.map(cat);
    const numericX = type === "scatter" && rows.every((r) => val(r, xKey) !== undefined);
    const extents: number[] = [];
    rows.forEach((r) => {
      if (stacked) {
        let pos = 0, neg = 0;
        series.forEach((s) => { const v = val(r, s.key) ?? 0; if (v >= 0) pos += v; else neg += v; });
        extents.push(pos, neg);
      } else series.forEach((s) => { const v = val(r, s.key); if (v !== undefined) extents.push(v); });
    });
    const scale = axis(extents, yAxis.min, yAxis.max, type !== "scatter");
    const tickText = scale.ticks.map(fmt.tick);
    const axisLabel = str(yAxis.label);
    const longest = (texts: string[]) => texts.reduce((a, t) => Math.max(a, t.length), 0);
    const top = labels ? 18 : 8, right = 14;
    const left = horizontal ? Math.max(24, Math.min(width * 0.4, num(yAxis.width) ?? Math.min(160, longest(names.map((t) => clip(t, 22))) * 6.6 + 14)))
      : Math.max(24, Math.min(width * 0.4, (num(yAxis.width) ?? Math.min(96, longest(tickText) * 6.6 + 12)) + (axisLabel ? 16 : 0)));
    const bottom = 26 + (horizontal && axisLabel ? 16 : 0);
    const pw = Math.max(10, width - left - right), ph = Math.max(10, height - top - bottom);
    const vy = (v: number) => top + ph * (1 - scale.at(v));
    const vx = (v: number) => left + pw * scale.at(v);
    const base = Math.max(scale.from, Math.min(scale.to, 0));
    const xs = numericX ? axis(rows.map((r) => val(r, xKey) as number), undefined, undefined, false) : undefined;
    const band = (horizontal ? ph : pw) / n;
    const px0 = (i: number) => (xs ? left + pw * xs.at(val(rows[i], xKey) as number) : left + band * (i + 0.5));

    // Grid and value axis.
    scale.ticks.forEach((t, i) => {
      if (horizontal) {
        if (props.showGrid !== false) marks.push(<line key={`g${i}`} className="ainui-chart-grid" x1={f(vx(t))} x2={f(vx(t))} y1={top} y2={top + ph} />);
        marks.push(<text key={`a${i}`} className="ainui-chart-tick" x={f(vx(t))} y={top + ph + 16} textAnchor="middle">{tickText[i]}</text>);
      } else {
        if (props.showGrid !== false) marks.push(<line key={`g${i}`} className="ainui-chart-grid" x1={left} x2={left + pw} y1={f(vy(t))} y2={f(vy(t))} />);
        marks.push(<text key={`a${i}`} className="ainui-chart-tick" x={left - 6} y={f(vy(t))} textAnchor="end" dominantBaseline="middle">{tickText[i]}</text>);
      }
    });
    if (axisLabel) {
      marks.push(horizontal
        ? <text key="al" className="ainui-chart-axis-label" x={left + pw / 2} y={height - 4} textAnchor="middle">{axisLabel}</text>
        : <text key="al" className="ainui-chart-axis-label" transform={`translate(11 ${f(top + ph / 2)}) rotate(-90)`} textAnchor="middle">{axisLabel}</text>);
    }
    // Category axis.
    if (xs) {
      xs.ticks.forEach((t, i) => marks.push(<text key={`c${i}`} className="ainui-chart-tick" x={f(left + pw * xs.at(t))} y={top + ph + 16} textAnchor="middle">{fmt.tick(t)}</text>));
    } else if (horizontal) {
      const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(ph / 16))));
      names.forEach((name, i) => { if (i % every === 0) marks.push(<text key={`c${i}`} className="ainui-chart-tick" x={left - 6} y={f(top + band * (i + 0.5))} textAnchor="end" dominantBaseline="middle">{clip(name, Math.max(3, Math.floor((left - 10) / 6.6)))}</text>); });
    } else {
      const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 64))));
      names.forEach((name, i) => { if (i % every === 0) marks.push(<text key={`c${i}`} className="ainui-chart-tick" x={f(px0(i))} y={top + ph + 16} textAnchor="middle">{clip(name, Math.max(4, Math.floor((band * every) / 6.6)))}</text>); });
    }
    marks.push(horizontal
      ? <line key="base" className="ainui-chart-axis" x1={f(vx(base))} x2={f(vx(base))} y1={top} y2={top + ph} />
      : <line key="base" className="ainui-chart-axis" x1={left} x2={left + pw} y1={f(vy(base))} y2={f(vy(base))} />);

    const text = (s: Series, i: number, v: number) => `${names[i]} · ${s.label}: ${fmt.value(v)}`;
    if (type === "bar") {
      const group = band * 0.72;
      const each = stacked ? group : group / series.length;
      const r = Math.max(0, num(props.barRadius) ?? 2);
      rows.forEach((row, i) => {
        let pos = 0, neg = 0;
        series.forEach((s, j) => {
          const v = val(row, s.key);
          if (v === undefined) return;
          let from = base, to = v;
          if (stacked) { if (v >= 0) { from = pos; pos += v; to = pos; } else { from = neg; neg += v; to = neg; } }
          const offset = band * i + (band - group) / 2 + (stacked ? 0 : each * j);
          const a = horizontal ? vx(from) : vy(from), b = horizontal ? vx(to) : vy(to);
          const lo = Math.min(a, b), size = Math.max(Math.abs(a - b), v === 0 ? 0 : 1);
          const gap = stacked ? 0 : Math.min(1, each * 0.1);
          const rect = horizontal ? { x: lo, y: top + offset + gap, width: size, height: Math.max(1, each - gap * 2) } : { x: left + offset + gap, y: lo, width: Math.max(1, each - gap * 2), height: size };
          marks.push(<rect key={`b${i}:${j}`} className="ainui-chart-bar" x={f(rect.x)} y={f(rect.y)} width={f(rect.width)} height={f(rect.height)}
            rx={Math.min(r, rect.width / 2, rect.height / 2)} style={{ fill: s.color }}>{tip(text(s, i, v))}</rect>);
          if (labels) {
            marks.push(horizontal
              ? <text key={`v${i}:${j}`} className="ainui-chart-value" x={f(v >= 0 ? rect.x + rect.width + 4 : rect.x - 4)} y={f(rect.y + rect.height / 2)} textAnchor={v >= 0 ? "start" : "end"} dominantBaseline="middle">{fmt.tick(v)}</text>
              : <text key={`v${i}:${j}`} className="ainui-chart-value" x={f(rect.x + rect.width / 2)} y={f(v >= 0 ? rect.y - 4 : rect.y + rect.height + 12)} textAnchor="middle">{fmt.tick(v)}</text>);
          }
        });
      });
    } else {
      const floor = rows.map(() => 0);
      series.forEach((s, j) => {
        const points: Array<{ i: number; x: number; y: number; y0: number; v: number }> = [];
        rows.forEach((row, i) => {
          const v = val(row, s.key);
          if (v === undefined) return;
          const from = stacked ? floor[i] : base, to = stacked ? floor[i] + v : v;
          if (stacked) floor[i] = to;
          points.push({ i, x: px0(i), y: vy(to), y0: vy(from), v });
        });
        if (!points.length) return;
        const line = points.map((p, k) => `${k ? "L" : "M"}${f(p.x)},${f(p.y)}`).join("");
        if (type === "area") {
          const back = [...points].reverse().map((p) => `L${f(p.x)},${f(p.y0)}`).join("");
          marks.push(<path key={`f${j}`} className="ainui-chart-area" d={`${line}${back}Z`} style={{ fill: s.color }} />);
        }
        if (type !== "scatter") marks.push(<path key={`p${j}`} className="ainui-chart-line" d={line} style={{ stroke: s.color }} />);
        const dots = type === "scatter" || (props.showDots ?? (type === "line" && points.length <= 40)) || points.length === 1;
        points.forEach((p) => {
          // Without dots, an invisible target still carries the tooltip.
          marks.push(<circle key={`d${j}:${p.i}`} className={cx("ainui-chart-dot", !dots && "ainui-chart-dot-hidden")} cx={f(p.x)} cy={f(p.y)} r={type === "scatter" ? 4 : dots ? 3 : 6}
            style={dots ? { fill: s.color } : undefined}>{tip(text(s, p.i, p.v))}</circle>);
          if (labels) marks.push(<text key={`v${j}:${p.i}`} className="ainui-chart-value" x={f(p.x)} y={f(p.y - 8)} textAnchor="middle">{fmt.tick(p.v)}</text>);
        });
      });
    }
  }

  const shownSeries = round ? [series[0]] : series;
  const summary = `${title ? `${title}. ` : ""}${type[0].toUpperCase()}${type.slice(1)} chart of ${shownSeries.map((s) => s.label).join(", ")}${xKey ? ` by ${xKey}` : ""}, ${rows.length} ${rows.length === 1 ? "point" : "points"}.`;
  return <figure className={cx("ainui-chart", `ainui-chart-${type}`)} ref={ref as never}>
    {title && <figcaption className="ainui-chart-title">{title}</figcaption>}
    <svg className="ainui-chart-svg" role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">{marks}</svg>
    {showLegend && <ul className="ainui-chart-legend" aria-hidden="true">
      {legend.map((l, i) => <li key={i}><span className="ainui-chart-swatch" style={{ background: l.color }} />{l.label}</li>)}
    </ul>}
    <table className="ainui-chart-table">
      <caption>{title || "Chart data"}</caption>
      <thead><tr><th scope="col">{xKey || "Item"}</th>{shownSeries.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><th scope="row">{cat(r, i)}</th>{shownSeries.map((s) => { const v = val(r, s.key); return <td key={s.key}>{v === undefined ? "" : fmt.value(v)}</td>; })}</tr>)}</tbody>
    </table>
  </figure>;
});

/* ---------- Map ---------- */

const TILE = 256;
const DEFAULT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAX_ZOOM = 19;
type Place = { label: string; lat: number; lng: number; description: string; category: string; icon: string };

const coordinate = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
/** Web Mercator: world pixel position at a zoom level. */
function project(lat: number, lng: number, zoom: number): [number, number] {
  const size = TILE * 2 ** zoom;
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * size, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size];
}
function unproject(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const size = TILE * 2 ** zoom;
  return { lng: (x / size) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / size))) * 180) / Math.PI };
}

const MapView = standard("Map", ({ props }) => {
  const host = useHost();
  const [ref, width] = useWidth(640);
  const [local, setLocal] = useState<string | undefined>(undefined);
  const [nudge, setNudge] = useState(0);
  const height = Math.max(120, num(props.height) ?? 240);
  const places: Place[] = list(props.markers).map((m) => obj(m)).map((m) => ({
    label: str(m.label), lat: coordinate(m.lat), lng: coordinate(m.lng), description: str(m.description), category: str(m.category), icon: str(m.icon),
  })).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180);
  const selected = typeof props.selected === "string" ? props.selected : local;
  const select = (label: string) => { setLocal(label); props.setSelected?.(label); };
  const given = obj(props.center);
  const hasCenter = Number.isFinite(coordinate(given.lat)) && Number.isFinite(coordinate(given.lng));

  const names = <ol className="ainui-map-places">
    {places.map((p, i) => <li key={i}>
      <button type="button" className={cx("ainui-map-place", selected === p.label && "ainui-map-place-selected")} aria-pressed={selected === p.label} onClick={() => select(p.label)}>
        <span className="ainui-map-place-index" aria-hidden="true">{p.icon ? <IconGlyph name={p.icon} size={12} /> : i + 1}</span>
        <span className="ainui-map-place-text">
          <span className="ainui-map-place-label">{p.label || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}</span>
          {(p.description || p.category) && <span className="ainui-map-place-description">{p.description || p.category}</span>}
        </span>
      </button>
    </li>)}
  </ol>;
  if (!places.length && !hasCenter) return <div className="ainui-map" ref={ref}><p className="ainui-map-empty">No places</p></div>;

  // Fit: the highest zoom at which every marker is inside the frame, with room for the pins.
  let fit = 14;
  if (places.length > 1) {
    for (fit = 18; fit > 0; fit--) {
      const pts = places.map((p) => project(p.lat, p.lng, fit));
      const dx = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])), dy = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
      if (dx <= Math.max(32, width - 72) && dy <= Math.max(32, height - 72)) break;
    }
  }
  const asked = num(props.zoom);
  const zoom = Math.max(0, Math.min(MAX_ZOOM, Math.round(asked === undefined ? fit : places.length > 1 ? Math.min(fit, asked) : asked) + nudge));
  let center: [number, number];
  if (hasCenter) center = project(coordinate(given.lat), coordinate(given.lng), zoom);
  else {
    const pts = places.map((p) => project(p.lat, p.lng, zoom));
    center = [(Math.max(...pts.map((p) => p[0])) + Math.min(...pts.map((p) => p[0]))) / 2, (Math.max(...pts.map((p) => p[1])) + Math.min(...pts.map((p) => p[1]))) / 2];
  }
  const left = center[0] - width / 2, top = center[1] - height / 2;
  const world = 2 ** zoom;
  const template = typeof (host as any)?.mapTileUrl === "string" && (host as any).mapTileUrl ? ((host as any).mapTileUrl as string) : DEFAULT_TILES;
  const tiles: Array<{ key: string; src: string; x: number; y: number }> = [];
  for (let ty = Math.max(0, Math.floor(top / TILE)); ty <= Math.min(world - 1, Math.floor((top + height) / TILE)); ty++) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE) && tiles.length < 200; tx++) {
      const wrapped = ((tx % world) + world) % world;
      const src = safeUrl(template.replace(/\{s\}/g, "a").replace(/\{z\}/g, String(zoom)).replace(/\{x\}/g, String(wrapped)).replace(/\{y\}/g, String(ty)).replace(/\{r\}/g, ""));
      if (src) tiles.push({ key: `${zoom}/${tx}/${ty}`, src, x: tx * TILE - left, y: ty * TILE - top });
    }
  }
  const pins = places.map((p) => { const [x, y] = project(p.lat, p.lng, zoom); return { ...p, x: x - left, y: y - top }; });
  const middle = unproject(center[0], center[1], zoom);
  return <div className="ainui-map" ref={ref}>
    <div className="ainui-map-view" role="group" aria-label={`Map of ${places.length} ${places.length === 1 ? "place" : "places"}`} style={{ height }}
      data-zoom={zoom} data-center={`${middle.lat.toFixed(5)},${middle.lng.toFixed(5)}`}>
      <div className="ainui-map-tiles" aria-hidden="true">
        {tiles.map((t) => <img key={t.key} src={t.src} alt="" width={TILE} height={TILE} loading="lazy" draggable={false} referrerPolicy="strict-origin-when-cross-origin"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ left: Math.round(t.x), top: Math.round(t.y) }} />)}
      </div>
      {props.route && pins.length > 1 && <svg className="ainui-map-route" aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline points={pins.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")} />
      </svg>}
      {pins.map((p, i) => <button key={i} type="button" className={cx("ainui-map-marker", selected === p.label && "ainui-map-marker-selected")} title={p.label} aria-label={p.label || `Place ${i + 1}`}
        aria-pressed={selected === p.label} onClick={() => select(p.label)} style={{ left: f(p.x), top: f(p.y), ...(color(p.category) && /^(info|success|warning|caution|danger|discovery|secondary)$/.test(p.category) ? { background: color(p.category) } : {}) }}>
        {p.icon ? <IconGlyph name={p.icon} size={12} /> : i + 1}
      </button>)}
      <div className="ainui-map-zoom">
        <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setNudge((n) => n + 1)}>+</button>
        <button type="button" aria-label="Zoom out" disabled={zoom <= 0} onClick={() => setNudge((n) => n - 1)}>−</button>
      </div>
      <span className="ainui-map-attribution">© OpenStreetMap contributors</span>
    </div>
    {places.length ? names : <p className="ainui-map-empty">No places</p>}
  </div>;
});

export const data = [Table, TableSection, TableRow, TableCell, List, ListItem, Chart, MapView];
