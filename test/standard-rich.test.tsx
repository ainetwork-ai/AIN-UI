import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";

const text = (el: Element | null) => el?.textContent?.trim() ?? "";

test("rich: Heading draws eyebrow, title at its level and subtitle", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["h1", "h3"] },
    { id: "h1", component: "Heading", text: { "@path": "/title" }, eyebrow: "Overview", subtitle: "Total volume up 18.4% on last week" },
    { id: "h3", component: "Heading", text: "Small", level: "3" },
  ], { title: "Weekly Signups" }));
  assert.deepEqual(d.errors, []);
  assert.equal(text(d.$(".ainui-heading-1 h1.ainui-heading-title")), "Weekly Signups");
  assert.equal(text(d.$(".ainui-heading-1 .ainui-eyebrow")), "Overview");
  assert.match(text(d.$(".ainui-heading-subtitle")), /18\.4%/);
  assert.equal(text(d.$(".ainui-heading-3 h3")), "Small");
  assert.equal(d.$$(".ainui-heading-3 .ainui-eyebrow").length, 0);
  await d.unmount();
});

test("rich: Section labels a group of children", async () => {
  const d = await draw(surface([
    { id: "root", component: "Section", eyebrow: "Trends", title: "Daily volume", description: "Monday through Sunday", children: ["a", "b"] },
    { id: "a", component: "Text", text: "first" }, { id: "b", component: "Text", text: "second" },
  ]));
  assert.deepEqual(d.errors, []);
  const section = d.$("section.ainui-section")!;
  const title = d.$("h3.ainui-section-title")!;
  assert.equal(section.getAttribute("aria-labelledby"), title.id);
  assert.equal(text(d.$(".ainui-section-titles .ainui-eyebrow")), "Trends");
  assert.equal(text(d.$(".ainui-section-description")), "Monday through Sunday");
  assert.match(text(d.$(".ainui-section-body")), /first.*second/);
  await d.unmount();
});

test("rich: Stat colours value and delta by tone, else by trend", async () => {
  const d = await draw(surface([
    { id: "root", component: "Row", children: ["signups", "churn", "flat", "plain"] },
    { id: "signups", component: "Stat", label: "Total signups", value: 3842, delta: "+18.4%", trend: "up", caption: "vs. 3,245 prior week" },
    { id: "churn", component: "Stat", label: "Trial churn", value: "2.1%", delta: "-0.4%", trend: "down", tone: "positive" },
    { id: "flat", component: "Stat", label: "Refunds", value: "12", delta: "-3", icon: "receipt" },
    { id: "plain", component: "Stat", label: "Seats", value: "48" },
  ]));
  assert.deepEqual(d.errors, []);
  const stats = d.$$(".ainui-stat");
  assert.equal(stats.length, 4);
  assert.ok(stats[0].classList.contains("ainui-stat-positive"));
  assert.equal(text(stats[0].querySelector(".ainui-stat-value")), "3,842");
  assert.equal(text(stats[0].querySelector(".ainui-delta")), "+18.4%");
  assert.ok(stats[0].querySelector(".ainui-delta svg"), "the delta has an arrow");
  assert.equal(text(stats[0].querySelector(".ainui-stat-caption")), "vs. 3,245 prior week");
  assert.ok(stats[1].classList.contains("ainui-stat-positive"), "a falling churn with tone positive stays positive");
  assert.ok(stats[1].querySelector(".ainui-delta-positive"));
  assert.ok(stats[2].classList.contains("ainui-stat-negative"), "a '-3' delta reads as down");
  assert.ok(stats[3].classList.contains("ainui-stat-neutral"));
  assert.equal(stats[3].querySelector(".ainui-delta"), null);
  await d.unmount();
});

test("rich: StatGroup draws one cell per item with trend colours", async () => {
  const d = await draw(surface([
    { id: "root", component: "StatGroup", items: { "@path": "/kpis" } },
  ], { kpis: [{ label: "MRR", value: "$84k", delta: "+4.2%", trend: "up" }, { label: "Churn", value: "1.9%", delta: "+0.3%", trend: "down" }, { label: "NPS", value: 61 }] }));
  assert.deepEqual(d.errors, []);
  const cells = d.$$(".ainui-stat-group .ainui-stat-group-item");
  assert.equal(cells.length, 3);
  assert.ok(cells[0].classList.contains("ainui-stat-positive"));
  assert.ok(cells[1].classList.contains("ainui-stat-negative"));
  assert.ok(cells[2].classList.contains("ainui-stat-neutral"));
  assert.equal(text(cells[2].querySelector(".ainui-stat-value")), "61");
  await d.unmount();
});

test("rich: Sparkline draws a line, a gradient area and the latest value", async () => {
  const d = await draw(surface([
    { id: "root", component: "Sparkline", label: "Active users", values: [12, 18, 15, 22, 27, 31], delta: "+12%", tone: "positive" },
  ]));
  assert.deepEqual(d.errors, []);
  const root = d.$(".ainui-sparkline")!;
  assert.ok(root.classList.contains("ainui-sparkline-positive"));
  assert.equal(text(d.$(".ainui-sparkline-value")), "31", "the latest value is shown when value is not given");
  const paths = d.$$(".ainui-sparkline-chart path");
  assert.equal(paths.length, 2);
  const grad = d.$("linearGradient")!;
  assert.equal(paths[0].getAttribute("fill"), `url(#${grad.id})`);
  assert.equal(paths[1].getAttribute("d")!.split("L").length, 6);
  assert.ok(d.$(".ainui-delta-positive"));
  await d.unmount();
});

test("rich: Progress clamps its value and exposes a progressbar", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["p1", "p2"] },
    { id: "p1", component: "Progress", label: "Budget used", value: { "@path": "/used" }, caption: "$7,200 of $10,000", tone: "warning" },
    { id: "p2", component: "Progress", label: "Over", value: 140 },
  ], { used: 72 }));
  assert.deepEqual(d.errors, []);
  const bars = d.$$("[role=progressbar]");
  assert.equal(bars[0].getAttribute("aria-valuenow"), "72");
  assert.equal(bars[0].getAttribute("aria-label"), "Budget used");
  assert.equal(d.$<HTMLElement>(".ainui-progress-warning .ainui-progress-fill")!.style.width, "72%");
  assert.equal(text(d.$(".ainui-progress-percent")), "72%");
  assert.equal(text(d.$(".ainui-progress-caption")), "$7,200 of $10,000");
  assert.equal(bars[1].getAttribute("aria-valuenow"), "100");
  assert.ok(d.$$(".ainui-progress")[1].classList.contains("ainui-progress-accent"));
  await d.unmount();
});

test("rich: Callout shows its note and fires onAction from its button", async () => {
  const d = await draw(surface([
    { id: "root", component: "Callout", icon: "💡", title: "Tip", text: "Referral links convert 3× better.", actionLabel: "Copy link", onAction: { event: { name: "copy_link", context: { source: "callout" } } } },
  ]));
  assert.deepEqual(d.errors, []);
  assert.equal(text(d.$(".ainui-callout-icon")), "💡");
  assert.equal(text(d.$(".ainui-callout-title")), "Tip");
  assert.match(text(d.$(".ainui-callout-text")), /3× better/);
  await d.click(".ainui-callout-action");
  assert.equal(d.actions.length, 1);
  assert.equal(d.actions[0].name, "copy_link");
  assert.deepEqual(d.actions[0].context, { source: "callout" });
  await d.unmount();
});

test("rich: Alert picks role and tint by tone", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["e", "s", "x"] },
    { id: "e", component: "Alert", tone: "error", title: "Payment failed", message: "The card was declined." },
    { id: "s", component: "Alert", tone: "success", title: "Saved" },
    { id: "x", component: "Alert", title: "Heads up" },
  ]));
  assert.deepEqual(d.errors, []);
  const alerts = d.$$(".ainui-alert");
  assert.equal(alerts[0].getAttribute("role"), "alert");
  assert.ok(alerts[0].classList.contains("ainui-alert-error"));
  assert.equal(text(alerts[0].querySelector(".ainui-alert-message")), "The card was declined.");
  assert.equal(alerts[1].getAttribute("role"), "status");
  assert.ok(alerts[1].classList.contains("ainui-alert-success"));
  assert.equal(alerts[1].querySelector(".ainui-alert-message"), null);
  assert.ok(alerts[2].classList.contains("ainui-alert-info"), "info is the default tone");
  await d.unmount();
});

test("rich: Avatar draws initials with a stable hue, an image, and a status dot", async () => {
  const d = await draw(surface([
    { id: "root", component: "Row", children: ["a", "b", "c"] },
    { id: "a", component: "Avatar", name: "Maya Okafor", subtitle: "Product lead", status: "online", size: "lg" },
    { id: "b", component: "Avatar", name: "Daniel Reyes", image: "https://example.test/d.jpg", size: "sm" },
    { id: "c", component: "Avatar", name: "Maya Okafor", image: "javascript:alert(1)" },
  ]));
  assert.deepEqual(d.errors, []);
  const avatars = d.$$(".ainui-avatar");
  assert.ok(avatars[0].classList.contains("ainui-avatar-lg"));
  assert.equal(text(avatars[0].querySelector(".ainui-avatar-circle")), "MO");
  assert.equal(text(avatars[0].querySelector(".ainui-avatar-subtitle")), "Product lead");
  assert.equal(avatars[0].querySelector(".ainui-avatar-status-online")!.getAttribute("aria-label"), "online");
  assert.equal(avatars[1].querySelector("img")!.getAttribute("src"), "https://example.test/d.jpg");
  assert.equal(avatars[2].querySelector("img"), null, "an unsafe URL falls back to initials");
  const bg = (el: Element) => (el.querySelector(".ainui-avatar-circle") as HTMLElement).style.background;
  assert.match(bg(avatars[0]), /^var\(--ainui-[a-z]+-soft\)$/);
  assert.equal(bg(avatars[0]), bg(avatars[2]), "the same name gets the same hue");
  await d.unmount();
});

test("rich: KeyValueList draws label/value rows in columns", async () => {
  const d = await draw(surface([
    { id: "root", component: "KeyValueList", title: "Order", columns: 2, items: [
      { label: "Order", value: "#10482" }, { label: "Total", value: 128.5, hint: "incl. VAT" }, { label: "Ship to", value: "Lisbon" },
    ] },
  ]));
  assert.deepEqual(d.errors, []);
  assert.equal(text(d.$(".ainui-kv-title")), "Order");
  assert.ok(d.$("dl.ainui-kv-grid.ainui-kv-columns-2"));
  const rows = d.$$(".ainui-kv-row");
  assert.equal(rows.length, 3);
  assert.equal(text(rows[1].querySelector("dd")), "128.5");
  assert.equal(text(rows[1].querySelector(".ainui-kv-hint")), "incl. VAT");
  await d.unmount();
});

test("rich: Timeline marks done, current and upcoming steps", async () => {
  const d = await draw(surface([
    { id: "root", component: "Timeline", items: { "@path": "/steps" } },
  ], { steps: [
    { title: "Order placed", time: "09:12", status: "done" },
    { title: "Packed", time: "11:40", description: "Two boxes", status: "current" },
    { title: "Delivered", status: "upcoming" },
  ] }));
  assert.deepEqual(d.errors, []);
  const items = d.$$("ol.ainui-timeline > li");
  assert.equal(items.length, 3);
  assert.ok(items[0].classList.contains("ainui-timeline-done"));
  assert.ok(items[0].querySelector(".ainui-timeline-marker svg"), "done shows a check");
  assert.equal(items[1].getAttribute("aria-current"), "step");
  assert.equal(text(items[1].querySelector(".ainui-timeline-description")), "Two boxes");
  assert.equal(text(items[1].querySelector(".ainui-timeline-time")), "11:40");
  assert.ok(items[2].classList.contains("ainui-timeline-upcoming"));
  await d.unmount();
});

test("rich: TagList draws chips in its tone", async () => {
  const d = await draw(surface([
    { id: "root", component: "TagList", tags: ["React", "TypeScript", "A2UI"], tone: "info" },
  ]));
  assert.deepEqual(d.errors, []);
  assert.ok(d.$("ul.ainui-tag-list.ainui-tag-list-info"));
  assert.deepEqual(d.$$("li.ainui-tag").map(text), ["React", "TypeScript", "A2UI"]);
  await d.unmount();
});

test("rich: EmptyState centres a hint and fires onAction", async () => {
  const d = await draw(surface([
    { id: "root", component: "EmptyState", icon: "search", title: "No matches", description: "Try a shorter query.", actionLabel: "Clear filters", onAction: { event: { name: "clear" } } },
  ]));
  assert.deepEqual(d.errors, []);
  assert.ok(d.$(".ainui-empty-state-icon svg"));
  assert.equal(text(d.$(".ainui-empty-state-title")), "No matches");
  await d.click(".ainui-empty-state-action");
  assert.equal(d.actions[0].name, "clear");
  await d.unmount();
});

test("rich: missing and wrong-typed props never throw", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["h", "s", "st", "sg", "sp", "p", "c", "al", "av", "kv", "tl", "tg", "e"] },
    { id: "h", component: "Heading", text: { "@path": "/missing" } },
    { id: "s", component: "Section", title: "Empty", children: [] },
    { id: "st", component: "Stat", label: "x", value: { "@path": "/missing" } },
    { id: "sg", component: "StatGroup", items: { "@path": "/notList" } },
    { id: "sp", component: "Sparkline", values: { "@path": "/notList" } },
    { id: "p", component: "Progress", value: { "@path": "/word" } },
    { id: "c", component: "Callout", text: { "@path": "/missing" } },
    { id: "al", component: "Alert", title: { "@path": "/missing" } },
    { id: "av", component: "Avatar", name: { "@path": "/missing" } },
    { id: "kv", component: "KeyValueList", items: { "@path": "/notList" } },
    { id: "tl", component: "Timeline", items: { "@path": "/mixed" } },
    { id: "tg", component: "TagList", tags: { "@path": "/mixed" } },
    { id: "e", component: "EmptyState", title: "Nothing", actionLabel: "Go" },
  ], { notList: "nope", word: "lots", mixed: [null, 3, "text", { title: 5 }] }));
  assert.deepEqual(d.errors.map((e) => e.message), []);
  assert.equal(text(d.$(".ainui-stat-value")), "—");
  assert.equal(d.$$(".ainui-stat-group-item").length, 0);
  assert.equal(d.$(".ainui-sparkline-chart"), null);
  assert.equal(d.$("[role=progressbar]")!.getAttribute("aria-valuenow"), "0");
  assert.equal(text(d.$(".ainui-avatar-circle")), "?");
  assert.deepEqual(d.$$(".ainui-timeline-title").map(text), ["5"], "only object items with a title are drawn");
  assert.deepEqual(d.$$(".ainui-tag").map(text), ["3", "text"]);
  assert.equal(d.$<HTMLButtonElement>(".ainui-empty-state-action")!.disabled, true, "a button with no action is disabled");
  await d.unmount();
});
