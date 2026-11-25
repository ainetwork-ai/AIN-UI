import { test } from "node:test";
import assert from "node:assert/strict";
import { act, draw, surface } from "./support/harness.js";

const event = (name: string, context: Record<string, unknown> = {}) => ({ event: { name, context } });
const key = async (el: Element, k: string) => {
  await act(async () => { el.dispatchEvent(new (globalThis as any).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
  await new Promise((r) => setTimeout(r, 20));
};
const labelOf = (d: Awaited<ReturnType<typeof draw>>, control: Element) => d.container.querySelector(`label[for="${control.id}"]`)?.textContent;

test("inputs: a button sends onClick, or its alias action, and keeps its class names", async () => {
  const d = await draw(surface([
    { id: "root", component: "Row", children: ["a", "b", "c", "e"] },
    { id: "a", component: "Button", label: "Save", variant: "primary", icon: "save", size: "sm", onClick: event("save", { id: 7 }) },
    { id: "b", component: "Button", text: "Old", variant: "borderless", tone: "danger", pill: false, action: event("legacy") },
    { id: "c", component: "Button", block: true, loading: true, color: "danger", children: ["ct"], onClick: event("never") },
    { id: "ct", component: "Text", text: "child content" },
    { id: "e", component: "Button", label: "Both", onClick: event("click-wins"), action: event("alias") },
  ]));
  assert.deepEqual(d.errors, []);
  const [a, b, c] = d.$$<HTMLButtonElement>(".ainui-button");
  assert.ok(a.classList.contains("ainui-button-primary") && a.classList.contains("ainui-button-sm") && a.classList.contains("ainui-button-pill"));
  assert.equal(a.type, "button");
  assert.equal(a.querySelector(".ainui-button-icon")!.getAttribute("data-icon"), "save");
  assert.match(a.textContent!, /Save/);
  assert.ok(b.classList.contains("ainui-button-ghost") && b.classList.contains("ainui-button-danger") && !b.classList.contains("ainui-button-pill"));
  assert.equal(b.textContent, "Old");
  assert.ok(c.disabled && c.classList.contains("ainui-button-block") && c.classList.contains("ainui-button-danger"));
  assert.equal(c.getAttribute("aria-busy"), "true");
  assert.ok(c.querySelector(".ainui-button-spinner"));
  assert.match(c.textContent!, /child content/);
  await d.click(".ainui-button-primary");
  await d.click(".ainui-button-ghost");
  await d.click(".ainui-button-loading");
  await d.click("a2ui-react-button:last-child .ainui-button");
  assert.deepEqual(d.actions.map((x) => x.name), ["save", "legacy", "click-wins"]);
  assert.deepEqual(d.actions[0].context, { id: 7 });
  await d.unmount();
});

test("inputs: a button asks before a confirmed action, opens href and copies text", async () => {
  const g = globalThis as any;
  const before = { confirm: g.confirm, clipboard: Object.getOwnPropertyDescriptor(g.navigator, "clipboard") };
  const asked: string[] = [], copied: string[] = [], opened: string[] = [];
  let answer = false;
  g.confirm = (text: string) => { asked.push(text); return answer; };
  Object.defineProperty(g.navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { copied.push(t); } } });
  try {
    const d = await draw(surface([
      { id: "root", component: "Row", children: ["del", "link", "bad", "copy"] },
      { id: "del", component: "Button", label: "Delete", confirm: "Delete it?", onClick: event("delete") },
      { id: "link", component: "Button", label: "Docs", href: "https://example.test/docs", onClick: event("never") },
      { id: "bad", component: "Button", label: "Bad", href: "javascript:alert(1)" },
      { id: "copy", component: "Button", label: "Copy", copy: "abc-123", onClick: event("never") },
    ]), { openUrl: (u: string) => { opened.push(u); } });
    assert.deepEqual(d.errors, []);
    const buttons = d.$$<HTMLButtonElement>(".ainui-button");
    await act(async () => { buttons[0].click(); });
    assert.deepEqual(asked, ["Delete it?"]);
    assert.equal(d.actions.length, 0, "declined: nothing is sent");
    answer = true;
    await act(async () => { buttons[0].click(); });
    await d.wait();
    assert.deepEqual(d.actions.map((x) => x.name), ["delete"]);
    await act(async () => { buttons[1].click(); buttons[2].click(); });
    assert.deepEqual(opened, ["https://example.test/docs"]);
    await act(async () => { buttons[3].click(); });
    await d.wait();
    assert.deepEqual(copied, ["abc-123"]);
    assert.equal(buttons[3].getAttribute("data-copied"), "");
    assert.equal(buttons[3].querySelector(".ainui-button-icon")!.getAttribute("data-icon"), "check");
    assert.equal(d.actions.length, 1, "href and copy send no action");
    await d.unmount();
  } finally {
    g.confirm = before.confirm;
    if (before.clipboard) Object.defineProperty(g.navigator, "clipboard", before.clipboard); else delete g.navigator.clipboard;
  }
});

test("inputs: checks disable a button and show their message under a field until they pass", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["name", "agree", "go"] },
    { id: "name", component: "TextField", label: "Name", value: { "@path": "/name" }, checks: [
      { condition: { "@call": "required", args: { value: { "@path": "/name" } } }, message: "Name is required" },
      { condition: { "@call": "length", args: { value: { "@path": "/name" }, min: 3 } } },
    ] },
    { id: "agree", component: "CheckBox", label: "I agree", value: { "@path": "/agree" } },
    { id: "go", component: "Button", label: "Go", onClick: event("go", { name: { "@path": "/name" } }), checks: [
      { condition: { "@call": "and", args: { values: [{ "@call": "length", args: { value: { "@path": "/name" }, min: 3 } }, { "@path": "/agree" }] } }, message: "Fill the form" },
    ] },
  ], { name: "", agree: false }));
  assert.deepEqual(d.errors, []);
  const input = d.$<HTMLInputElement>(".ainui-text-field input")!;
  const button = d.$<HTMLButtonElement>(".ainui-button")!;
  assert.equal(d.$(".ainui-field-error")!.textContent, "Name is required");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(input.getAttribute("aria-describedby"), d.$(".ainui-field-error")!.id);
  assert.equal(button.disabled, true);
  assert.equal(button.title, "Fill the form");
  await d.type(".ainui-text-field input", "Al");
  assert.equal(d.$(".ainui-field-error")!.textContent, "Minimum length is 3.");
  await d.type(".ainui-text-field input", "Alice");
  assert.equal(d.$(".ainui-field-error"), null);
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(button.disabled, true, "the checkbox half still fails");
  await d.click(".ainui-check-box input");
  assert.equal(button.disabled, false);
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { name: "Alice" });
  assert.deepEqual(d.errors, []);
  await d.unmount();
});

test("inputs: a pressable sends onClick by click, Enter and Space, but not for a control inside it", async () => {
  const opened: string[] = [];
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["p", "off", "link"] },
    { id: "p", component: "Pressable", padding: 3, tooltip: "Open it", ariaPressed: true, hoverBackground: "info", onClick: event("open", { id: "x" }), children: ["t", "inner"] },
    { id: "t", component: "Text", text: "Row" },
    { id: "inner", component: "Button", label: "Inner", onClick: event("inner") },
    { id: "off", component: "Pressable", disabled: true, onClick: event("never"), children: [] },
    { id: "link", component: "Pressable", href: "https://example.test/x", onClick: event("never"), children: [] },
  ]), { openUrl: (u: string) => { opened.push(u); } });
  assert.deepEqual(d.errors, []);
  const [p, off, link] = d.$$(".ainui-pressable");
  assert.equal(p.getAttribute("role"), "button");
  assert.equal(p.getAttribute("tabindex"), "0");
  assert.equal(p.getAttribute("title"), "Open it");
  assert.equal(p.getAttribute("aria-pressed"), "true");
  assert.equal(p.style.padding, "12px");
  assert.equal(p.style.getPropertyValue("--ainui-pressable-hover"), "var(--ainui-info-soft)");
  await act(async () => { p.click(); });
  await key(p, "Enter");
  await key(p, " ");
  await key(p, "a");
  assert.deepEqual(d.actions.map((x) => x.name), ["open", "open", "open"]);
  assert.deepEqual(d.actions[0].context, { id: "x" });
  await d.click(".ainui-pressable .ainui-button");
  assert.deepEqual(d.actions.map((x) => x.name).slice(3), ["inner"]);
  assert.equal(off.getAttribute("aria-disabled"), "true");
  assert.equal(off.getAttribute("tabindex"), "-1");
  await act(async () => { off.click(); link.click(); });
  await d.wait();
  assert.equal(d.actions.length, 4);
  assert.equal(link.getAttribute("role"), "link");
  assert.deepEqual(opened, ["https://example.test/x"]);
  await d.unmount();
});

test("inputs: a form sends onSubmit from its submit button and from Enter in a field", async () => {
  const d = await draw(surface([
    { id: "root", component: "Form", label: "Sign up", gap: 4, onSubmit: event("signup", { email: { "@path": "/email" } }), children: ["email", "note", "send", "other"] },
    { id: "email", component: "TextField", label: "Email", variant: "email", value: { "@path": "/email" } },
    { id: "note", component: "TextArea", label: "Note", value: { "@path": "/note" } },
    { id: "send", component: "Button", label: "Send", submit: true, variant: "primary" },
    { id: "other", component: "Button", label: "Other", onClick: event("other") },
  ], { email: "", note: "" }));
  assert.deepEqual(d.errors, []);
  const form = d.$<HTMLFormElement>("form.ainui-form")!;
  assert.equal(form.getAttribute("aria-label"), "Sign up");
  assert.equal(form.style.gap, "16px");
  assert.equal(d.$<HTMLButtonElement>(".ainui-button-primary")!.type, "submit");
  await d.type("input[type=email]", "a@b.co");
  await d.click(".ainui-button-primary");
  assert.deepEqual(d.actions.map((x) => x.name), ["signup"]);
  assert.deepEqual(d.actions[0].context, { email: "a@b.co" });
  await key(d.$("input[type=email]")!, "Enter");
  assert.deepEqual(d.actions.map((x) => x.name), ["signup", "signup"]);
  await key(d.$("textarea")!, "Enter");
  assert.equal(d.actions.length, 2, "Enter in a multi-line field is a new line");
  await d.click("a2ui-react-button:last-child .ainui-button");
  assert.deepEqual(d.actions.map((x) => x.name), ["signup", "signup", "other"]);
  await d.unmount();
});

test("inputs: a button with submit outside a form is an ordinary button", async () => {
  const d = await draw(surface([{ id: "root", component: "Button", label: "Send", submit: true, onClick: event("send") }]));
  assert.equal(d.$<HTMLButtonElement>(".ainui-button")!.type, "button");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions.map((x) => x.name), ["send"]);
  assert.deepEqual(d.errors, []);
  await d.unmount();
});

test("inputs: a text field has a wired label, follows its variant and writes back", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["name", "age", "pw", "long", "tel", "echo", "sum"] },
    { id: "name", component: "TextField", label: "Name", placeholder: "Your name", required: true, name: "n", size: "md", value: { "@path": "/name" } },
    { id: "age", component: "TextField", label: "Age", variant: "number", value: { "@path": "/age" } },
    { id: "pw", component: "TextField", label: "Password", variant: "obscured", disabled: true, invalid: true, pill: false, value: "x" },
    { id: "long", component: "TextField", label: "Bio", variant: "longText", value: { "@path": "/bio" } },
    { id: "tel", component: "TextField", label: "Phone", variant: "tel", mask: "###-####", value: { "@path": "/tel" } },
    { id: "echo", component: "Text", text: { "@path": "/name" } },
    { id: "sum", component: "Button", label: "Send", onClick: event("send", { age: { "@path": "/age" }, bio: { "@path": "/bio" }, tel: { "@path": "/tel" } }) },
  ], { name: "Ann", age: 30, bio: "", tel: "" }));
  assert.deepEqual(d.errors, []);
  const [name, age, pw, tel] = d.$$<HTMLInputElement>(".ainui-text-field input");
  assert.equal(labelOf(d, name), "Name *");
  assert.equal(name.value, "Ann");
  assert.equal(name.type, "text");
  assert.ok(name.required && name.name === "n" && name.placeholder === "Your name");
  assert.ok(name.classList.contains("ainui-input-md") && name.classList.contains("ainui-input-pill"));
  assert.equal(age.type, "number"); assert.equal(age.value, "30");
  assert.equal(pw.type, "password"); assert.ok(pw.disabled && !pw.classList.contains("ainui-input-pill"));
  assert.equal(pw.getAttribute("aria-invalid"), "true");
  assert.equal(tel.type, "tel");
  const bio = d.$<HTMLTextAreaElement>(".ainui-text-field textarea")!;
  assert.equal(labelOf(d, bio), "Bio");
  await d.type(`[id="${name.id}"]`, "Bea");
  assert.match(d.html(), /Bea<\//, "the bound Text follows the field");
  await d.type(`[id="${age.id}"]`, "42");
  await d.type(".ainui-text-field textarea", "line one\nline two");
  await d.type(`[id="${tel.id}"]`, "5551234");
  assert.equal(tel.value, "555-1234");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { age: 42, bio: "line one\nline two", tel: "555-1234" });
  await d.append({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/name", value: "Cy" } });
  assert.equal(name.value, "Cy", "a value set by the agent replaces the draft");
  assert.deepEqual(d.errors, []);
  await d.unmount();
});

test("inputs: a text area honours rows and writes back", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "send"] },
    { id: "a", component: "TextArea", label: "Message", rows: 5, maxRows: 8, autoResize: true, placeholder: "Write", required: true, name: "m", value: { "@path": "/msg" } },
    { id: "b", component: "TextArea", label: "Plain", disabled: true, invalid: true },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { msg: { "@path": "/msg" } }) },
  ], { msg: "hi" }));
  assert.deepEqual(d.errors, []);
  const [a, b] = d.$$<HTMLTextAreaElement>(".ainui-text-area textarea");
  assert.equal(labelOf(d, a), "Message *");
  assert.equal(a.rows, 5); assert.equal(a.value, "hi");
  assert.ok(a.classList.contains("ainui-input-auto-resize") && a.required && a.name === "m" && a.placeholder === "Write");
  assert.equal(b.rows, 3); assert.ok(b.disabled); assert.equal(b.getAttribute("aria-invalid"), "true");
  await d.type(".ainui-text-area textarea", "hello there");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { msg: "hello there" });
  await d.unmount();
});

test("inputs: a select takes string and object options, a placeholder and a clear option", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "send"] },
    { id: "a", component: "Select", label: "Fruit", placeholder: "Pick one", icon: "apple", block: true, options: ["Apple", { value: "pear", label: "Pear", description: "Green" }, { value: "fig" }], value: { "@path": "/fruit" } },
    { id: "b", component: "Select", label: "Size", clearable: true, clearLabel: "Any size", options: { "@path": "/sizes" }, value: { "@path": "/size" } },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { fruit: { "@path": "/fruit" }, size: { "@path": "/size" } }) },
  ], { fruit: "", size: "m", sizes: ["s", "m"] }));
  assert.deepEqual(d.errors, []);
  const [a, b] = d.$$<HTMLSelectElement>(".ainui-select select");
  assert.equal(labelOf(d, a), "Fruit");
  assert.deepEqual([...a.options].map((o) => [o.value, o.textContent, o.disabled]), [["", "Pick one", true], ["Apple", "Apple", false], ["pear", "Pear", false], ["fig", "fig", false]]);
  assert.equal(a.value, "");
  assert.ok(d.$(".ainui-select.ainui-field-block"));
  assert.equal(d.$(".ainui-select-icon")!.getAttribute("data-icon"), "apple");
  assert.deepEqual([...b.options].map((o) => [o.value, o.textContent]), [["", "Any size"], ["s", "s"], ["m", "m"]]);
  assert.equal(b.value, "m");
  await d.type(`[id="${a.id}"]`, "pear");
  await d.type(`[id="${b.id}"]`, "");
  assert.equal(a.value, "pear");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { fruit: "pear", size: "" });
  await d.unmount();
});

test("inputs: a select survives options that are not a list yet", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "c", "e"] },
    { id: "a", component: "Select", label: "Later", options: { "@path": "/missing" }, value: { "@path": "/v" } },
    { id: "b", component: "RadioGroup", label: "Later", options: { "@path": "/missing" } },
    { id: "c", component: "ChoicePicker", label: "Later", options: { "@path": "/missing" }, value: { "@path": "/missing" } },
    { id: "e", component: "SegmentedControl", label: "Later", options: { "@path": "/missing" } },
  ], { v: "kept" }));
  assert.deepEqual(d.errors, []);
  assert.equal(d.$<HTMLSelectElement>("select")!.value, "kept", "a value outside the options stays visible");
  assert.equal(d.$$("input[type=radio], [role=radio]").length, 0);
  await d.unmount();
});

test("inputs: a checkbox writes true and false", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "send"] },
    { id: "a", component: "CheckBox", label: "Done", shape: "square", lineThrough: true, name: "done", value: { "@path": "/done" } },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { done: { "@path": "/done" } }) },
  ], { done: false }));
  assert.deepEqual(d.errors, []);
  const box = d.$<HTMLInputElement>(".ainui-check-box input[type=checkbox]")!;
  assert.equal(labelOf(d, box), "Done");
  assert.equal(box.checked, false);
  assert.ok(d.$(".ainui-check-box-square"));
  assert.equal(d.$(".ainui-check-box-line-through"), null);
  await d.click(".ainui-check-box input");
  assert.equal(box.checked, true);
  assert.ok(d.$(".ainui-check-box-line-through"));
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { done: true });
  await d.click(".ainui-check-box input");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[1].context, { done: false });
  await d.unmount();
});

test("inputs: a lone radio is a labelled radio button", async () => {
  const d = await draw(surface([
    { id: "root", component: "Row", children: ["a", "b"] },
    { id: "a", component: "Radio", label: "Yes", value: "yes" },
    { id: "b", component: "Radio", label: "No", value: "no", disabled: true },
  ]));
  assert.deepEqual(d.errors, []);
  const [a, b] = d.$$<HTMLInputElement>(".ainui-radio input[type=radio]");
  assert.equal(labelOf(d, a), "Yes");
  assert.equal(a.value, "yes"); assert.equal(a.checked, false); assert.ok(b.disabled);
  await d.click(".ainui-radio input");
  assert.equal(a.checked, true);
  await d.unmount();
});

test("inputs: a radio group selects one option and writes it back", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "send"] },
    { id: "a", component: "RadioGroup", label: "Plan", variant: "cards", direction: "col", required: true, options: [{ value: "free", label: "Free", description: "For one person" }, { value: "pro", label: "Pro" }, "Team"], value: { "@path": "/plan" } },
    { id: "b", component: "RadioGroup", label: "Other", options: ["x", "y"], value: "x" },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { plan: { "@path": "/plan" } }) },
  ], { plan: "free" }));
  assert.deepEqual(d.errors, []);
  const group = d.$("[role=radiogroup]")!;
  assert.equal(d.container.querySelector(`[id="${group.getAttribute("aria-labelledby")}"]`)!.textContent, "Plan *");
  assert.ok(group.classList.contains("ainui-radio-group-cards") && group.classList.contains("ainui-radio-group-col"));
  const radios = [...group.querySelectorAll<HTMLInputElement>("input[type=radio]")];
  assert.deepEqual(radios.map((r) => [r.value, r.checked]), [["free", true], ["pro", false], ["Team", false]]);
  assert.equal(new Set(radios.map((r) => r.name)).size, 1);
  assert.match(group.textContent!, /For one person/);
  const other = d.$$("[role=radiogroup]")[1];
  assert.ok(other.classList.contains("ainui-radio-group-list") && other.classList.contains("ainui-radio-group-row"));
  assert.notEqual(other.querySelector("input")!.name, radios[0].name);
  await act(async () => { radios[2].click(); });
  await d.wait();
  assert.deepEqual(radios.map((r) => r.checked), [false, false, true]);
  assert.ok(radios[2].closest("label")!.classList.contains("ainui-selected"));
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { plan: "Team" });
  await d.unmount();
});

test("inputs: a slider writes numbers and shows its unit and marks", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "send"] },
    { id: "a", component: "Slider", label: "Volume", min: 0, max: 50, step: 5, unit: "%", marks: [{ value: 0, label: "Off" }, { value: 25 }, { value: 50, label: "Max" }, { value: 99 }], value: { "@path": "/vol" } },
    { id: "b", component: "Slider", label: "Steps", min: 10, max: 20, steps: 4, sliderStyle: "discrete", disabled: true },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { vol: { "@path": "/vol" } }) },
  ], { vol: 20 }));
  assert.deepEqual(d.errors, []);
  const [a, b] = d.$$<HTMLInputElement>(".ainui-slider input[type=range]");
  assert.equal(labelOf(d, a), "Volume");
  assert.deepEqual([a.min, a.max, a.step, a.value], ["0", "50", "5", "20"]);
  assert.equal(d.$(".ainui-slider-value")!.textContent, "20%");
  assert.deepEqual(d.$$(".ainui-slider-mark").map((m) => [m.textContent, m.style.left]), [["Off", "0%"], ["25", "50%"], ["Max", "100%"]]);
  assert.deepEqual([b.min, b.max, b.step, b.value, b.disabled], ["10", "20", "2.5", "10", true]);
  assert.ok(d.$(".ainui-slider-discrete"));
  await d.type(`[id="${a.id}"]`, "35");
  assert.equal(d.$(".ainui-slider-value")!.textContent, "35%");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { vol: 35 });
  await d.unmount();
});

test("inputs: a segmented control selects by click and by arrow keys", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "send"] },
    { id: "a", component: "SegmentedControl", label: "View", block: true, variant: "solid", size: "sm", options: ["Day", { value: "week", label: "Week" }, { value: "month", label: "Month" }], value: { "@path": "/view" } },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { view: { "@path": "/view" } }) },
  ], { view: "Day" }));
  assert.deepEqual(d.errors, []);
  const group = d.$("[role=radiogroup]")!;
  assert.equal(d.container.querySelector(`[id="${group.getAttribute("aria-labelledby")}"]`)!.textContent, "View");
  assert.ok(group.classList.contains("ainui-segmented-control-solid") && group.classList.contains("ainui-segmented-control-block") && group.classList.contains("ainui-segmented-control-sm"));
  const segs = d.$$<HTMLButtonElement>("[role=radio]");
  const state = () => segs.map((s) => [s.textContent, s.getAttribute("aria-checked"), s.tabIndex]);
  assert.deepEqual(state(), [["Day", "true", 0], ["Week", "false", -1], ["Month", "false", -1]]);
  await act(async () => { segs[1].click(); });
  await d.wait();
  assert.deepEqual(state(), [["Day", "false", -1], ["Week", "true", 0], ["Month", "false", -1]]);
  await key(segs[1], "ArrowRight");
  assert.equal(segs[2].getAttribute("aria-checked"), "true");
  assert.equal(document.activeElement, segs[2]);
  await key(segs[2], "ArrowRight");
  assert.equal(segs[0].getAttribute("aria-checked"), "true", "arrows wrap around");
  await key(segs[0], "ArrowLeft");
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { view: "month" });
  await d.unmount();
});

test("inputs: a choice picker keeps a list of values, one or several, and filters", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["many", "one", "send"] },
    { id: "many", component: "ChoicePicker", label: "Toppings", variant: "multipleSelection", filterable: true, options: ["Ham", { value: "olive", label: "Olives", description: "Black" }, "Corn"], value: { "@path": "/toppings" } },
    { id: "one", component: "ChoicePicker", label: "Crust", displayStyle: "chips", options: ["Thin", "Thick"], value: { "@path": "/crust" } },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { toppings: { "@path": "/toppings" }, crust: { "@path": "/crust" } }) },
  ], { toppings: ["Corn"], crust: [] }));
  assert.deepEqual(d.errors, []);
  const [many, one] = d.$$(".ainui-choice-picker-options");
  assert.equal(many.getAttribute("role"), "group");
  assert.equal(d.container.querySelector(`[id="${many.getAttribute("aria-labelledby")}"]`)!.textContent, "Toppings");
  const boxes = () => [...many.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
  assert.deepEqual(boxes().map((b) => [b.value, b.checked]), [["Ham", false], ["olive", false], ["Corn", true]]);
  await act(async () => { boxes()[0].click(); });
  await d.wait();
  await d.type(".ainui-choice-picker-filter", "oli");
  assert.deepEqual(boxes().map((b) => b.value), ["olive"]);
  await act(async () => { boxes()[0].click(); });
  await d.wait();
  await d.type(".ainui-choice-picker-filter", "zzz");
  assert.match(many.textContent!, /No matching options/);
  await d.type(".ainui-choice-picker-filter", "");
  assert.deepEqual(boxes().map((b) => b.checked), [true, true, true]);
  await act(async () => { boxes()[2].click(); });
  await d.wait();

  assert.equal(one.getAttribute("role"), "radiogroup");
  assert.ok(one.classList.contains("ainui-choice-picker-chips"));
  const radios = [...one.querySelectorAll<HTMLInputElement>("input[type=radio]")];
  assert.deepEqual(radios.map((r) => r.checked), [false, false]);
  await act(async () => { radios[0].click(); });
  await d.wait();
  await act(async () => { radios[1].click(); });
  await d.wait();
  assert.deepEqual(radios.map((r) => r.checked), [false, true]);
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { toppings: ["Ham", "olive"], crust: ["Thick"] });
  await d.unmount();
});

test("inputs: a date-time input picks date, time or both, and clears", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["day", "time", "both", "slot", "book", "send"] },
    { id: "day", component: "DateTimeInput", label: "Day", min: "2026-01-01", max: "2026-12-31T23:59", clearable: true, required: true, value: { "@path": "/day" } },
    { id: "time", component: "DateTimeInput", label: "Time", enableTime: true, value: { "@path": "/time" } },
    { id: "both", component: "DateTimeInput", label: "Start", enableDate: true, enableTime: true, block: true, value: { "@path": "/start" } },
    { id: "slot", component: "DateTimeInput", label: "Slot", enableTime: true, timeStep: 30, min: "09:00", max: "10:00", value: { "@path": "/slot" } },
    { id: "book", component: "DateTimeInput", label: "Booking", enableDate: true, enableTime: true, timeStep: 60, value: { "@path": "/book" } },
    { id: "send", component: "Button", label: "Send", onClick: event("send", { day: { "@path": "/day" }, time: { "@path": "/time" }, start: { "@path": "/start" }, slot: { "@path": "/slot" }, book: { "@path": "/book" } }) },
  ], { day: "2026-03-04", time: "", start: "2026-03-04T10:30:00Z", slot: "", book: "" }));
  assert.deepEqual(d.errors, []);
  const fields = d.$$(".ainui-date-time-input");
  const day = fields[0].querySelector<HTMLInputElement>("input")!;
  assert.equal(labelOf(d, day), "Day *");
  assert.deepEqual([day.type, day.value, day.min, day.max, day.required], ["date", "2026-03-04", "2026-01-01", "2026-12-31", true]);
  const time = fields[1].querySelector<HTMLInputElement>("input")!;
  assert.equal(time.type, "time");
  assert.equal(fields[1].querySelector(".ainui-date-time-input-clear"), null);
  const both = fields[2].querySelector<HTMLInputElement>("input")!;
  assert.deepEqual([both.type, both.value], ["datetime-local", "2026-03-04T10:30"]);
  assert.ok(fields[2].classList.contains("ainui-field-block"));
  const slot = fields[3].querySelector<HTMLSelectElement>("select")!;
  assert.equal(labelOf(d, slot), "Slot");
  assert.deepEqual([...slot.options].map((o) => o.value), ["", "09:00", "09:30", "10:00"]);
  const [bookDay, bookTime] = [fields[4].querySelector<HTMLInputElement>("input[type=date]")!, fields[4].querySelector<HTMLSelectElement>("select")!];
  assert.equal(bookTime.disabled, true, "a time needs its date first");
  assert.equal(bookTime.options.length, 25);

  await d.type(`[id="${time.id}"]`, "08:15");
  await d.type(`[id="${both.id}"]`, "2026-05-06T07:08");
  await d.type(`[id="${slot.id}"]`, "09:30");
  await d.type(`[id="${bookDay.id}"]`, "2026-07-08");
  assert.equal(bookTime.disabled, false);
  await d.type(`[id="${bookTime.id}"]`, "14:00");
  await d.click(".ainui-date-time-input-clear");
  assert.equal(day.value, "");
  assert.equal(fields[0].querySelector(".ainui-date-time-input-clear"), null);
  await d.click(".ainui-button");
  assert.deepEqual(d.actions[0].context, { day: "", time: "08:15", start: "2026-05-06T07:08", slot: "09:30", book: "2026-07-08T14:00" });
  assert.deepEqual(d.errors, []);
  await d.unmount();
});

test("inputs: every view survives missing and wrongly typed props", async () => {
  const names = ["Button", "Pressable", "Form", "TextField", "TextArea", "Select", "CheckBox", "Radio", "RadioGroup", "Slider", "SegmentedControl", "ChoicePicker", "DateTimeInput"];
  const d = await draw(surface([
    { id: "root", component: "Column", children: names.map((_, i) => `c${i}`) },
    ...names.map((component, i) => ({ id: `c${i}`, component })),
  ]));
  assert.deepEqual(d.errors, []);
  assert.equal(d.$$("[data-ainui-fallback]").length, 0);
  for (const cls of ["button", "pressable", "form", "text-field", "text-area", "select", "check-box", "radio", "radio-group", "slider", "segmented-control", "choice-picker", "date-time-input"])
    assert.ok(d.$(`.ainui-${cls}`), `.ainui-${cls} is drawn`);
  await d.unmount();
});
