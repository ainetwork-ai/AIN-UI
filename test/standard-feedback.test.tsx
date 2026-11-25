import { test } from "node:test";
import assert from "node:assert/strict";
import { act, draw, surface } from "./support/harness.js";

const g = globalThis as any;
const dispatch = async (el: Element | Document, event: Event) => { await act(async () => { el.dispatchEvent(event); }); };
const escape = () => dispatch(document, new g.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

test("feedback: PulseIndicator carries its props as CSS variables and a label for screen readers", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b"] },
    { id: "a", component: "PulseIndicator" },
    { id: "b", component: "PulseIndicator", label: { "@path": "/label" }, color: "danger", pulseColor: "#f00", duration: 800, endScale: 3, startOpacity: 0.4, size: 8 },
  ], { label: "Recording" }));
  assert.deepEqual(d.errors, []);
  const [a, b] = d.$$(".ainui-pulse-indicator");
  assert.equal(a.getAttribute("aria-hidden"), "true"); assert.equal(a.hasAttribute("role"), false);
  assert.equal(a.style.getPropertyValue("--ainui-pulse-size"), "12px"); assert.equal(a.style.getPropertyValue("--ainui-pulse-duration"), "1500ms");
  assert.equal(a.style.getPropertyValue("--ainui-pulse-color"), "var(--ainui-success)"); assert.equal(a.style.getPropertyValue("--ainui-pulse-scale"), "2.4");
  assert.equal(b.getAttribute("role"), "img"); assert.equal(b.getAttribute("aria-label"), "Recording");
  assert.equal(b.style.getPropertyValue("--ainui-pulse-color"), "var(--ainui-danger)"); assert.equal(b.style.getPropertyValue("--ainui-pulse-ring"), "#f00");
  assert.equal(b.style.getPropertyValue("--ainui-pulse-duration"), "800ms"); assert.equal(b.style.getPropertyValue("--ainui-pulse-scale"), "3");
  assert.equal(b.style.getPropertyValue("--ainui-pulse-opacity"), "0.4"); assert.equal(b.style.getPropertyValue("--ainui-pulse-size"), "8px");
  assert.ok(b.querySelector(".ainui-pulse-indicator-ring") && b.querySelector(".ainui-pulse-indicator-dot"));
  await d.unmount();
});

test("feedback: FlashcardFlip flips between front and back", async () => {
  const d = await draw(surface([{ id: "root", component: "FlashcardFlip", front: "Capital of France?", back: { "@path": "/answer" }, hint: "Click to flip" }], { answer: "Paris" }));
  assert.deepEqual(d.errors, []);
  const card = d.$<HTMLButtonElement>("button.ainui-flashcard-flip")!;
  assert.equal(card.getAttribute("aria-pressed"), "false");
  assert.equal(d.$(".ainui-flashcard-flip-text")!.textContent, "Capital of France?");
  assert.equal(d.$(".ainui-flashcard-flip-hint")!.textContent, "Click to flip");
  await d.click("button.ainui-flashcard-flip");
  assert.equal(card.getAttribute("aria-pressed"), "true");
  assert.equal(d.$(".ainui-flashcard-flip-text")!.textContent, "Paris");
  assert.equal(d.$(".ainui-flashcard-flip-hint"), null);
  await d.click("button.ainui-flashcard-flip");
  assert.equal(d.$(".ainui-flashcard-flip-text")!.textContent, "Capital of France?");
  await d.unmount();
});

const popover = (extra: Record<string, unknown> = {}) => [
  { id: "root", component: "Column", children: ["pop", "state", "other"] },
  { id: "pop", component: "Popover", children: ["trig", "body"], ...extra },
  { id: "trig", component: "PopoverTrigger", children: ["trigText"], block: true }, { id: "trigText", component: "Text", text: "Options" },
  { id: "body", component: "PopoverContent", children: ["bodyText"], side: "top", align: "start", sideOffset: 10, width: 60 }, { id: "bodyText", component: "Text", text: "Inside" },
  { id: "state", component: "Text", text: { "@path": "/open" } }, { id: "other", component: "Text", text: "elsewhere" },
];

test("feedback: Popover toggles from its trigger, closes on Escape and outside clicks, and writes `open` back", async () => {
  const d = await draw(surface(popover({ open: { "@path": "/open" } }), { open: false }));
  assert.deepEqual(d.errors, []);
  const trigger = d.$<HTMLButtonElement>("button.ainui-popover-trigger.ainui-popover-trigger-block")!;
  const state = () => d.$$("p.ainui-text").find((p) => /true|false/.test(p.textContent!))!.textContent;
  assert.equal(trigger.getAttribute("aria-expanded"), "false"); assert.equal(trigger.textContent, "Options");
  assert.equal(trigger.querySelector("p"), null, "no paragraph inside a button");
  assert.equal(d.$(".ainui-popover-content"), null);
  await d.click(".ainui-popover-trigger");
  const content = d.$(".ainui-popover-content.ainui-popover-content-top.ainui-popover-content-align-start")!;
  assert.equal(content.getAttribute("role"), "dialog"); assert.match(content.textContent!, /Inside/);
  assert.equal(content.style.width, "240px"); assert.equal(content.style.getPropertyValue("--ainui-popover-offset"), "10px");
  assert.equal(trigger.getAttribute("aria-expanded"), "true"); assert.equal(trigger.getAttribute("aria-controls"), content.id);
  assert.equal(state(), "true", "open is written to the data model");
  await dispatch(content, new g.Event("pointerdown", { bubbles: true }));
  assert.ok(d.$(".ainui-popover-content"), "a press inside keeps it open");
  await escape();
  assert.equal(d.$(".ainui-popover-content"), null); assert.equal(state(), "false");
  await d.click(".ainui-popover-trigger");
  assert.ok(d.$(".ainui-popover-content"));
  await dispatch(d.$$("p.ainui-text").at(-1)!, new g.Event("pointerdown", { bubbles: true }));
  assert.equal(d.$(".ainui-popover-content"), null); assert.equal(state(), "false");
  await d.click(".ainui-popover-trigger"); await d.click(".ainui-popover-trigger");
  assert.equal(d.$(".ainui-popover-content"), null, "a second click closes it");
  await d.unmount();
});

test("feedback: Popover without a binding keeps local state and opens on hover after the delay", async () => {
  const d = await draw(surface(popover({ showOnHover: true, hoverOpenDelay: 40 })));
  assert.deepEqual(d.errors, []);
  await dispatch(d.$(".ainui-popover")!, new g.MouseEvent("mouseover", { bubbles: true }));
  assert.equal(d.$(".ainui-popover-content"), null, "not before the delay");
  await d.wait(80);
  assert.ok(d.$(".ainui-popover-content"));
  await dispatch(d.$(".ainui-popover")!, new g.MouseEvent("mouseout", { bubbles: true }));
  await d.wait(220);
  assert.equal(d.$(".ainui-popover-content"), null);
  await d.click(".ainui-popover-trigger");
  assert.ok(d.$(".ainui-popover-content"), "a click opens it without a binding");
  await d.unmount();
});

test("feedback: Modal opens from its trigger and closes with Escape, the close button and the backdrop", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["modal", "state"] },
    { id: "modal", component: "Modal", trigger: "t", content: "c", title: "Details", open: { "@path": "/open" }, maxWidth: 600 },
    { id: "t", component: "Text", text: "Show details" }, { id: "c", component: "Text", text: "The body" },
    { id: "state", component: "Text", text: { "@path": "/open" } },
  ], { open: false }));
  assert.deepEqual(d.errors, []);
  const state = () => d.$$(".ainui-column p.ainui-text").at(-1)!.textContent;
  const trigger = d.$(".ainui-modal-trigger")!;
  assert.equal(trigger.getAttribute("role"), "button"); assert.equal(trigger.tabIndex, 0);
  assert.equal(d.$("[role=dialog]"), null);
  await d.click(".ainui-modal-trigger");
  const dialog = d.$("[role=dialog]")!;
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.equal(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent, "Details");
  assert.match(d.$(".ainui-modal-body")!.textContent!, /The body/);
  assert.equal(dialog.style.maxWidth, "600px"); assert.ok(dialog.parentElement!.classList.contains("ainui-modal-backdrop"));
  assert.equal(document.activeElement, dialog); assert.equal(state(), "true");
  await escape();
  assert.equal(d.$("[role=dialog]"), null); assert.equal(state(), "false");
  assert.equal(document.activeElement, trigger, "focus returns to the trigger");
  await dispatch(trigger, new g.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.ok(d.$("[role=dialog]"), "Enter opens it");
  await d.click(".ainui-modal-close");
  assert.equal(d.$("[role=dialog]"), null); assert.equal(state(), "false");
  await d.click(".ainui-modal-trigger"); await d.click(".ainui-modal-dialog");
  assert.ok(d.$("[role=dialog]"), "a click inside the dialog keeps it open");
  await d.click(".ainui-modal-backdrop");
  assert.equal(d.$("[role=dialog]"), null);
  await d.append({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/open", value: true } });
  assert.ok(d.$("[role=dialog]"), "the agent opens it through the binding");
  await d.unmount();
});

test("feedback: Modal without a binding or title still works, and orphan popover parts do not throw", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["modal", "lone", "loneBody"] },
    { id: "modal", component: "Modal", trigger: "t", content: "c" },
    { id: "t", component: "Text", text: "Open" }, { id: "c", component: "Text", text: "Body" },
    { id: "lone", component: "PopoverTrigger", children: ["lt"] }, { id: "lt", component: "Text", text: "Lone" },
    { id: "loneBody", component: "PopoverContent", children: ["lt"] },
  ]));
  assert.deepEqual(d.errors, []);
  await d.click(".ainui-modal-trigger");
  const dialog = d.$("[role=dialog]")!;
  assert.equal(dialog.getAttribute("aria-label"), "Dialog"); assert.equal(dialog.style.maxWidth, "480px");
  await d.click(".ainui-modal-close");
  assert.equal(d.$("[role=dialog]"), null);
  await d.click(".ainui-popover-trigger");
  assert.equal(d.$(".ainui-popover-content"), null);
  await d.unmount();
});
