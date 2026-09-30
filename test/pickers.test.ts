import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import {
  AINUI_CATALOG, PICKER_ACTIONS, ainuiAgentPicker, ainuiFilePicker, agentKey, agentPickReason, capabilityLines, dispatchAinuiAction,
  fileKey, filePickReason, type AgentListResponse, type AgentListItem, type FileListItem, type FileListResponse,
} from "../src/index.js";
import { AinuiSurface } from "../src/react.js";
import { createA2uiRenderer } from "../src/renderer.js";

const fixture = <T,>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;
const files = fixture<FileListResponse>("file-list-response.json");
const agents = fixture<AgentListResponse>("agent-list-response.json");
const online = files.items[0];
const offline: FileListItem = { ...online, ref: { ...online.ref, fileId: "off-1", displayName: "offline.pdf", availability: { state: "offline", lastSeenAt: "2026-09-01T00:00:00Z" } } };
const deleted: FileListItem = { ...online, ref: { ...online.ref, fileId: "gone-1", displayName: "gone.pdf", availability: { state: "deleted" } } };
const unentitled: FileListItem = { ...online, ref: { ...online.ref, fileId: "paid-1", displayName: "paid.pdf" }, shareOrigin: "paid", paid: { entitled: false, pricingRef: "price_1" } };
const fileList: FileListResponse = { ...files, nextCursor: "next-1", items: [online, offline, deleted, unentitled] };
const active = agents.items[0];
const noInvoke: AgentListItem = { ref: { ...active.ref, agentId: "locked", displayName: "Locked agent" }, canInvoke: false };
const stopped: AgentListItem = { ref: { ...active.ref, agentId: "stopped", displayName: "Stopped agent", status: "stopped" }, canInvoke: true };
const agentList: AgentListResponse = { ...agents, items: [active, noInvoke, stopped] };
const SECRET_KEYS = /^(token|signature|authorization|sig|key)$/i;
function keysDeep(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); keysDeep(x, out); }
  return out;
}

test("picker builders bind the listing through the data model and name the fixed actions", () => {
  const f = ainuiFilePicker("files", fileList, { scope: "shared_with_me", query: "안내", selection: "multiple", context: { requestId: "r1" } });
  const a = ainuiAgentPicker("agents", agentList, { scope: "shared_with_org", renders: ["streaming"], selected: agentKey(active.ref) });
  for (const [messages, component] of [[f, "FilePicker"], [a, "AgentPicker"]] as const) {
    assert.equal(messages[0].createSurface?.catalogId, AINUI_CATALOG);
    const c = messages[1].updateComponents!.components[0];
    assert.equal(c.component, component);
    assert.deepEqual(c.items, { path: "/items" });
    assert.deepEqual(c.scope, { path: "/scope" });
    assert.deepEqual(c.cursor, { path: "/cursor" });
    assert.equal(JSON.stringify(c).includes("displayName"), false, "items live in the data model, not inline");
  }
  const fd = f[2].updateDataModel!.value as Record<string, unknown>;
  assert.deepEqual(fd.items, fileList.items);
  assert.equal(fd.cursor, "next-1"); assert.equal(fd.scope, "shared_with_me"); assert.equal(fd.query, "안내"); assert.equal(fd.selection, "multiple");
  assert.deepEqual(fd.context, { requestId: "r1" }); assert.equal(fd.asOf, files.asOf);
  const ad = a[2].updateDataModel!.value as Record<string, unknown>;
  assert.deepEqual(ad.items, agentList.items); assert.equal(ad.cursor, "c2"); assert.deepEqual(ad.renders, ["streaming"]); assert.equal(ad.selected, agentKey(active.ref));
  assert.deepEqual([...PICKER_ACTIONS], ["ainui.picker.scope", "ainui.picker.search", "ainui.picker.more", "ainui.picker.pick", "ainui.picker.open", "ainui.picker.card"]);
  assert.equal(fileKey(online.ref), "https://aindrive.ainetwork.ai#drv_7f3a#p1:3c8f0b1d2e4a5b6c7d8e9f0a1b2c3d4e");
});

test("row rules: availability, entitlement, invocability and capability fallbacks", () => {
  assert.equal(filePickReason(online), null);
  assert.match(filePickReason(offline)!, /오프라인/);
  assert.match(filePickReason(deleted)!, /삭제됨/);
  assert.match(filePickReason(unentitled)!, /구매 필요/);
  assert.equal(filePickReason({ ...online, ref: { ...online.ref, availability: { state: "unknown" } } }), null, "unknown availability is not a refusal");
  assert.equal(agentPickReason(active), null);
  assert.match(agentPickReason(noInvoke)!, /권한/);
  assert.match(agentPickReason(stopped)!, /중지됨/);
  assert.deepEqual(capabilityLines(active.ref, ["streaming", "ainui"]), { enabled: ["streaming"], fallbacks: ["cancel", "a2ui_basic"] });
  assert.deepEqual(capabilityLines(active.ref, undefined), { enabled: [], fallbacks: ["streaming", "cancel", "a2ui_basic"] });
});

test("dispatchAinuiAction hands picker actions to the host untouched", async () => {
  const calls: string[] = [];
  const action = { name: "ainui.picker.pick", context: { kind: "file", refs: [online.ref] } };
  const reply = await dispatchAinuiAction(action, { allowed: () => false, env: () => ({}), run: async (s) => { calls.push(s); return { kind: "ok", text: "", structured: {} }; } });
  assert.equal(reply.kind, "host");
  assert.equal(reply.kind === "host" && reply.action, action);
  assert.deepEqual(calls, []);
  assert.equal((await dispatchAinuiAction({ name: "ainui.picker.nope", context: {} }, { allowed: () => true, env: () => ({}), run: async () => ({ kind: "ok", text: "", structured: {} }) })).kind, "invalid");
});

async function mountReact(id: string) {
  const dom = new JSDOM(`<!doctype html><div id='${id}'></div>`, { url: "https://example.test" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.getElementById(id)!;
  const root = createRoot(container);
  const actions: any[] = [];
  const draw = async (messages: Parameters<typeof AinuiSurface>[0]["messages"]) => {
    await act(async () => { root.render(React.createElement(AinuiSurface, { messages, onAction: (a) => { actions.push(a); } })); });
  };
  const click = async (el: Element | null) => { assert.ok(el, "element to click"); await act(async () => { (el as HTMLElement).click(); }); };
  const close = async () => { await act(async () => root.unmount()); dom.window.close(); };
  return { dom, container, actions, draw, click, close };
}

test("React FilePicker: pick returns the full ref (no secrets), offline rows only open, paid rows show the badge", async () => {
  const { container, actions, draw, click, close } = await mountReact("files");
  await draw(ainuiFilePicker("files", fileList, { scope: "shared_with_me", context: { requestId: "r1" } }));
  assert.equal(container.querySelectorAll("[role=tab]").length, 4);
  assert.equal(container.querySelector("[role=tab][aria-selected=true]")?.textContent, "나에게 공유됨");
  const rows = container.querySelectorAll(".ainui-picker-row");
  assert.equal(rows.length, 4);
  assert.match(rows[0].textContent!, /전시 안내\.pdf/); assert.match(rows[0].textContent!, /직접 공유/); assert.match(rows[0].textContent!, /보기 전용/); assert.match(rows[0].textContent!, /온라인/);
  await click(rows[0].querySelector(".ainui-picker-pick"));
  const pick = actions.at(-1);
  assert.equal(pick.name, "ainui.picker.pick");
  assert.equal(pick.context.kind, "file");
  assert.equal(pick.context.requestId, "r1");
  assert.deepEqual(pick.context.refs, [online.ref]);
  assert.ok(!keysDeep(pick.context).some((k) => SECRET_KEYS.test(k)), "no credential-like keys in the action");
  // offline: greyed, reason announced, pick disabled, open still fires with sourceUrl only
  const off = rows[1];
  assert.ok(off.classList.contains("ainui-picker-row-unavailable"));
  assert.equal(off.getAttribute("aria-disabled"), "true");
  assert.match(off.textContent!, /오프라인/);
  const offPick = off.querySelector<HTMLButtonElement>(".ainui-picker-pick")!;
  assert.equal(offPick.disabled, true);
  assert.match(offPick.getAttribute("aria-label")!, /offline\.pdf: 오프라인/);
  const before = actions.length;
  await click(offPick);
  assert.equal(actions.length, before, "disabled pick fires nothing");
  await click(off.querySelector(".ainui-picker-open"));
  assert.equal(actions.at(-1).name, "ainui.picker.open");
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", sourceUrl: online.ref.sourceUrl });
  assert.match(rows[2].textContent!, /삭제됨/);
  assert.equal(rows[2].querySelector<HTMLButtonElement>(".ainui-picker-pick")!.disabled, true);
  // paid, not entitled
  assert.match(rows[3].querySelector(".ainui-picker-badge-warn")!.textContent!, /구매 필요/);
  assert.equal(rows[3].querySelector<HTMLButtonElement>(".ainui-picker-pick")!.disabled, true);
  // scope, search, more
  await click(container.querySelectorAll("[role=tab]")[3]);
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", scope: "recent" });
  container.querySelector<HTMLInputElement>("input[type=search]")!.value = "안내";
  await act(async () => { container.querySelector("form[role=search]")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", query: "안내" });
  await click(container.querySelector(".ainui-picker-more"));
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", cursor: "next-1" });
  // multiple selection: toggle two rows, done sends both refs; unpickable rows never enter the set
  await draw(ainuiFilePicker("files", { ...fileList, nextCursor: null, items: [online, { ...online, ref: { ...online.ref, fileId: "two", displayName: "two.pdf" } }, offline] }, { scope: "mine", selection: "multiple" }));
  assert.equal(container.querySelector(".ainui-picker-more"), null);
  const done = container.querySelector<HTMLButtonElement>(".ainui-picker-done")!;
  assert.equal(done.disabled, true);
  const picks = container.querySelectorAll(".ainui-picker-pick");
  await click(picks[0]); await click(picks[1]);
  assert.equal(container.querySelectorAll("[aria-selected=true].ainui-picker-row").length, 2);
  await click(done);
  assert.deepEqual(actions.at(-1).context.refs.map((r: any) => r.fileId), [online.ref.fileId, "two"]);
  await close();
});

test("React AgentPicker: pick carries the full AgentRef, non-invocable rows disable select, fallbacks are listed", async () => {
  const { container, actions, draw, click, close } = await mountReact("agents");
  await draw(ainuiAgentPicker("agents", agentList, { scope: "shared_with_org", renders: ["streaming", "ainui"], selected: agentKey(active.ref) }));
  const rows = container.querySelectorAll(".ainui-picker-row");
  assert.equal(rows.length, 3);
  assert.match(rows[0].textContent!, /Uncommon Gallery 안내/); assert.match(rows[0].textContent!, /전시 자료 폴더/); assert.match(rows[0].textContent!, /활성/); assert.match(rows[0].textContent!, /조직/);
  assert.match(rows[0].querySelector(".ainui-picker-enabled")!.textContent!, /지원: streaming/);
  assert.match(rows[0].querySelector(".ainui-picker-fallbacks")!.textContent!, /대체: cancel, a2ui_basic/);
  assert.equal(rows[0].getAttribute("aria-selected"), "true");
  assert.equal(rows[0].querySelectorAll(".ainui-picker-badge").length, 3, "status, visibility, one skill");
  await click(rows[0].querySelector(".ainui-picker-pick"));
  assert.equal(actions.at(-1).name, "ainui.picker.pick");
  assert.deepEqual(actions.at(-1).context, { kind: "agent", ref: active.ref });
  assert.ok(!keysDeep(actions.at(-1).context).some((k) => SECRET_KEYS.test(k)));
  const locked = rows[1].querySelector<HTMLButtonElement>(".ainui-picker-pick")!;
  assert.equal(locked.disabled, true);
  assert.match(locked.getAttribute("aria-label")!, /호출 권한이 없습니다/);
  assert.match(rows[2].textContent!, /중지됨/);
  assert.equal(rows[2].querySelector<HTMLButtonElement>(".ainui-picker-pick")!.disabled, true);
  await click(rows[1].querySelector(".ainui-picker-card"));
  assert.deepEqual(actions.at(-1).context, { kind: "agent", agentCardUrl: active.ref.agentCardUrl });
  await click(container.querySelector(".ainui-picker-more"));
  assert.deepEqual(actions.at(-1).context, { kind: "agent", cursor: "c2" });
  await click(container.querySelectorAll("[role=tab]")[3]);
  assert.deepEqual(actions.at(-1).context, { kind: "agent", scope: "public" });
  await close();
});

test("DOM renderer draws both pickers from the same messages and fires the same payloads", async () => {
  const dom = new JSDOM("<!doctype html><div id='dom'></div>", { url: "https://example.test" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  const container = document.getElementById("dom")!;
  const actions: any[] = [];
  const r = createA2uiRenderer(container, { onAction: (a: any) => { actions.push(a); } });
  r.replace(ainuiFilePicker("files", fileList, { scope: "shared_with_me", context: { requestId: "r1" } }) as any);
  const rows = container.querySelectorAll(".ainui-picker-row");
  assert.equal(rows.length, 4);
  assert.equal(container.querySelector("[role=tab][aria-selected=true]")?.textContent, "나에게 공유됨");
  (rows[0].querySelector(".ainui-picker-pick") as HTMLButtonElement).click();
  assert.equal(actions.at(-1).name, "ainui.picker.pick");
  assert.equal(actions.at(-1).surfaceId, "files");
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", refs: [online.ref] });
  assert.ok(!keysDeep(actions.at(-1).context).some((k) => SECRET_KEYS.test(k)));
  const offPick = rows[1].querySelector(".ainui-picker-pick") as HTMLButtonElement;
  assert.equal(offPick.disabled, true);
  assert.match(offPick.getAttribute("aria-label")!, /오프라인/);
  assert.ok(rows[1].classList.contains("ainui-picker-row-unavailable"));
  (rows[1].querySelector(".ainui-picker-open") as HTMLButtonElement).click();
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", sourceUrl: online.ref.sourceUrl });
  assert.match(rows[3].querySelector(".ainui-picker-badge-warn")!.textContent!, /구매 필요/);
  assert.equal((rows[3].querySelector(".ainui-picker-pick") as HTMLButtonElement).disabled, true);
  (container.querySelector(".ainui-picker-more") as HTMLButtonElement).click();
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", cursor: "next-1" });
  (container.querySelectorAll("[role=tab]")[3] as HTMLButtonElement).click();
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", scope: "recent" });
  (container.querySelector("input[type=search]") as HTMLInputElement).value = "안내";
  container.querySelector("form[role=search]")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.deepEqual(actions.at(-1).context, { requestId: "r1", kind: "file", query: "안내" });
  // multiple selection in the DOM renderer
  r.replace(ainuiFilePicker("files", { ...fileList, items: [online, offline] }, { scope: "mine", selection: "multiple" }) as any);
  const done = container.querySelector(".ainui-picker-done") as HTMLButtonElement;
  assert.equal(done.disabled, true);
  (container.querySelector(".ainui-picker-pick") as HTMLButtonElement).click();
  assert.equal(done.disabled, false);
  done.click();
  assert.deepEqual(actions.at(-1).context, { kind: "file", refs: [online.ref] });
  // agents
  r.replace(ainuiAgentPicker("agents", agentList, { scope: "shared_with_org", renders: ["streaming", "ainui"], selected: agentKey(active.ref) }) as any);
  const arows = container.querySelectorAll(".ainui-picker-row");
  assert.equal(arows.length, 3);
  assert.equal(arows[0].getAttribute("aria-selected"), "true");
  assert.match(arows[0].querySelector(".ainui-picker-fallbacks")!.textContent!, /대체: cancel, a2ui_basic/);
  assert.match(arows[0].querySelector(".ainui-picker-enabled")!.textContent!, /지원: streaming/);
  (arows[0].querySelector(".ainui-picker-pick") as HTMLButtonElement).click();
  assert.deepEqual(actions.at(-1).context, { kind: "agent", ref: active.ref });
  assert.equal((arows[1].querySelector(".ainui-picker-pick") as HTMLButtonElement).disabled, true);
  assert.match(arows[1].querySelector(".ainui-picker-pick")!.getAttribute("aria-label")!, /호출 권한/);
  assert.equal((arows[2].querySelector(".ainui-picker-pick") as HTMLButtonElement).disabled, true);
  (arows[0].querySelector(".ainui-picker-card") as HTMLButtonElement).click();
  assert.deepEqual(actions.at(-1).context, { kind: "agent", agentCardUrl: active.ref.agentCardUrl });
  (container.querySelector(".ainui-picker-more") as HTMLButtonElement).click();
  assert.deepEqual(actions.at(-1).context, { kind: "agent", cursor: "c2" });
  dom.window.close();
});
