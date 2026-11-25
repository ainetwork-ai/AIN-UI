import { JSDOM } from "jsdom";

/** Names Node itself defines; a DOM never replaces these (timers, console, URL, fetch, …). */
let native: Set<string> | undefined;
const FROM_DOM = ["Event", "CustomEvent", "EventTarget", "MouseEvent", "KeyboardEvent", "InputEvent"];

/**
 * A fresh DOM as the globals React and the A2UI custom elements expect. Call it again for a new, empty document:
 * every DOM global is replaced, so nothing from the previous window leaks into the next test.
 */
export function installDom(html = "<!doctype html><div id=root></div>") {
  native ??= new Set(Object.getOwnPropertyNames(globalThis));
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: "https://example.test" });
  const w = dom.window as any;
  for (const k of Object.getOwnPropertyNames(w)) {
    if (native.has(k) && !FROM_DOM.includes(k)) continue;
    try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch { /* read-only in this runtime */ }
  }
  Object.assign(globalThis, { window: w, document: w.document, IS_REACT_ACT_ENVIRONMENT: true });
  if (!w.CSSStyleSheet.prototype.replaceSync) w.CSSStyleSheet.prototype.replaceSync = function () {};
  return dom;
}
