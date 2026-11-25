"use client";

/** Standard catalog — media: images, icons, vector drawings, video, audio, sandboxed HTML. */
import React, { useEffect, useState } from "react";
import { color, cx, mediaUrl, px, radius, safeUrl, standard, surfaceColor, useHost } from "../core.js";

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const list = <T = any,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});

/* ---------- Icon ---------- */

type IconNode = Array<[string, Record<string, string | number>]>;
type IconSet = Record<string, IconNode>;

const A2UI_ICONS: Record<string, string> = {
  arrowBack: "arrow-left", arrowForward: "arrow-right", check: "check", close: "x", delete: "trash-2", edit: "pencil", search: "search", add: "plus",
  menu: "menu", home: "home", settings: "settings", info: "info", warning: "triangle-alert", error: "circle-alert", favorite: "heart",
  favoriteOff: "heart-off", star: "star", starHalf: "star-half", starOff: "star-off", share: "share-2", download: "download", upload: "upload", send: "send", person: "user",
  calendarToday: "calendar", event: "calendar", locationOn: "map-pin", phone: "phone", call: "phone", mail: "mail", lock: "lock", lockOpen: "lock-open",
  visibility: "eye", visibilityOff: "eye-off", moreVert: "ellipsis-vertical", moreHoriz: "ellipsis", refresh: "refresh-cw", attachFile: "paperclip",
  folder: "folder", payment: "credit-card", shoppingCart: "shopping-cart", help: "circle-help", notifications: "bell", notificationsOff: "bell-off",
  camera: "camera", photo: "image", image: "image", accountCircle: "circle-user", print: "printer", play: "play", pause: "pause", stop: "square",
};
const SHAPES = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);

let lucide: Promise<IconSet> | undefined;
let loaded: IconSet | undefined;
const loadIcons = (): Promise<IconSet> => (lucide ??= import("lucide").then((m) => (loaded = ((m as any).icons ?? {}) as IconSet), () => (loaded = {})));

const pascal = (name: string) => name.split(/[-_\s]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
function findIcon(icons: IconSet, name: string): IconNode | undefined {
  const mapped = A2UI_ICONS[name] ?? name;
  const found = icons[pascal(mapped)] ?? icons[pascal(mapped.replace(/([a-z])([A-Z0-9])/g, "$1-$2"))];
  return Array.isArray(found) ? found : undefined;
}

const ICON_SIZE: Record<string, number> = { sm: 14, md: 18, lg: 24, xl: 32 };
const STROKE: Record<string, number> = { normal: 2, medium: 2.25, semibold: 2.5, bold: 3 };

/** A Lucide icon (kebab-case or A2UI name) or `{svgPath}`; an empty svg of the same size until the icon data loads. */
export function IconGlyph({ name, size = 18, label, strokeWidth = 2, className, style }: {
  name: unknown; size?: number | string; label?: string; strokeWidth?: number; className?: string; style?: React.CSSProperties;
}) {
  const [icons, setIcons] = useState<IconSet | undefined>(loaded);
  const wanted = typeof name === "string" ? name.trim() : "";
  useEffect(() => {
    if (!wanted || icons) return;
    let alive = true;
    void loadIcons().then((set) => { if (alive) setIcons(set); });
    return () => { alive = false; };
  }, [wanted, icons]);
  const path = typeof obj(name).svgPath === "string" ? (obj(name).svgPath as string) : "";
  const node = !path && wanted && icons ? findIcon(icons, wanted) : undefined;
  return <svg className={cx("ainui-icon", className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" style={style} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
    {path ? <path d={path} /> : node?.map(([tag, attrs], i) => (SHAPES.has(tag) ? React.createElement(tag, { key: i, ...attrs }) : null))}
  </svg>;
}

const Icon = standard("Icon", ({ props }) =>
  <IconGlyph name={props.name} label={str(props.label) || undefined} size={num(props.size) ?? ICON_SIZE[props.size] ?? ICON_SIZE.md}
    strokeWidth={STROKE[props.strokeWeight] ?? 2} className={cx(props.inline && "ainui-icon-inline")}
    style={{ color: props.color === "default" || props.color === "prose" ? undefined : color(props.color), flex: "none" }} />);

/* ---------- Lightbox ---------- */

export type LightboxImage = { src: string; alt?: string; caption?: string };

/** A full-screen view of one image of a set. A click or Escape closes it; arrows move within the set. */
export function Lightbox({ images, index, onIndex, onClose }: { images: LightboxImage[]; index: number; onIndex?: (i: number) => void; onClose: () => void }) {
  const count = images.length;
  const at = Math.max(0, Math.min(count - 1, index));
  const move = (by: number) => { if (count > 1) onIndex?.((at + by + count) % count); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") move(1); else if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const image = images[at];
  if (!image) return null;
  const nav = (by: number, label: string, glyph: string) => <button type="button" className={cx("ainui-lightbox-close", "ainui-lightbox-nav", by < 0 ? "ainui-lightbox-prev" : "ainui-lightbox-next")}
    aria-label={label} onClick={(e) => { e.stopPropagation(); move(by); }}>{glyph}</button>;
  return <span className="ainui-lightbox" role="dialog" aria-modal="true" aria-label={image.alt || image.caption || "Image"} onClick={onClose}>
    <img src={image.src} alt={image.alt ?? ""} />
    {image.caption && <span className="ainui-lightbox-caption">{image.caption}</span>}
    {count > 1 && onIndex && nav(-1, "Previous image", "‹")}
    {count > 1 && onIndex && nav(1, "Next image", "›")}
    <button type="button" className="ainui-lightbox-close" aria-label="Close" autoFocus onClick={onClose}>×</button>
  </span>;
}

/* ---------- Image ---------- */

const FIT: Record<string, React.CSSProperties["objectFit"]> = { cover: "cover", contain: "contain", fill: "fill", none: "none", scaleDown: "scale-down" };
const VARIANTS = ["icon", "avatar", "smallFeature", "mediumFeature", "largeFeature", "header"];

const Image = standard("Image", ({ props }) => {
  const host = useHost();
  const src = mediaUrl(props.url, host);
  const [failed, setFailed] = useState("");
  const [zoom, setZoom] = useState(false);
  const alt = str(props.description);
  const variant = VARIANTS.includes(props.variant) ? (props.variant as string) : "mediumFeature";
  const small = variant === "icon" || variant === "avatar";
  const frame: React.CSSProperties = {
    width: px(props.width), height: px(props.height), maxWidth: px(props.maxWidth), maxHeight: px(props.maxHeight), minWidth: px(props.minWidth), minHeight: px(props.minHeight),
    aspectRatio: str(props.aspectRatio) || undefined, borderRadius: radius(props.radius), background: surfaceColor(props.background),
  };
  const className = cx("ainui-image", `ainui-image-${variant.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, props.frame && "ainui-image-frame", props.hoverZoom && "ainui-image-hover-zoom");
  if (!src || failed === src) {
    if (props.hideOnFailure) return null;
    const text = str(props.fallback) || alt;
    return <span className={cx(className, "ainui-image-failed")} style={frame} role={text ? "img" : undefined} aria-label={text || undefined} aria-hidden={text ? undefined : true}>{text}</span>;
  }
  const img = <img src={src} alt={alt} loading="lazy" onError={() => setFailed(src)}
    style={{ objectFit: FIT[props.fit] ?? "cover", objectPosition: str(props.position) || undefined }} />;
  // The catalog's default opens every image; an icon or avatar only does when asked to.
  const lightbox = props.lightbox === true || (props.lightbox !== false && !small);
  const overlay = obj(props.actionOverlay);
  const overlayLabel = str(overlay.label);
  const overlayHref = safeUrl(overlay.href);
  const overlayBody = <>{overlay.icon ? <IconGlyph name={overlay.icon} size={14} /> : null}{overlayLabel}</>;
  return <span className={className} style={frame}>
    {lightbox
      ? <button type="button" className="ainui-image-open" aria-label={alt ? `Open image: ${alt}` : "Open image"} onClick={() => setZoom(true)}>{img}</button>
      : img}
    {overlayLabel && (overlayHref
      ? <a className="ainui-image-overlay" href={overlayHref} target="_blank" rel="noopener noreferrer"
        onClick={host.openUrl ? (e) => { e.preventDefault(); host.openUrl?.(overlayHref); } : undefined}>{overlayBody}</a>
      : <button type="button" className="ainui-image-overlay" onClick={() => void props.onOverlayClick?.()}>{overlayBody}</button>)}
    {zoom && <Lightbox images={[{ src, alt }]} index={0} onClose={() => setZoom(false)} />}
  </span>;
});

/* ---------- Favicon ---------- */

export function siteHost(url: unknown): string {
  const raw = str(url).trim();
  if (!raw) return "";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(u.protocol) && /^[a-z0-9.-]+$/i.test(u.hostname) ? u.hostname.replace(/^www\./, "") : "";
  } catch { return ""; }
}

/** The icon of the site at `url`; nothing when the site has none or the URL is not a web address. */
export function SiteIcon({ url, size = 16, alt = "", frame, inline }: { url: unknown; size?: number; alt?: string; frame?: boolean; inline?: boolean }) {
  const domain = siteHost(url);
  const [failed, setFailed] = useState("");
  if (!domain || failed === domain) return null;
  return <img className={cx("ainui-favicon", frame && "ainui-favicon-frame", inline && "ainui-favicon-inline")} width={size} height={size} alt={alt} loading="lazy"
    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${Math.round(size * 2)}`} onError={() => setFailed(domain)} style={{ width: size, height: size }} />;
}

const Favicon = standard("Favicon", ({ props }) => {
  const size = num(props.size);
  return <SiteIcon url={props.url} alt={str(props.alt)} frame={!!props.frame} inline={!!props.inline} size={size && size > 0 ? Math.min(size, 256) : 16} />;
});

/* ---------- Svg ---------- */

const paint = (v: unknown): string | undefined =>
  typeof v !== "string" || !v ? undefined : v === "none" || v === "transparent" ? v : v === "prose" || v === "default" || v === "currentColor" ? "currentColor"
    : v === "secondary" ? "var(--ainui-muted)" : /^[#a-z0-9(),.%\s/-]+$/i.test(v) && !/url\s*\(/i.test(v) ? color(v) : undefined;
const shapeStyle = (s: Record<string, any>): React.CSSProperties | undefined => {
  const fill = paint(s.fill), stroke = paint(s.stroke);
  return fill || stroke ? { ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) } : undefined;
};
const LINECAP = ["butt", "round", "square"], LINEJOIN = ["miter", "round", "bevel"], ANCHOR = ["start", "middle", "end"];
const VIEWBOX = /^\s*-?\d+(\.\d+)?([\s,]+-?\d+(\.\d+)?){3}\s*$/;
const ASPECT = /^(none|x(Min|Mid|Max)Y(Min|Mid|Max))(\s+(meet|slice))?$/;

const Svg = standard("Svg", ({ props }) => {
  const label = str(props.label);
  const width = px(props.width ?? props.size), height = px(props.height ?? props.size);
  const strokeWidth = num(props.strokeWidth);
  return <svg className="ainui-svg" viewBox={typeof props.viewBox === "string" && VIEWBOX.test(props.viewBox) ? props.viewBox.trim() : "0 0 24 24"}
    preserveAspectRatio={typeof props.preserveAspectRatio === "string" && ASPECT.test(props.preserveAspectRatio.trim()) ? props.preserveAspectRatio.trim() : undefined}
    strokeWidth={strokeWidth} strokeLinecap={LINECAP.includes(props.strokeLinecap) ? props.strokeLinecap : undefined} strokeLinejoin={LINEJOIN.includes(props.strokeLinejoin) ? props.strokeLinejoin : undefined}
    style={{ width: width ?? (height ? undefined : "24px"), height: height ?? (width ? undefined : "24px"), color: paint(props.color), fill: paint(props.fill) ?? "currentColor", stroke: paint(props.stroke) }}
    {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
    {list(props.paths).map((p, i) => (typeof obj(p).d === "string" ? <path key={`p${i}`} d={p.d} strokeWidth={num(p.strokeWidth)} style={shapeStyle(p)} /> : null))}
    {list(props.rects).map((r, i) => (num(obj(r).width) !== undefined && num(obj(r).height) !== undefined
      ? <rect key={`r${i}`} x={num(r.x) ?? 0} y={num(r.y) ?? 0} width={Math.max(0, r.width)} height={Math.max(0, r.height)} rx={num(r.rx)} style={shapeStyle(r)} /> : null))}
    {list(props.circles).map((c, i) => (num(obj(c).r) !== undefined ? <circle key={`c${i}`} cx={num(c.cx) ?? 0} cy={num(c.cy) ?? 0} r={Math.max(0, c.r)} style={shapeStyle(c)} /> : null))}
    {list(props.lines).map((l, i) => (obj(l) === l
      ? <line key={`l${i}`} x1={num(l.x1) ?? 0} y1={num(l.y1) ?? 0} x2={num(l.x2) ?? 0} y2={num(l.y2) ?? 0} style={{ stroke: paint(l.stroke) ?? paint(props.stroke) ?? "currentColor" }} /> : null))}
    {list(props.texts).map((t, i) => (str(obj(t).text)
      ? <text key={`t${i}`} x={num(t.x) ?? 0} y={num(t.y) ?? 0} fontSize={num(t.size)} textAnchor={ANCHOR.includes(t.anchor) ? t.anchor : undefined} stroke="none" style={shapeStyle({ fill: t.fill })}>{str(t.text)}</text> : null))}
  </svg>;
});

/* ---------- Video ---------- */

function youtubeId(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0]
      : host === "youtube.com" || host === "youtube-nocookie.com" ? (u.pathname === "/watch" ? u.searchParams.get("v") ?? "" : /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname)?.[2] ?? "")
        : "";
    return /^[\w-]{6,20}$/.test(id) ? id : "";
  } catch { return ""; }
}
const VIDEO_SITES = /(^|\.)(vimeo\.com|dailymotion\.com|twitch\.tv|tiktok\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|bilibili\.com|tv\.naver\.com|tv\.kakao\.com|youtube\.com|youtu\.be)$/i;
const FILE_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|m3u8)$/i;
const TRACK_KIND = ["subtitles", "captions", "descriptions"];

const Video = standard("Video", ({ props }) => {
  const host = useHost();
  const [playing, setPlaying] = useState(false);
  const src = mediaUrl(props.url, host);
  const poster = mediaUrl(props.posterUrl, host);
  const title = str(props.title);
  const style: React.CSSProperties = { aspectRatio: str(props.aspectRatio) || "16 / 9", width: px(props.width) ?? "100%", maxWidth: px(props.maxWidth) ?? "100%" };
  if (!src) return null;
  const yt = youtubeId(src);
  if (yt) {
    // Nothing is requested from the video site's player until the viewer asks for it.
    return <div className="ainui-video ainui-video-youtube" style={style}>
      {playing
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`} title={title || "YouTube video"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : <button type="button" className="ainui-video-poster" aria-label={title ? `Play video: ${title}` : "Play video"} onClick={() => setPlaying(true)}>
          <img src={poster || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="ainui-video-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
        </button>}
    </div>;
  }
  let site = "";
  try { const u = new URL(src, "https://local.invalid"); if (VIDEO_SITES.test(u.hostname) && !FILE_EXT.test(u.pathname)) site = u.hostname.replace(/^www\./, ""); } catch { /* a relative URL is a file */ }
  if (site) {
    return <a className="ainui-video-link" href={src} target="_blank" rel="noopener noreferrer" onClick={host.openUrl ? (e) => { e.preventDefault(); host.openUrl?.(src); } : undefined}>
      <span className="ainui-video-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
      <span>{title || "Watch video"}</span><span className="ainui-video-site">{site}</span>
    </a>;
  }
  return <video className="ainui-video" controls preload="metadata" playsInline src={src} poster={poster || undefined} title={title || undefined} aria-label={title || undefined} style={style}>
    {list(props.captions).map((c, i) => {
      const track = mediaUrl(obj(c).url, host);
      return track ? <track key={i} src={track} kind={TRACK_KIND.includes(c.kind) ? c.kind : "subtitles"} srcLang={str(c.language) || undefined} label={str(c.label) || str(c.language) || undefined} default={i === 0} /> : null;
    })}
  </video>;
});

const AudioPlayer = standard("AudioPlayer", ({ props }) => {
  const host = useHost();
  const src = mediaUrl(props.url, host);
  const description = str(props.description);
  if (!src) return null;
  return <figure className="ainui-audio-player">
    {description && <figcaption className="ainui-audio-player-description">{description}</figcaption>}
    <audio controls preload="metadata" src={src} aria-label={description || "Audio"} />
  </figure>;
});

const HtmlView = standard("HtmlView", ({ props }) =>
  <iframe className="ainui-html-view" sandbox="" srcDoc={str(props.html)} title={str(props.title) || "Embedded content"} loading="lazy" referrerPolicy="no-referrer"
    style={{ width: px(props.width) ?? "100%", height: px(props.height) ?? "360px" }} />);

export const media = [Image, Icon, Favicon, Svg, Video, AudioPlayer, HtmlView];
