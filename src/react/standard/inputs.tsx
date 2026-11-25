"use client";

/** Standard catalog — inputs: buttons, forms and the controls that write a value back to the data model. */
import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { Kids, boxStyle, cx, kid, openUrl, standard, surfaceColor, useHost, type ViewProps } from "../core.js";
import { IconGlyph } from "./media.js";

/** True inside a Form, so a Button with `submit` becomes its submit button. */
export const FormContext = createContext(false);

type Option = { value: string; label: string; description?: string };
/** Options arrive as strings or `{value, label, description}`; anything else is dropped. */
function options(list: unknown): Option[] {
  if (!Array.isArray(list)) return [];
  const out: Option[] = [];
  for (const o of list) {
    if (typeof o === "string" || typeof o === "number") out.push({ value: String(o), label: String(o) });
    else if (o && typeof o === "object" && (o as Option).value != null) {
      const value = String((o as Option).value);
      const label = (o as Option).label, description = (o as Option).description;
      out.push({ value, label: label == null || label === "" ? value : String(label), description: typeof description === "string" && description ? description : undefined });
    }
  }
  return out;
}

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const grow = (weight: unknown): React.CSSProperties => (typeof weight === "number" ? { flex: `${weight} 1 0%`, minWidth: 0 } : {});
const call = (fn: unknown, ...args: unknown[]) => { if (typeof fn === "function") void fn(...args); };

/* ── Validation ─────────────────────────────────────────────────────────────────────────────────────────────── */

type Verdict = { valid: boolean; message?: string; severity?: string };
const verdict = (valid: boolean, message: string): Verdict => ({ valid, message });
const isVerdict = (v: unknown): v is Verdict => !!v && typeof v === "object" && "valid" in v;
const within = (n: number, a: Record<string, any>) => (typeof a.min !== "number" || n >= a.min) && (typeof a.max !== "number" || n <= a.max);
const range = (a: Record<string, any>, unit = "") => typeof a.min === "number" && typeof a.max === "number" ? `between ${a.min} and ${a.max}${unit}`
  : typeof a.min === "number" ? `at least ${a.min}${unit}` : `at most ${a.max}${unit}`;

/**
 * The catalog's validators, evaluated here when the binder hands back no verdict for a `@call` (the catalog
 * declares them `rendererOnly`; a host that registers its own implementations takes precedence).
 */
const VALIDATORS: Record<string, (a: Record<string, any>) => Verdict | boolean> = {
  required: (a) => verdict(!(a.value == null || a.value === false || (typeof a.value === "string" && !a.value.trim()) || (Array.isArray(a.value) && !a.value.length)), "This field is required"),
  regex: (a) => { try { return verdict(new RegExp(str(a.pattern)).test(str(a.value)), "Invalid format"); } catch { return verdict(true, ""); } },
  length: (a) => verdict(within(str(a.value).length, a), `Must be ${range(a, " characters")}`),
  numeric: (a) => {
    const n = typeof a.value === "number" ? a.value : typeof a.value === "string" && a.value.trim() ? Number(a.value) : NaN;
    return Number.isFinite(n) ? verdict(within(n, a), `Must be ${range(a)}`) : verdict(false, "Must be a number");
  },
  email: (a) => verdict(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(a.value)), "Enter a valid email address"),
  and: (a) => (Array.isArray(a.values) ? a.values : []).every(truthy),
  or: (a) => (Array.isArray(a.values) ? a.values : []).some(truthy),
  not: (a) => !truthy(a.value),
};
const truthy = (v: unknown) => (isVerdict(v) ? !!v.valid : !!v);
const callName = (v: any): string | undefined => (v && typeof v === "object" ? (typeof v["@call"] === "string" ? v["@call"] : typeof v.call === "string" ? v.call : undefined) : undefined);
const isBinding = (v: any) => v && typeof v === "object" && (typeof v["@path"] === "string" || (typeof v.path === "string" && Object.keys(v).length === 1));

function evaluate(node: any, dc: any): unknown {
  if (Array.isArray(node)) return node.map((n) => evaluate(n, dc));
  const name = callName(node);
  if (name && VALIDATORS[name]) {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.args ?? {})) args[k] = evaluate(v, dc);
    return VALIDATORS[name](args);
  }
  if (node && typeof node === "object" && !isVerdict(node)) { try { return dc.resolveDynamicValue(node); } catch { return undefined; } }
  return node;
}
function bindings(node: any, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) node.forEach((n) => bindings(n, out));
  else if (isBinding(node)) out.push(node);
  else if (node && typeof node === "object") Object.values(node).forEach((n) => bindings(n, out));
  return out;
}

/** The state of the component's `checks`: the first failed message, and whether an error-level check fails. */
function useChecks(props: Record<string, any>, context: ViewProps["context"]): { error?: string; invalid: boolean } {
  const raw = (context?.componentModel?.properties as Record<string, any> | undefined)?.checks;
  const key = Array.isArray(raw) ? JSON.stringify(raw) : "";
  const [, bump] = useState(0);
  useEffect(() => {
    if (!key) return;
    const dc = context.dataContext as any;
    const subs: Array<{ unsubscribe?: () => void }> = [];
    for (const b of bindings(raw)) { try { subs.push(dc.subscribeDynamicValue(b, () => bump((n) => n + 1))); } catch { /* an unreadable binding never changes */ } }
    return () => subs.forEach((s) => { try { s?.unsubscribe?.(); } catch { /* already gone */ } });
  }, [key, context]);

  const failed: Verdict[] = [];
  if (Array.isArray(raw)) {
    const resolved = Array.isArray(props.checks) ? props.checks : [];
    raw.forEach((rule, i) => {
      const isRule = rule && typeof rule === "object" && "condition" in rule;
      const given = isRule ? resolved[i]?.condition : resolved[i];
      let result: unknown = typeof given === "boolean" || isVerdict(given) ? given : evaluate(isRule ? rule.condition : rule, context.dataContext);
      // A call that only the agent can answer has no verdict here; it must not block the user.
      if (result == null || typeof (result as any).then === "function") result = true;
      if (truthy(result)) return;
      const own = isRule ? resolved[i]?.message : undefined;
      const v = isVerdict(result) ? result : { valid: false };
      failed.push({ valid: false, message: typeof own === "string" && own ? own : str(v.message) || "Invalid value", severity: v.severity ?? "error" });
    });
  }
  const fromBinder = Array.isArray(props.validationErrors) ? props.validationErrors.map((e: any) => (typeof e === "string" ? e : str(e?.message))).filter(Boolean) : [];
  return { error: failed[0]?.message ?? fromBinder[0], invalid: props.isValid === false || failed.some((f) => f.severity !== "warning" && f.severity !== "info") };
}

/* ── Field frame ────────────────────────────────────────────────────────────────────────────────────────────── */

type FieldProps = {
  view: ViewProps; kind: string; id: string; error?: string; group?: boolean; className?: string | false; children: React.ReactNode;
};
/** Label above, control, then the first failed check. `group` labels a set of controls instead of one. */
function Field({ view, kind, id, error, group, className, children }: FieldProps) {
  const p = view.props;
  return <div className={cx("ainui-field", `ainui-${kind}`, p.block && "ainui-field-block", p.disabled && "ainui-field-disabled", className)} style={grow(p.weight)}>
    {p.label != null && p.label !== "" && <label className="ainui-field-label" id={`${id}-label`} htmlFor={group ? undefined : id}>
      {str(p.label)}{p.required && <span className="ainui-field-required" aria-hidden="true"> *</span>}
    </label>}
    {children}
    {error && <div className="ainui-field-error" id={`${id}-error`} aria-live="polite" ref={view.validationErrorsRef}>{error}</div>}
  </div>;
}
const described = (id: string, error?: string) => (error ? { "aria-describedby": `${id}-error` } : {});
const labelled = (id: string, p: Record<string, any>) => (p.label != null && p.label !== "" ? { "aria-labelledby": `${id}-label` } : {});

/**
 * A text draft kept beside the bound value, so typing (and IME composition) is never interrupted by the data
 * model's round trip. `write` returns the text form of what it stored.
 */
function useDraft(value: unknown, write: (text: string) => string): [string, (text: string) => void] {
  const external = str(value);
  const [draft, setDraft] = useState(external);
  const last = useRef(external);
  useEffect(() => { if (external !== last.current) { last.current = external; setDraft(external); } }, [external]);
  return [draft, (text) => { setDraft(text); last.current = write(text); }];
}

/** `#`/`9`/`0` take a digit, `A`/`a` a letter, `*` either; any other mask character is inserted as written. */
function applyMask(mask: string, input: string): string {
  const rest = [...input].filter((c) => /[\p{L}\p{N}]/u.test(c));
  const take = (ok: RegExp) => { while (rest.length && !ok.test(rest[0])) rest.shift(); return rest.shift() ?? ""; };
  let out = "";
  for (const m of mask) {
    if (!rest.length) break;
    out += m === "#" || m === "9" || m === "0" ? take(/\d/) : m === "A" || m === "a" ? take(/\p{L}/u) : m === "*" ? take(/./u) : m;
  }
  return out;
}

/* ── Button, Pressable, Form ────────────────────────────────────────────────────────────────────────────────── */

const Button = standard("Button", ({ props, buildChild, context, accessibilityRef }) => {
  const host = useHost();
  const inForm = useContext(FormContext);
  const { error, invalid } = useChecks(props, context);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = !!props.submit && inForm;
  const disabled = !!props.disabled || !!props.loading || invalid;
  const danger = props.tone === "danger" || props.color === "danger";
  const variant = props.variant === "borderless" ? "ghost" : props.variant;
  const click = (e: React.MouseEvent) => {
    if (disabled) { e.preventDefault(); return; }
    if (props.href) { e.preventDefault(); openUrl(host, props.href); return; }
    if (typeof props.copy === "string") {
      e.preventDefault();
      try { void globalThis.navigator?.clipboard?.writeText?.(props.copy)?.catch?.(() => undefined); } catch { /* no clipboard here */ }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
      return;
    }
    if (typeof props.confirm === "string" && props.confirm && typeof globalThis.confirm === "function" && !globalThis.confirm(props.confirm)) { e.preventDefault(); return; }
    if (submit) return;
    // `action` is the A2UI basic catalog / AINUI v1 name for onClick.
    call(props.onClick ?? props.action);
  };
  const hasChildren = Array.isArray(props.children) && props.children.length > 0;
  const icon = copied ? "check" : typeof props.icon === "string" && props.icon ? props.icon : undefined;
  return <button ref={accessibilityRef} type={submit ? "submit" : "button"} disabled={disabled} aria-busy={props.loading ? true : undefined}
    title={copied ? "Copied" : invalid ? error : undefined} data-copied={copied ? "" : undefined} onClick={click} style={grow(props.weight)}
    className={cx("ainui-button", variant && variant !== "default" && `ainui-button-${variant}`, danger && "ainui-button-danger", props.color === "secondary" && "ainui-button-secondary",
      typeof props.size === "string" && `ainui-button-${props.size}`, props.pill !== false && "ainui-button-pill", props.block && "ainui-button-block",
      props.uniform && "ainui-button-uniform", props.loading && "ainui-button-loading")}>
    {props.loading && <span className="ainui-button-spinner" aria-hidden="true" />}
    {icon && <span className="ainui-button-icon" data-icon={icon} aria-hidden="true"><IconGlyph name={icon} size={16} /></span>}
    {hasChildren ? <Kids of={props.children} buildChild={buildChild} /> : props.child ? kid(buildChild, props.child) : str(props.label ?? props.text) || null}
    {copied && <span className="ainui-visually-hidden" role="status">Copied</span>}
  </button>;
});

function useOnVisible(fn: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (typeof fn !== "function" || !el || done.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !done.current) { done.current = true; io.disconnect(); void fn(); }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [fn]);
  return ref;
}

const CONTROLS = "a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=radio],[role=tab],[role=checkbox],[role=switch]";

const Pressable = standard("Pressable", ({ props, buildChild }) => {
  const host = useHost();
  const ref = useOnVisible(props.onVisible);
  const disabled = !!props.disabled;
  const press = () => { if (disabled) return; if (props.href) openUrl(host, props.href); else call(props.onClick); };
  // A control inside sends only its own event.
  const fromInner = (e: React.SyntheticEvent) => {
    const hit = (e.target as Element | null)?.closest?.(CONTROLS);
    return !!hit && hit !== e.currentTarget && e.currentTarget.contains(hit);
  };
  const hover = surfaceColor(props.hoverBackground);
  return <div ref={ref} role={typeof props.role === "string" && props.role ? props.role : props.href ? "link" : "button"} tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled || undefined} aria-pressed={typeof props.ariaPressed === "boolean" ? props.ariaPressed : undefined}
    title={typeof props.tooltip === "string" && props.tooltip ? props.tooltip : undefined}
    className={cx("ainui-pressable", disabled && "ainui-pressable-disabled", props.flush && "ainui-flush", props.insetBorder && "ainui-pressable-inset-border")}
    style={{ display: "flex", flexDirection: "column", gap: props.disableAutoSpacing ? 0 : undefined, ...boxStyle(props), ...(hover ? { "--ainui-pressable-hover": hover } as React.CSSProperties : {}) }}
    onClick={(e) => { if (!fromInner(e)) press(); }}
    onKeyDown={(e) => {
      if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      press();
    }}>
    <Kids of={props.children} buildChild={buildChild} />
  </div>;
});

const ENTER_SUBMITS = new Set(["text", "search", "email", "url", "tel", "password", "number", "date", "time", "datetime-local"]);

const Form = standard("Form", ({ props, buildChild }) => {
  const sending = useRef(false);
  const send = () => {
    // One user gesture can reach here twice (Enter plus the browser's implicit submission).
    if (sending.current) return;
    sending.current = true;
    setTimeout(() => { sending.current = false; }, 0);
    call(props.onSubmit);
  };
  return <form className={cx("ainui-form", props.flush && "ainui-flush")} role={typeof props.role === "string" && props.role ? props.role : undefined}
    aria-label={typeof props.label === "string" && props.label ? props.label : undefined}
    style={{ display: "flex", flexDirection: "column", gap: props.disableAutoSpacing ? 0 : undefined, ...boxStyle(props) }}
    onSubmit={(e) => { e.preventDefault(); send(); }}
    onKeyDown={(e) => {
      const el = e.target as HTMLInputElement;
      if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent?.isComposing || el?.tagName !== "INPUT" || !ENTER_SUBMITS.has(el.type)) return;
      e.preventDefault();
      const form = e.currentTarget;
      if (typeof form.requestSubmit === "function") { try { form.requestSubmit(); return; } catch { /* fall through */ } }
      send();
    }}>
    <FormContext.Provider value={true}><Kids of={props.children} buildChild={buildChild} /></FormContext.Provider>
  </form>;
});

/* ── Text ───────────────────────────────────────────────────────────────────────────────────────────────────── */

const INPUT_TYPE: Record<string, string> = { number: "number", obscured: "password", email: "email", url: "url", tel: "tel" };

function TextAreaControl({ view, id, error, invalid }: { view: ViewProps; id: string; error?: string; invalid: boolean }) {
  const p = view.props;
  const [draft, setDraft] = useDraft(p.value, (text) => { call(p.setValue, text); return text; });
  const el = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const t = el.current;
    if (!t || !p.autoResize) return;
    t.style.height = "auto";
    if (!t.scrollHeight) return;
    const line = typeof getComputedStyle === "function" ? parseFloat(getComputedStyle(t).lineHeight) : NaN;
    const cap = typeof p.maxRows === "number" && line > 0 ? p.maxRows * line + (t.offsetHeight - t.clientHeight) + 16 : Infinity;
    t.style.height = `${Math.min(t.scrollHeight + (t.offsetHeight - t.clientHeight), cap)}px`;
    t.style.overflowY = t.scrollHeight > cap ? "auto" : "hidden";
  }, [draft, p.autoResize, p.maxRows]);
  return <textarea id={id} ref={(node) => { el.current = node; view.accessibilityRef?.(node); }}
    className={cx("ainui-input", "ainui-input-multiline", typeof p.size === "string" && `ainui-input-${p.size}`, p.autoResize && "ainui-input-auto-resize")}
    rows={Math.max(1, Math.round(num(p.rows, 3)))} value={draft} name={p.name || undefined} placeholder={p.placeholder || undefined}
    required={!!p.required} disabled={!!p.disabled} aria-invalid={invalid || !!p.invalid || undefined} {...described(id, error)}
    onChange={(e) => setDraft(e.target.value)} />;
}

const TextArea = standard("TextArea", (view) => {
  const id = useId();
  const { error, invalid } = useChecks(view.props, view.context);
  return <Field view={view} kind="text-area" id={id} error={error}><TextAreaControl view={view} id={id} error={error} invalid={invalid} /></Field>;
});

function TextInputControl({ view, id, error, invalid }: { view: ViewProps; id: string; error?: string; invalid: boolean }) {
  const p = view.props;
  const numeric = p.variant === "number";
  const [draft, setDraft] = useDraft(p.value, (text) => {
    if (!numeric) { call(p.setValue, text); return text; }
    const n = text.trim() === "" ? NaN : Number(text);
    if (Number.isFinite(n)) { call(p.setValue, n); return String(n); }
    // An unfinished number ("-", "1e") is not written; an emptied field clears the value.
    if (text.trim() === "") call(p.setValue, "");
    return "";
  });
  return <input id={id} ref={view.accessibilityRef} type={INPUT_TYPE[p.variant] ?? "text"}
    className={cx("ainui-input", typeof p.size === "string" && `ainui-input-${p.size}`, p.pill !== false && "ainui-input-pill")}
    value={draft} name={p.name || undefined} placeholder={p.placeholder || undefined} required={!!p.required} disabled={!!p.disabled}
    aria-invalid={invalid || !!p.invalid || undefined} {...described(id, error)}
    onFocus={(e) => { if (p.autoSelect) e.currentTarget.select?.(); }}
    onChange={(e) => setDraft(typeof p.mask === "string" && p.mask && !numeric ? applyMask(p.mask, e.target.value) : e.target.value)} />;
}

const TextField = standard("TextField", (view) => {
  const id = useId();
  const { error, invalid } = useChecks(view.props, view.context);
  const Control = view.props.variant === "longText" ? TextAreaControl : TextInputControl;
  return <Field view={view} kind="text-field" id={id} error={error}><Control view={view} id={id} error={error} invalid={invalid} /></Field>;
});

/* ── Choice ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const Select = standard("Select", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const list = options(p.options);
  const value = str(p.value);
  const known = value === "" || list.some((o) => o.value === value);
  return <Field view={view} kind="select" id={id} error={error}>
    <span className={cx("ainui-select-box", typeof p.icon === "string" && p.icon && "ainui-select-with-icon")}>
      {typeof p.icon === "string" && p.icon && <span className="ainui-select-icon" data-icon={p.icon} aria-hidden="true"><IconGlyph name={p.icon} size={16} /></span>}
      <select id={id} ref={view.accessibilityRef} className={cx("ainui-input", "ainui-select-control", typeof p.size === "string" && `ainui-input-${p.size}`, p.pill !== false && "ainui-input-pill", value === "" && "ainui-select-empty")}
        value={value} name={p.name || undefined} required={!!p.required} disabled={!!p.disabled} aria-invalid={invalid || undefined} {...described(id, error)}
        onChange={(e) => call(p.setValue, e.target.value)}>
        {typeof p.placeholder === "string" && p.placeholder ? <option value="" disabled hidden={!!p.clearable}>{p.placeholder}</option>
          : !p.clearable && value === "" && <option value="" disabled hidden />}
        {p.clearable && <option value="">{typeof p.clearLabel === "string" && p.clearLabel ? p.clearLabel : "None"}</option>}
        {!known && <option value={value}>{value}</option>}
        {list.map((o) => <option key={o.value} value={o.value} title={o.description}>{o.label}</option>)}
      </select>
    </span>
  </Field>;
});

const CheckBox = standard("CheckBox", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const checked = p.value === true;
  return <div className={cx("ainui-field", "ainui-check-box", `ainui-check-box-${p.shape === "square" ? "square" : "round"}`, p.disabled && "ainui-field-disabled")} style={grow(p.weight)}>
    <label className={cx("ainui-check-box-row", checked && p.lineThrough && "ainui-check-box-line-through")} htmlFor={id}>
      <input id={id} ref={view.accessibilityRef} type="checkbox" checked={checked} name={p.name || undefined} disabled={!!p.disabled} required={!!p.required}
        aria-invalid={invalid || undefined} {...described(id, error)} onChange={(e) => call(p.setValue, e.target.checked)} />
      {p.label != null && p.label !== "" && <span className="ainui-check-box-label">{str(p.label)}{p.required && <span className="ainui-field-required" aria-hidden="true"> *</span>}</span>}
    </label>
    {error && <div className="ainui-field-error" id={`${id}-error`} aria-live="polite" ref={view.validationErrorsRef}>{error}</div>}
  </div>;
});

/** The catalog gives a lone Radio no binding for its checked state (RadioGroup keeps the value), so it is the browser's own. */
const Radio = standard("Radio", ({ props: p, accessibilityRef }) => {
  const id = useId();
  return <label className={cx("ainui-radio", p.disabled && "ainui-field-disabled")} htmlFor={id}>
    <input id={id} ref={accessibilityRef} type="radio" value={str(p.value)} disabled={!!p.disabled} required={!!p.required} />
    {p.label != null && p.label !== "" && <span className="ainui-radio-label">{str(p.label)}</span>}
  </label>;
});

const RadioGroup = standard("RadioGroup", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const value = str(p.value);
  const variant = p.variant === "pills" || p.variant === "cards" ? p.variant : "list";
  return <Field view={view} kind="radio-group" id={id} error={error} group>
    <div ref={view.accessibilityRef} role="radiogroup" {...labelled(id, p)} {...described(id, error)} aria-required={p.required || undefined} aria-invalid={invalid || undefined}
      className={cx("ainui-radio-group-options", `ainui-radio-group-${variant}`, `ainui-radio-group-${p.direction === "col" ? "col" : "row"}`)}>
      {options(p.options).map((o, i) => <label key={o.value} className={cx("ainui-radio-group-option", o.value === value && "ainui-selected")} htmlFor={`${id}-${i}`}>
        <input id={`${id}-${i}`} type="radio" name={p.name || id} value={o.value} checked={o.value === value} disabled={!!p.disabled} required={!!p.required}
          onChange={() => call(p.setValue, o.value)} />
        <span className="ainui-radio-group-text"><span className="ainui-radio-group-label">{o.label}</span>
          {o.description && <span className="ainui-radio-group-description">{o.description}</span>}</span>
      </label>)}
    </div>
  </Field>;
});

const SegmentedControl = standard("SegmentedControl", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const list = options(p.options);
  const value = str(p.value);
  const current = list.findIndex((o) => o.value === value);
  const box = useRef<HTMLDivElement | null>(null);
  const move = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % list.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + list.length) % list.length
      : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : -1;
    if (next < 0 || p.disabled) return;
    e.preventDefault();
    call(p.setValue, list[next].value);
    box.current?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus?.();
  };
  return <Field view={view} kind="segmented-control" id={id} error={error} group>
    <div ref={(node) => { box.current = node; view.accessibilityRef?.(node); }} role="radiogroup" {...labelled(id, p)} {...described(id, error)} aria-invalid={invalid || undefined}
      className={cx("ainui-segmented-control-track", `ainui-segmented-control-${typeof p.variant === "string" && p.variant ? p.variant : "ghost"}`,
        typeof p.size === "string" && `ainui-segmented-control-${p.size}`, p.pill !== false && "ainui-segmented-control-pill", p.block && "ainui-segmented-control-block")}>
      {list.map((o, i) => <button key={o.value} type="button" role="radio" aria-checked={i === current} tabIndex={i === current || (current < 0 && i === 0) ? 0 : -1}
        disabled={!!p.disabled} title={o.description} className={cx("ainui-segmented-control-option", i === current && "ainui-selected")}
        onClick={() => call(p.setValue, o.value)} onKeyDown={(e) => move(e, i)}>{o.label}</button>)}
    </div>
  </Field>;
});

const ChoicePicker = standard("ChoicePicker", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const [filter, setFilter] = useState("");
  const multiple = p.variant === "multipleSelection";
  const chosen: string[] = Array.isArray(p.value) ? p.value.map(String) : typeof p.value === "string" && p.value ? [p.value] : [];
  const all = options(p.options);
  const needle = filter.trim().toLowerCase();
  const shown = p.filterable && needle ? all.filter((o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle)) : all;
  const pick = (value: string, on: boolean) => {
    if (!multiple) { call(p.setValue, [value]); return; }
    // Keep the catalog's option order, and any chosen value that is no longer offered.
    const next = new Set(chosen); if (on) next.add(value); else next.delete(value);
    call(p.setValue, [...all.map((o) => o.value).filter((v) => next.has(v)), ...chosen.filter((v) => next.has(v) && !all.some((o) => o.value === v))]);
  };
  return <Field view={view} kind="choice-picker" id={id} error={error} group>
    {p.filterable && <input type="search" className="ainui-input ainui-choice-picker-filter" aria-label="Filter options" placeholder="Filter" value={filter}
      disabled={!!p.disabled} onChange={(e) => setFilter(e.target.value)} />}
    <div ref={view.accessibilityRef} role={multiple ? "group" : "radiogroup"} {...labelled(id, p)} {...described(id, error)} aria-invalid={invalid || undefined}
      aria-required={p.required || undefined} className={cx("ainui-choice-picker-options", `ainui-choice-picker-${p.displayStyle === "chips" ? "chips" : "checkbox"}`)}>
      {shown.map((o) => {
        const on = chosen.includes(o.value), key = `${id}-${all.indexOf(o)}`;
        return <label key={o.value} className={cx("ainui-choice-picker-option", on && "ainui-selected")} htmlFor={key}>
          <input id={key} type={multiple ? "checkbox" : "radio"} name={multiple ? undefined : id} value={o.value} checked={on} disabled={!!p.disabled}
            onChange={(e) => pick(o.value, e.target.checked)} />
          <span className="ainui-choice-picker-text"><span className="ainui-choice-picker-label">{o.label}</span>
            {o.description && <span className="ainui-choice-picker-description">{o.description}</span>}</span>
        </label>;
      })}
      {p.filterable && shown.length === 0 && <span className="ainui-choice-picker-empty">No matching options</span>}
    </div>
  </Field>;
});

/* ── Number, date and time ──────────────────────────────────────────────────────────────────────────────────── */

const Slider = standard("Slider", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const min = num(p.min, 0);
  const max = Math.max(min, num(p.max, 100));
  const step = typeof p.steps === "number" && p.steps >= 1 && max > min ? (max - min) / Math.round(p.steps) : num(p.step, 1) > 0 ? num(p.step, 1) : 1;
  const value = Math.min(max, Math.max(min, num(p.value, min)));
  const marks = (Array.isArray(p.marks) ? p.marks : []).filter((m: any) => m && typeof m.value === "number" && m.value >= min && m.value <= max);
  const at = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
  const shown = `${Number(value.toFixed(6))}${typeof p.unit === "string" ? p.unit : ""}`;
  return <Field view={view} kind="slider" id={id} error={error} className={p.sliderStyle === "discrete" && "ainui-slider-discrete"}>
    <div className="ainui-slider-row">
      <input id={id} ref={view.accessibilityRef} type="range" className="ainui-slider-input" min={min} max={max} step={step} value={value} name={p.name || undefined}
        disabled={!!p.disabled} list={marks.length ? `${id}-marks` : undefined} aria-valuetext={shown} aria-invalid={invalid || undefined} {...described(id, error)}
        style={{ "--ainui-slider-fill": `${at(value)}%` } as React.CSSProperties}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) call(p.setValue, n); }} />
      <output className="ainui-slider-value" htmlFor={id}>{shown}</output>
    </div>
    {marks.length > 0 && <>
      <datalist id={`${id}-marks`}>{marks.map((m: any) => <option key={m.value} value={m.value} label={typeof m.label === "string" ? m.label : undefined} />)}</datalist>
      <div className="ainui-slider-marks" aria-hidden="true">
        {marks.map((m: any) => <span key={m.value} className="ainui-slider-mark" style={{ left: `${at(m.value)}%` }}>{typeof m.label === "string" && m.label ? m.label : m.value}</span>)}
      </div>
    </>}
  </Field>;
});

const DATE = /^\d{4}-\d{2}-\d{2}/, TIME = /^\d{2}:\d{2}/;
const datePart = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v.slice(0, 10) : "");
const timePart = (v: unknown) => {
  if (typeof v !== "string") return "";
  const t = v.includes("T") ? v.slice(v.indexOf("T") + 1) : v;
  return TIME.test(t) ? t.slice(0, 5) : "";
};
const pad = (n: number) => String(n).padStart(2, "0");

const DateTimeInput = standard("DateTimeInput", (view) => {
  const { props: p } = view;
  const id = useId();
  const { error, invalid } = useChecks(p, view.context);
  const time = !!p.enableTime;
  const date = p.enableDate === true || !time;
  const mode = date && time ? "datetime-local" : time ? "time" : "date";
  const fit = (v: unknown) => (mode === "date" ? datePart(v) : mode === "time" ? timePart(v) : datePart(v) && timePart(v) ? `${datePart(v)}T${timePart(v)}` : "");
  const value = fit(p.value), min = fit(p.min) || undefined, max = fit(p.max) || undefined;
  const step = typeof p.timeStep === "number" && p.timeStep >= 1 ? Math.round(p.timeStep) : 0;
  const common = { disabled: !!p.disabled, required: !!p.required, "aria-invalid": invalid || undefined, ...described(id, error) };
  const write = (v: string) => call(p.setValue, v);

  let control: React.ReactNode;
  if (time && step) {
    // Fixed times are a list; with a date beside it the two halves are joined into one value.
    const day = mode === "time" ? "" : datePart(p.value);
    const now = timePart(p.value);
    const times: string[] = [];
    for (let m = 0; m < 1440; m += step) times.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    const allowed = mode === "time" ? times.filter((t) => (!min || t >= min) && (!max || t <= max)) : times;
    if (now && !allowed.includes(now)) { allowed.push(now); allowed.sort(); }
    const list = <select id={mode === "time" ? id : `${id}-time`} ref={mode === "time" ? view.accessibilityRef : undefined} className="ainui-input ainui-date-time-input-times"
      aria-label={mode === "time" ? undefined : "Time"} value={now} {...common} disabled={common.disabled || (mode !== "time" && !day)}
      onChange={(e) => write(mode === "time" ? e.target.value : `${day}T${e.target.value}`)}>
      <option value="" disabled hidden>{typeof p.placeholder === "string" && p.placeholder ? p.placeholder : "Time"}</option>
      {allowed.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>;
    control = mode === "time" ? list : <>
      <input id={id} ref={view.accessibilityRef} type="date" className="ainui-input" value={day} min={datePart(p.min) || undefined} max={datePart(p.max) || undefined} {...common}
        onChange={(e) => write(e.target.value ? `${e.target.value}T${now || allowed[0] || "00:00"}` : "")} />
      {list}
    </>;
  } else {
    control = <input id={id} ref={view.accessibilityRef} type={mode} className="ainui-input" value={value} min={min} max={max}
      placeholder={typeof p.placeholder === "string" && p.placeholder ? p.placeholder : undefined} {...common} onChange={(e) => write(mode === "datetime-local" ? e.target.value.slice(0, 16) : e.target.value)} />;
  }
  return <Field view={view} kind="date-time-input" id={id} error={error}>
    <div className="ainui-date-time-input-row">
      {control}
      {p.clearable && str(p.value) !== "" && <button type="button" className="ainui-date-time-input-clear" aria-label="Clear" disabled={!!p.disabled} onClick={() => write("")}>
        <span aria-hidden="true">×</span>
      </button>}
    </div>
  </Field>;
});

export const inputs = [Button, Pressable, Form, TextField, TextArea, Select, CheckBox, Radio, RadioGroup, Slider, SegmentedControl, ChoicePicker, DateTimeInput];
