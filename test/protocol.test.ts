import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { ainuiPayment, ainuiFolder, ainuiFile, ainuiEditor, toItem, ainuiActivity, messagesFromActivity, dispatchAinuiAction, AINUI_CATALOG, type AinuiDeps } from "../src/index.js";
import { AinuiSurface } from "../src/react.js";

test("official React renderer draws AIN-UI payment terms and grid", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://example.test" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const actions: unknown[] = [];
  const draw = async (messages: Parameters<typeof AinuiSurface>[0]["messages"]) => {
    await act(async () => { root.render(React.createElement(AinuiSurface, { messages, onAction: (a) => { actions.push(a); }, resolveAsset: (a) => `/files/${a.path}` })); });
    return container.innerHTML;
  };
  const required = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453" as const, amount: "10000", asset: "0xasset", payTo: "0xseller", maxTimeoutSeconds: 300 }] };
  const messages = ainuiPayment({ shareToken: "sale", title: "Report", required, paymentRequired: "encoded-quote", symbol: "USDC", decimals: 6 });
  assert.equal(messages[0].createSurface?.catalogId, AINUI_CATALOG);
  const html = await draw(messages);
  assert.match(html, /0.01/);
  assert.match(html, /USDC/);
  assert.match(html, /0xseller/);
  await act(async () => { container.querySelector("button")!.click(); });
  assert.equal((actions[0] as any).name, "aindrive.x402.pay");
  assert.equal((actions[0] as any).context.paymentRequired, "encoded-quote");
  assert.deepEqual(messagesFromActivity(ainuiActivity("payment", messages)), messages);
  const folder = ainuiFolder({ driveId: "d1", path: "", items: [], env: { canWrite: true, view: "grid" } });
  const folderHtml = await draw(folder);
  assert.match(folderHtml, /type="file"/);
  const gallery = ainuiFolder({ driveId: "d1", path: "photos", items: [toItem("d1", "photos/a.png", { name: "a.png", isDir: false, size: 10 }, {})], env: { view: "grid" } });
  assert.match(await draw(gallery), /a.png/);
  assert.ok(container.querySelector("img")?.getAttribute("src")?.includes("photos/a.png"));
  const file = ainuiFile({ driveId: "d1", path: "photos/a.png", mime: "image/png", size: 10, mtime: 1 });
  assert.match(await draw(file), /Download/);
  assert.equal(container.querySelector("img")?.getAttribute("src"), "/files/photos/a.png");
  const editor = ainuiEditor({ driveId: "d1", path: "a.txt", content: "hello" });
  assert.match(await draw(editor), /hello/);
  await act(async () => root.render(React.createElement(AinuiSurface, {
    messages: file, onAction: () => {}, resolveAsset: (a, opts) => `/authorized/${a.path}${opts?.download ? "?download=1" : ""}`,
    renderFile: (f) => React.createElement("a", { "data-host-preview": f.mime, href: f.download }, f.name),
  })));
  assert.equal(container.querySelector("[data-host-preview]")?.getAttribute("href"), "/authorized/photos/a.png?download=1");
  assert.equal(container.querySelector("[data-host-preview]")?.getAttribute("data-host-preview"), "image/png");
  const form = [
    { version: "v0.9" as const, createSurface: { surfaceId: "form", catalogId: AINUI_CATALOG } },
    { version: "v0.9" as const, updateComponents: { surfaceId: "form", components: [
      { id: "root", component: "Column", children: ["name", "choice", "submit"] },
      { id: "name", component: "TextField", label: "Folder", value: { path: "/name" } },
      { id: "choice", component: "ChoicePicker", label: "Team", variant: "mutuallyExclusive", options: [{ label: "Family", value: "family" }, { label: "Work", value: "work" }], value: { path: "/team" } },
      { id: "submit", component: "Button", child: "label", action: { event: { name: "share", context: { name: { path: "/name" }, team: { path: "/team" } } } } },
      { id: "label", component: "Text", text: "Share" },
    ] } },
    { version: "v0.9" as const, updateDataModel: { surfaceId: "form", path: "/", value: { name: "Photos", team: ["family"] } } },
  ];
  await draw(form);
  assert.equal(container.querySelector<HTMLInputElement>('input[type="text"]')?.value, "Photos");
  await act(async () => { (container.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement).click(); });
  await act(async () => { container.querySelector("button")!.click(); });
  assert.deepEqual((actions.at(-1) as any).context, { name: "Photos", team: ["work"] });
  await act(async () => root.unmount());
  dom.window.close();
});

test("upload checks capabilities, names, encoding and size before writing", async () => {
  const calls: string[] = [];
  const deps: AinuiDeps = { allowed: () => true, env: () => ({ canWrite: true }),
    run: async (skill, args) => { calls.push(skill); return { kind: "ok", text: "ok", structured: skill === "list_files" ? { entries: [] } : args }; } };
  const action = { name: "aindrive.upload", context: { drive_id: "d1", path: "docs", name: "a.bin", content: "AA==", encoding: "base64" } };
  const ok = await dispatchAinuiAction(action, deps);
  assert.equal(ok.kind, "done");
  assert.deepEqual(calls, ["write_file", "list_files"]);
  calls.length = 0;
  const refused = await dispatchAinuiAction(action, { ...deps, allowed: () => false });
  assert.equal(refused.kind, "refused");
  for (const name of ["../a", "a/b", "a\\b", "..", ""]) {
    const result = await dispatchAinuiAction({ ...action, context: { ...action.context, name } }, deps);
    assert.equal(result.kind === "done" && result.final.result.kind, "err");
  }
  const denied = await dispatchAinuiAction(action, { ...deps, env: () => ({ canWrite: false }) });
  assert.equal(denied.kind === "done" && denied.final.result.kind, "err");
  assert.deepEqual(calls, []);
});
