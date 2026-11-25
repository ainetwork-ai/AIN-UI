"use client";

/** Standard catalog — feedback: pulse dot, flashcard, popover, modal. */
import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { Kids, color, cx, kid, px, space, standard } from "../core.js";
import { InlineContext } from "./text.js";

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Open state that follows the bound `open` and writes back through `setOpen`; local when nothing is bound. */
function useOpen(props: Record<string, any>): [boolean, (next: boolean) => void] {
  const [open, setLocal] = useState(props.open === true);
  useEffect(() => { setLocal(props.open === true); }, [props.open]);
  const set = (next: boolean) => {
    setLocal(next);
    try { props.setOpen?.(next); } catch { /* a literal `open` has nowhere to write */ }
  };
  return [open, set];
}

const PulseIndicator = standard("PulseIndicator", ({ props }) => {
  const label = str(props.label);
  const dot = color(props.color) ?? "var(--ainui-success)";
  const style = {
    "--ainui-pulse-size": `${Math.max(1, num(props.size, 12))}px`, "--ainui-pulse-color": dot, "--ainui-pulse-ring": color(props.pulseColor) ?? dot,
    "--ainui-pulse-duration": `${Math.max(0, num(props.duration, 1500))}ms`, "--ainui-pulse-scale": num(props.endScale, 2.4), "--ainui-pulse-opacity": num(props.startOpacity, 0.6),
  } as React.CSSProperties;
  return <span className="ainui-pulse-indicator" style={style} {...(label ? { role: "img", "aria-label": label, title: label } : { "aria-hidden": true })}>
    <span className="ainui-pulse-indicator-ring" /><span className="ainui-pulse-indicator-dot" />
  </span>;
});

const FlashcardFlip = standard("FlashcardFlip", ({ props }) => {
  const [flipped, setFlipped] = useState(false);
  const hint = str(props.hint);
  return <button type="button" className={cx("ainui-flashcard-flip", flipped && "ainui-flashcard-flip-flipped")} aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}>
    <span key={flipped ? "back" : "front"} className={cx("ainui-flashcard-flip-face", flipped ? "ainui-flashcard-flip-back" : "ainui-flashcard-flip-front")} aria-live="polite">
      <span className="ainui-flashcard-flip-text">{str(flipped ? props.back : props.front)}</span>
      {!flipped && hint && <span className="ainui-flashcard-flip-hint">{hint}</span>}
    </span>
  </button>;
});

export type PopoverState = { open: boolean; setOpen: (next: boolean) => void; contentId: string; hover: boolean };
/** What a Popover shares with its PopoverTrigger and PopoverContent. Null outside a Popover. */
export const PopoverContext = createContext<PopoverState | null>(null);

const Popover = standard("Popover", ({ props, buildChild }) => {
  const [open, setOpen] = useOpen(props);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const contentId = useId();
  const hover = !!props.showOnHover;
  const latest = useRef(setOpen);
  latest.current = setOpen;
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const outside = (e: Event) => { if (root.current && !root.current.contains(e.target as Node)) latest.current(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      latest.current(false);
      root.current?.querySelector<HTMLElement>(".ainui-popover-trigger")?.focus?.();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  const later = (next: boolean, ms: number) => { clearTimeout(timer.current); timer.current = setTimeout(() => latest.current(next), ms); };
  return <div ref={root} className={cx("ainui-popover", open && "ainui-popover-open")}
    onMouseEnter={hover ? () => later(true, Math.max(0, num(props.hoverOpenDelay, 0))) : undefined}
    // The short grace period lets the pointer cross the gap between trigger and content.
    onMouseLeave={hover ? () => later(false, 150) : undefined}>
    <PopoverContext.Provider value={{ open, setOpen, contentId, hover }}><Kids of={props.children} buildChild={buildChild} /></PopoverContext.Provider>
  </div>;
});

const PopoverTrigger = standard("PopoverTrigger", ({ props, buildChild }) => {
  const popover = useContext(PopoverContext);
  return <button type="button" className={cx("ainui-popover-trigger", props.block && "ainui-popover-trigger-block")} aria-haspopup="dialog"
    aria-expanded={popover?.open ?? false} aria-controls={popover?.open ? popover.contentId : undefined}
    onClick={() => popover?.setOpen(popover.hover ? true : !popover.open)}>
    <InlineContext.Provider value={true}><Kids of={props.children} buildChild={buildChild} /></InlineContext.Provider>
  </button>;
});

const pick = (v: unknown, of: string[], fallback: string) => (typeof v === "string" && of.includes(v) ? v : fallback);
const PopoverContent = standard("PopoverContent", ({ props, buildChild }) => {
  const popover = useContext(PopoverContext);
  if (!popover?.open) return null;
  return <div id={popover.contentId} role="dialog" className={cx("ainui-popover-content", `ainui-popover-content-${pick(props.side, ["top", "bottom", "left", "right"], "bottom")}`,
    `ainui-popover-content-align-${pick(props.align, ["start", "center", "end"], "center")}`)}
    style={{ "--ainui-popover-offset": `${num(props.sideOffset, 6)}px`, width: space(props.width) } as React.CSSProperties}>
    <Kids of={props.children} buildChild={buildChild} />
  </div>;
});

const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]";
const Modal = standard("Modal", ({ props, buildChild }) => {
  const [open, setOpen] = useOpen(props);
  const trigger = useRef<HTMLSpanElement>(null), dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const title = str(props.title);
  // A trigger that is not focusable itself (a Text) becomes a button; a Button keeps its own semantics.
  const [bare, setBare] = useState(false);
  useEffect(() => { setBare(!!trigger.current && !trigger.current.querySelector(FOCUSABLE)); }, [props.trigger]);
  const latest = useRef(setOpen);
  latest.current = setOpen;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) dialog.current?.focus?.();
    else if (wasOpen.current) (trigger.current?.querySelector<HTMLElement>(FOCUSABLE) ?? trigger.current)?.focus?.();
    wasOpen.current = open;
    if (!open || typeof document === "undefined") return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); latest.current(false); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  return <div className="ainui-modal" style={typeof props.weight === "number" ? { flex: `${props.weight} 1 0%`, minWidth: 0 } : undefined}>
    <span ref={trigger} className="ainui-modal-trigger" aria-haspopup="dialog" {...(bare ? { role: "button", tabIndex: 0, "aria-expanded": open } : {})}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => { if (bare && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}>
      <InlineContext.Provider value={bare}>{kid(buildChild, props.trigger)}</InlineContext.Provider>
    </span>
    {open && <div className="ainui-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : "Dialog"} tabIndex={-1}
        className="ainui-modal-dialog" style={{ maxWidth: px(props.maxWidth) ?? "480px" }}>
        <div className="ainui-modal-header">
          {title ? <h2 id={titleId} className="ainui-modal-title">{title}</h2> : <span />}
          <button type="button" className="ainui-modal-close" aria-label="Close" onClick={() => setOpen(false)}>{"×"}</button>
        </div>
        <div className="ainui-modal-body">{kid(buildChild, props.content)}</div>
      </div>
    </div>}
  </div>;
});

export const feedback = [PulseIndicator, FlashcardFlip, Popover, PopoverTrigger, PopoverContent, Modal];
