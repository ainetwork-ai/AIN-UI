/** Shared test harness: a DOM, a mounted AinuiSurface, and what it sent back. Import this before React. */
import { installDom } from "./dom.js";
installDom();
const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AinuiSurface } = await import("../../src/react.js");
const { AINUI_CATALOG } = await import("../../src/index.js");

export { React, act };
export type Drawn = {
  container: HTMLElement;
  html: () => string;
  actions: any[];
  outbound: any[];
  sent: string[];
  errors: Error[];
  /** Appends messages to the same conversation (in-place update). */
  append: (...more: any[]) => Promise<void>;
  wait: (ms?: number) => Promise<void>;
  $: <T extends Element = HTMLElement>(selector: string) => T | null;
  $$: <T extends Element = HTMLElement>(selector: string) => T[];
  click: (selector: string) => Promise<void>;
  type: (selector: string, value: string) => Promise<void>;
  unmount: () => Promise<void>;
};

/** One 1.0 surface in the AINUI catalog: `components` (one must have id "root") and its data. */
export const surface = (components: any[], dataModel: Record<string, unknown> = {}, surfaceId = "s") =>
  [{ version: "1.0", createSurface: { surfaceId, catalogId: AINUI_CATALOG, components, dataModel } }];

export async function draw(messages: any[], props: Record<string, unknown> = {}): Promise<Drawn> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const actions: any[] = [], outbound: any[] = [], sent: string[] = [], errors: Error[] = [];
  let current = messages;
  const render = () => root.render(React.createElement(AinuiSurface, {
    messages: current, onAction: (a: any) => { actions.push(a); }, onMessage: (m: any) => { outbound.push(m); },
    onError: (e: Error) => { errors.push(e); }, sendMessage: (t: string) => { sent.push(t); }, resolveAsset: (a: any) => `/files/${a.path}`, ...props,
  } as never));
  const wait = async (ms = 20) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
  await act(async () => { render(); });
  await wait();
  const $ = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel);
  const g = globalThis as any;
  return {
    container, actions, outbound, sent, errors, wait, $,
    html: () => container.innerHTML.replace(/<!--.*?-->/g, ""),
    $$: (sel) => Array.from(container.querySelectorAll(sel)) as never,
    append: async (...more) => { current = [...current, ...more]; await act(async () => { render(); }); await wait(); },
    click: async (sel) => { const el = $(sel); if (!el) throw new Error(`no element for ${sel}`); await act(async () => { (el as HTMLElement).click(); }); await wait(); },
    type: async (sel, value) => {
      const el = $<HTMLInputElement>(sel); if (!el) throw new Error(`no element for ${sel}`);
      const proto = el instanceof g.HTMLTextAreaElement ? g.HTMLTextAreaElement.prototype : el instanceof g.HTMLSelectElement ? g.HTMLSelectElement.prototype : g.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new g.Event("input", { bubbles: true }));
        el.dispatchEvent(new g.Event("change", { bubbles: true }));
      });
      await wait();
    },
    unmount: async () => { await act(async () => { root.unmount(); }); container.parentNode?.removeChild(container); },
  };
}
