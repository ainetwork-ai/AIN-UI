"use client";

/** Standard catalog — layout: containers, grids, carousels, tabs. */
import React, { useEffect, useRef, useState } from "react";
import { Kids, boxStyle, color, cx, kid, mediaUrl, openUrl, px, space, standard, useHost, type ViewProps } from "../core.js";

/** Calls `fn` once, the first time the element scrolls into view. */
export function useOnVisible(fn: (() => unknown) | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!fn || !el || done.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !done.current) { done.current = true; io.disconnect(); void fn(); }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [fn]);
  return ref;
}

const flex = (direction: "column" | "row", className: string) => ({ props, buildChild }: ViewProps) => {
  const ref = useOnVisible(props.onVisible);
  const dir = className === "ainui-box" && props.direction === "row" ? "row" : direction;
  return <div ref={ref} role={props.role} className={cx(className, props.flush && "ainui-flush")}
    style={{ display: "flex", flexDirection: dir, ...(dir === "row" ? { alignItems: "center" } : {}), gap: props.disableAutoSpacing ? 0 : undefined, ...boxStyle(props) }}>
    <Kids of={props.children} buildChild={buildChild} />
  </div>;
};

const Box = standard("Box", flex("column", "ainui-box"));
const Column = standard("Column", flex("column", "ainui-column"));
const Row = standard("Row", flex("row", "ainui-row"));

const Grid = standard("Grid", ({ props, buildChild }) => {
  const ref = useOnVisible(props.onVisible);
  // `minItemWidth` is AINUI v1's name for `minChildWidth`.
  const min = props.minChildWidth ?? props.minItemWidth;
  const columns = typeof props.columns === "number" ? `repeat(${props.columns}, minmax(0, 1fr))`
    : typeof props.columns === "string" && props.columns ? props.columns
      : `repeat(auto-fill, minmax(min(100%, ${px(min) ?? "176px"}), 1fr))`;
  const rows = typeof props.rows === "number" ? `repeat(${props.rows}, minmax(0, auto))` : props.rows || undefined;
  return <div ref={ref} className="ainui-grid" style={{ display: "grid", gridTemplateColumns: columns, gridTemplateRows: rows, ...boxStyle(props) }}>
    <Kids of={props.children} buildChild={buildChild} />
  </div>;
});

const spanStyle = (p: Record<string, any>): React.CSSProperties => ({
  ...(p.span ? { gridColumn: `span ${p.span} / span ${p.span}` } : {}), ...(p.rowSpan ? { gridRow: `span ${p.rowSpan} / span ${p.rowSpan}` } : {}),
});
const GridItem = standard("GridItem", ({ props, buildChild }) =>
  <div className="ainui-grid-item" style={{ display: "flex", flexDirection: "column", minWidth: 0, ...spanStyle(props), ...boxStyle(props) }}><Kids of={props.children} buildChild={buildChild} /></div>);

const Card = standard("Card", ({ props, buildChild }) => {
  const ref = useOnVisible(props.onVisible);
  return <div ref={ref} className={cx("ainui-card", `ainui-card-${props.variant ?? "default"}`, props.size && `ainui-card-${props.size}`, props.shadowStyle && props.shadowStyle !== "none" && `ainui-shadow-${props.shadowStyle}`)} style={boxStyle(props)}>
    {kid(buildChild, props.child)}<Kids of={props.children} buildChild={buildChild} />
  </div>;
});

/** A dense, magazine-like grid: `pack` fills holes, `fixed` keeps source order. */
const Flow = standard("Flow", ({ props, buildChild }) =>
  <div className="ainui-flow" style={{ display: "grid", gridTemplateColumns: `repeat(${props.columns ?? 3}, minmax(0, 1fr))`,
    ...(props.rows ? { gridTemplateRows: `repeat(${props.rows}, minmax(0, 1fr))` } : {}), gridAutoFlow: props.layout === "fixed" ? "row" : "row dense", ...boxStyle(props) }}>
    <Kids of={props.children} buildChild={buildChild} />
  </div>);
const FlowItem = standard("FlowItem", ({ props, buildChild }) =>
  <div className="ainui-flow-item" style={{ display: "flex", flexDirection: "column", minWidth: 0, ...spanStyle(props), ...boxStyle(props) }}><Kids of={props.children} buildChild={buildChild} /></div>);

const Carousel = standard("Carousel", ({ props, buildChild }) => {
  const track = useRef<HTMLDivElement>(null);
  const count = Array.isArray(props.children) ? props.children.length : 0;
  const go = (index: number) => {
    const el = track.current;
    const target = el?.children[Math.max(0, Math.min(count - 1, index))] as HTMLElement | undefined;
    if (el && target) el.scrollTo?.({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
    props.setActiveIndex?.(Math.max(0, Math.min(count - 1, index)));
  };
  // An index set by the agent (or a binding) scrolls the slide into view.
  useEffect(() => {
    const el = track.current, target = el?.children[props.activeIndex ?? -1] as HTMLElement | undefined;
    if (el && target) el.scrollTo?.({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, [props.activeIndex]);
  const active = typeof props.activeIndex === "number" ? props.activeIndex : 0;
  const visible = typeof props.visibleItems === "number" && props.visibleItems > 0 ? props.visibleItems : undefined;
  return <div className="ainui-carousel" role="group" aria-roledescription="carousel" aria-label={props.label} style={boxStyle({ ...props, gap: undefined })}>
    {props.showArrows !== false && count > 1 && <button type="button" className="ainui-carousel-arrow ainui-carousel-prev" aria-label={props.previousLabel ?? "Previous"} disabled={active <= 0} onClick={() => go(active - 1)}>‹</button>}
    <div ref={track} className="ainui-carousel-track" style={{ gap: space(props.gap) ?? "12px", scrollSnapType: props.snap === "none" ? "none" : `x ${props.snap ?? "mandatory"}`,
      ["--ainui-carousel-align" as string]: props.snapAlign ?? "start", ...(visible ? { ["--ainui-carousel-item" as string]: `calc((100% - ${(visible - 1) * 12}px) / ${visible})` } : {}) }}>
      <Kids of={props.children} buildChild={buildChild} />
    </div>
    {props.showArrows !== false && count > 1 && <button type="button" className="ainui-carousel-arrow ainui-carousel-next" aria-label={props.nextLabel ?? "Next"} disabled={active >= count - 1} onClick={() => go(active + 1)}>›</button>}
  </div>;
});
const CarouselItem = standard("CarouselItem", ({ props, buildChild }) =>
  <div className="ainui-carousel-item" style={{ display: "flex", flexDirection: "column", ...boxStyle(props) }}><Kids of={props.children} buildChild={buildChild} /></div>);

const MEDIA_WIDTH: Record<string, number> = { sm: 160, md: 240, lg: 320 };
const CarouselMediaItem = standard("CarouselMediaItem", ({ props, buildChild }) => {
  const host = useHost();
  const [zoom, setZoom] = useState(false);
  const src = mediaUrl(props.url, host);
  const click = () => (props.onClick ? void props.onClick() : props.href ? openUrl(host, props.href) : props.lightbox !== false ? setZoom(true) : undefined);
  return <figure className="ainui-carousel-item ainui-carousel-media" style={{ width: MEDIA_WIDTH[props.size ?? "md"], ...boxStyle(props) }}>
    <button type="button" className="ainui-media-button" onClick={click} aria-label={props.description ?? "Open image"}>
      {src && <img src={src} alt={props.description ?? ""} loading="lazy" />}
    </button>
    <figcaption><Kids of={props.children} buildChild={buildChild} /></figcaption>
    {zoom && <div className="ainui-lightbox" role="dialog" aria-modal="true" aria-label={props.description ?? "Image"} onClick={() => setZoom(false)}>
      <img src={src} alt={props.description ?? ""} /><button type="button" className="ainui-lightbox-close" aria-label="Close">×</button>
    </div>}
  </figure>;
});

const Spacer = standard("Spacer", ({ props }) => <div className="ainui-spacer" aria-hidden="true" style={{ flex: "1 1 0%", minWidth: px(props.minSize), minHeight: px(props.minSize) }} />);

const Divider = standard("Divider", ({ props }) => {
  const vertical = props.axis === "vertical";
  const line = `${props.size ?? 1}px solid ${props.color && props.color !== "default" ? color(props.color) : "var(--ainui-border)"}`;
  return <div role="separator" aria-orientation={vertical ? "vertical" : "horizontal"} className={cx("ainui-divider", props.flush && "ainui-flush")}
    style={vertical ? { alignSelf: "stretch", borderLeft: line, marginInline: space(props.spacing) } : { width: "100%", borderTop: line, marginBlock: space(props.spacing) }} />;
});

const Tabs = standard("Tabs", ({ props, buildChild }) => {
  const tabs: Array<{ title: string; child: string }> = Array.isArray(props.tabs) ? props.tabs : [];
  const [local, setLocal] = useState(0);
  const selected = Math.min(tabs.length - 1, Math.max(0, typeof props.selectedIndex === "number" ? props.selectedIndex : local));
  const choose = (i: number) => { setLocal(i); props.setSelectedIndex?.(i); };
  return <div className="ainui-tabs" style={typeof props.weight === "number" ? { flex: `${props.weight} 1 0%`, minWidth: 0 } : undefined}>
    <div role="tablist" className="ainui-tablist" onKeyDown={(e) => {
      if (e.key === "ArrowRight") choose((selected + 1) % tabs.length); else if (e.key === "ArrowLeft") choose((selected - 1 + tabs.length) % tabs.length);
    }}>
      {tabs.map((t, i) => <button key={i} type="button" role="tab" aria-selected={i === selected} tabIndex={i === selected ? 0 : -1} className="ainui-tab" onClick={() => choose(i)}>{t.title}</button>)}
    </div>
    <div role="tabpanel" className="ainui-tabpanel">{tabs[selected] ? kid(buildChild, tabs[selected].child) : null}</div>
  </div>;
});

export const layout = [Box, Column, Row, Grid, GridItem, Card, Flow, FlowItem, Carousel, CarouselItem, CarouselMediaItem, Spacer, Divider, Tabs];
