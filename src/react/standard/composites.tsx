"use client";

/** Standard catalog — composites: link previews, citations, follow-up prompts, entity cards, image galleries. */
import React, { useEffect, useId, useRef, useState } from "react";
import { cx, fire, mediaUrl, openUrl, px, safeUrl, space, standard, useHost } from "../core.js";
import { Lightbox, SiteIcon, siteHost } from "./media.js";

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const list = <T = any,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});

/** An image that removes itself when it does not load. */
function Thumb({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState("");
  return src && failed !== src ? <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(src)} /> : null;
}

const LinkCard = standard("LinkCard", ({ props }) => {
  const host = useHost();
  const href = safeUrl(props.href);
  const title = str(props.title), description = str(props.description);
  const domain = str(props.domain) || siteHost(href);
  const image = mediaUrl(props.image, host);
  const body = <>
    <span className="ainui-link-card-body">
      {(domain || (props.favicon !== false && href)) && <span className="ainui-link-card-source">
        {props.favicon !== false && <SiteIcon url={href || domain} size={16} />}{domain && <span className="ainui-link-card-domain">{domain}</span>}
      </span>}
      <span className="ainui-link-card-title">{title || domain || href}</span>
      {description && <span className="ainui-link-card-description">{description}</span>}
    </span>
    <Thumb className="ainui-link-card-image" src={image} />
  </>;
  if (props.onClick || !href) {
    return <button type="button" className="ainui-link-card" disabled={!props.onClick} onClick={() => void props.onClick?.()}>{body}</button>;
  }
  return <a className="ainui-link-card" href={href} target="_blank" rel="noopener noreferrer"
    onClick={host.openUrl ? (e) => { e.preventDefault(); openUrl(host, href); } : undefined}>{body}</a>;
});

const Citation = standard("Citation", ({ props }) => {
  const host = useHost();
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const url = safeUrl(props.url);
  const marker = str(props.label) || String(num(props.index) ?? 1);
  const title = str(props.title), snippet = str(props.snippet), source = str(props.source) || siteHost(url);
  useEffect(() => {
    if (!pinned) return;
    const away = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setPinned(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [pinned]);
  const leave = (e: React.FocusEvent) => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) { setHover(false); setPinned(false); } };
  return <span ref={wrap} className="ainui-citation" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={leave}
    onKeyDown={(e) => { if (e.key === "Escape") { setHover(false); setPinned(false); } }}>
    <button type="button" className="ainui-citation-marker" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-label={`Source ${marker}${title ? `: ${title}` : ""}`} onClick={() => setPinned((v) => !v)}>[{marker}]</button>
    {open && <span id={id} role="note" className="ainui-citation-popover">
      {source && <span className="ainui-citation-source"><SiteIcon url={url || source} size={14} />{source}</span>}
      {title && <span className="ainui-citation-title">{title}</span>}
      {snippet && <span className="ainui-citation-snippet">{snippet}</span>}
      {url && <a className="ainui-citation-link" href={url} target="_blank" rel="noopener noreferrer"
        onClick={host.openUrl ? (e) => { e.preventDefault(); openUrl(host, url); } : undefined}>Open source</a>}
    </span>}
  </span>;
});

const FollowUp = standard("FollowUp", ({ props, context }) => {
  const host = useHost();
  const items = list(props.items).map((it) => (typeof it === "string" ? { label: it, message: it } : { label: str(obj(it).label), message: str(obj(it).message) || str(obj(it).label) }))
    .filter((it) => it.label);
  const title = str(props.title);
  const id = useId();
  if (!items.length) return null;
  const send = (message: string) => { host.sendMessage?.(message); if (props.onFollowUp) void fire(context, "onFollowUp", { message }); };
  return <div className="ainui-follow-up" role="group" aria-labelledby={title ? id : undefined} aria-label={title ? undefined : "Suggested follow-ups"}>
    {title && <span id={id} className="ainui-follow-up-title">{title}</span>}
    <span className="ainui-follow-up-items">
      {items.map((it, i) => <button key={i} type="button" className="ainui-follow-up-item" onClick={() => send(it.message)}>{it.label}</button>)}
    </span>
  </div>;
});

const BADGE_TONES = ["secondary", "success", "danger", "warning", "info", "discovery"];
const BUTTON_VARIANTS = ["solid", "soft", "outline", "ghost"];

function Stars({ rating, count }: { rating: number; count?: number }) {
  const value = Math.max(0, Math.min(5, rating));
  const shown = Math.round(value * 10) / 10;
  return <span className="ainui-entity-card-rating" role="img" aria-label={`Rated ${shown} out of 5${count !== undefined ? `, ${count.toLocaleString()} ${count === 1 ? "rating" : "ratings"}` : ""}`}>
    <span className="ainui-entity-card-stars" aria-hidden="true">★★★★★<span className="ainui-entity-card-stars-on" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span></span>
    <span className="ainui-entity-card-rating-value" aria-hidden="true">{shown}</span>
    {count !== undefined && <span className="ainui-entity-card-rating-count" aria-hidden="true">({count.toLocaleString()})</span>}
  </span>;
}

const EntityCard = standard("EntityCard", ({ props, context }) => {
  const host = useHost();
  const href = safeUrl(props.href);
  const title = str(props.title);
  const image = mediaUrl(props.image, host);
  const badge = obj(props.badge);
  const rating = num(props.rating);
  const count = num(props.ratingCount);
  const actions = list(props.actions).map((a) => obj(a)).filter((a) => str(a.label)).slice(0, 3);
  const horizontal = props.layout === "horizontal";
  const clickable = !!href || !!props.onClick;
  // The title carries the card's link; its hit area is stretched over the card in CSS, under the buttons.
  const heading = href
    ? <a className="ainui-entity-card-title ainui-entity-card-hit" href={href} target="_blank" rel="noopener noreferrer" onClick={host.openUrl ? (e) => { e.preventDefault(); openUrl(host, href); } : undefined}>{title}</a>
    : props.onClick ? <button type="button" className="ainui-entity-card-title ainui-entity-card-hit" onClick={() => void props.onClick()}>{title}</button>
      : <span className="ainui-entity-card-title">{title}</span>;
  return <article className={cx("ainui-entity-card", `ainui-entity-card-${horizontal ? "horizontal" : "vertical"}`, clickable && "ainui-entity-card-clickable")} style={{ width: px(props.width) }}>
    {image && <span className="ainui-entity-card-media" style={{ aspectRatio: str(props.imageAspectRatio) || "4 / 3" }}><Thumb src={image} /></span>}
    <div className="ainui-entity-card-body">
      {str(badge.label) && <span className={cx("ainui-entity-card-badge", `ainui-entity-card-badge-${BADGE_TONES.includes(badge.color) ? badge.color : "secondary"}`)}>{str(badge.label)}</span>}
      {heading}
      {str(props.subtitle) && <span className="ainui-entity-card-subtitle">{str(props.subtitle)}</span>}
      {rating !== undefined && <Stars rating={rating} count={count} />}
      {str(props.description) && <p className="ainui-entity-card-description">{str(props.description)}</p>}
      {str(props.meta) && <span className="ainui-entity-card-meta">{str(props.meta)}</span>}
      {actions.length > 0 && <div className="ainui-entity-card-actions">
        {actions.map((a, i) => {
          const label = str(a.label), link = safeUrl(a.href);
          const className = cx("ainui-entity-card-action", `ainui-entity-card-action-${BUTTON_VARIANTS.includes(a.variant) ? a.variant : i === 0 ? "solid" : "outline"}`);
          return link
            ? <a key={i} className={className} href={link} target="_blank" rel="noopener noreferrer" onClick={host.openUrl ? (e) => { e.preventDefault(); openUrl(host, link); } : undefined}>{label}</a>
            : <button key={i} type="button" className={className} onClick={() => void fire(context, "onAction", { action: str(a.id) || label, label })}>{label}</button>;
        })}
      </div>}
    </div>
  </article>;
});

const ImageGrid = standard("ImageGrid", ({ props }) => {
  const host = useHost();
  const [open, setOpen] = useState<number | null>(null);
  const images = list(props.images).map((im) => (typeof im === "string" ? { url: im } : obj(im)))
    .map((im) => ({ src: mediaUrl(im.url, host), alt: str(im.description), caption: str(im.caption), href: safeUrl(im.href) })).filter((im) => im.src);
  if (!images.length) return null;
  const columns = Math.max(1, Math.min(12, Math.floor(num(props.columns) ?? 3)));
  const bento = props.layout === "bento";
  const ratio = str(props.aspectRatio) || "1 / 1";
  return <div className={cx("ainui-image-grid", bento && "ainui-image-grid-bento")} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: space(props.gap) ?? "8px" }}>
    {images.map((im, i) => <figure key={i} className="ainui-image-grid-item" style={bento && i === 0 && columns > 1 ? { gridColumn: "span 2", gridRow: "span 2" } : undefined}>
      <button type="button" className="ainui-image-grid-open" aria-label={im.alt ? `Open image: ${im.alt}` : `Open image ${i + 1}`} onClick={() => setOpen(i)}
        style={{ aspectRatio: bento && i === 0 && columns > 1 ? undefined : ratio }}>
        <img src={im.src} alt={im.alt} loading="lazy" />
      </button>
      {(im.caption || im.href) && <figcaption className="ainui-image-grid-caption">
        {im.href ? <a href={im.href} target="_blank" rel="noopener noreferrer" onClick={host.openUrl ? (e) => { e.preventDefault(); openUrl(host, im.href); } : undefined}>{im.caption || siteHost(im.href) || "Open"}</a> : im.caption}
      </figcaption>}
    </figure>)}
    {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
  </div>;
});

export const composites = [LinkCard, Citation, FollowUp, EntityCard, ImageGrid];
