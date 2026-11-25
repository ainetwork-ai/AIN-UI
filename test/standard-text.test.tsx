import { test } from "node:test";
import assert from "node:assert/strict";
import { act, draw, surface } from "./support/harness.js";

const g = globalThis as any;
const dispatch = async (el: Element | Document, event: Event) => { await act(async () => { el.dispatchEvent(event); }); };

test("text: Title maps size to a heading level and applies the typography props", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["a", "b", "c", "d"] },
    { id: "a", component: "Title", text: "Default" },
    { id: "b", component: "Title", text: "Small", size: "sm", strong: false },
    { id: "c", component: "Title", text: { "@path": "/big" }, size: "2xl", color: "danger", textAlign: "center", truncate: true },
    { id: "d", component: "Title", text: "Clamped", size: "lg", maxLines: 2, fontWeight: "medium" },
  ], { big: "Big one" }));
  assert.deepEqual(d.errors, []);
  assert.equal(d.$("h3.ainui-title.ainui-title-md")!.textContent, "Default");
  assert.equal(d.$("h3.ainui-title-md")!.style.fontWeight, "700");
  assert.equal(d.$("h4.ainui-title-sm")!.style.fontWeight, "400");
  const big = d.$("h2.ainui-title-2xl.ainui-truncate")!;
  assert.equal(big.textContent, "Big one");
  assert.equal(big.style.color, "var(--ainui-danger)"); assert.equal(big.style.textAlign, "center");
  const clamped = d.$("h3.ainui-title-lg.ainui-clamp")!;
  assert.equal(clamped.style.fontWeight, "500");
  await d.unmount();
});

test("text: Text renders inline markdown as elements, inline children, numbers and its style props", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["p", "n", "s", "x"] },
    { id: "p", component: "Text", text: "A **bold** *it* ~~gone~~ ++under++ `x<y` [site](https://example.test/a) [bad](javascript:alert(1)) 2 * 3 * 4 ", children: ["b", "badge", "link"] },
    { id: "b", component: "Bold", text: "child" }, { id: "badge", component: "Badge", label: "New" },
    { id: "link", component: "Link", text: "docs", href: "https://example.test/docs" },
    { id: "n", component: "Text", text: { "@path": "/count" }, size: "xs", color: "secondary", tabularNums: true, weight: 1, inline: true },
    { id: "s", component: "Text", text: "<img src=x onerror=alert(1)>", fontSize: 18, lineHeight: 1.2, minLines: 2, underline: true, lineThrough: true, strong: true, highlight: "green", preserveWhitespace: true },
    { id: "x", component: "Text" },
  ], { count: 42 }));
  assert.deepEqual(d.errors, []);
  const p = d.$("p.ainui-text.ainui-text-md")!;
  assert.equal(p.querySelector("strong")!.textContent, "bold");
  assert.equal(p.querySelector("em")!.textContent, "it");
  assert.equal(p.querySelector("s")!.textContent, "gone");
  assert.equal(p.querySelector("u")!.textContent, "under");
  assert.equal(p.querySelector("code")!.textContent, "x<y");
  const a = p.querySelector("a")!;
  assert.equal(a.getAttribute("href"), "https://example.test/a"); assert.equal(a.getAttribute("rel"), "noopener noreferrer"); assert.equal(a.getAttribute("target"), "_blank");
  assert.match(p.textContent!, /\[bad\]\(javascript:alert\(1\)\) 2 \* 3 \* 4/, "an unsafe link stays text; lone asterisks are not emphasis");
  assert.equal(p.querySelector("strong.ainui-bold")!.textContent, "child");
  assert.equal(p.querySelector("span.ainui-badge")!.textContent, "New");
  assert.equal(p.querySelector("a.ainui-link[href='https://example.test/docs']")!.textContent, "docs");
  assert.equal(p.querySelectorAll("p").length, 0);
  const n = d.$("span.ainui-text-xs.ainui-text-inline")!;
  assert.equal(n.textContent, "42"); assert.equal(n.style.color, "var(--ainui-muted)"); assert.equal(n.style.flex, "1 1 0%");
  const s = d.$$("p.ainui-text")[1];
  assert.equal(s.querySelector("img"), null); assert.match(s.textContent!, /<img/);
  assert.equal(s.style.fontSize, "18px"); assert.equal(s.style.lineHeight, "1.2"); assert.equal(s.style.fontWeight, "600");
  assert.match(s.style.textDecoration, /underline line-through/); assert.equal(s.style.whiteSpace, "pre-wrap");
  assert.match(s.querySelector("mark.ainui-highlight")!.getAttribute("style")!, /--ainui-success-soft/);
  assert.equal(d.$$("p.ainui-text").length, 3);
  await d.unmount();
});

test("text: Caption, Label, the inline marks, Badge and Blockquote", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["cap", "lab", "t", "bq", "bd"] },
    { id: "cap", component: "Caption", text: "Updated **today**", size: "sm", color: "danger" },
    { id: "lab", component: "Label", text: "Email", htmlFor: "email", truncate: true },
    { id: "t", component: "Text", children: ["b", "i", "u", "s"] },
    { id: "b", component: "Bold", text: "B", fontWeight: "semibold" }, { id: "i", component: "Italic", text: "I" },
    { id: "u", component: "Underline", text: "U" }, { id: "s", component: "Strikethrough", text: { "@path": "/old" } },
    { id: "bq", component: "Blockquote", text: "To *be*" },
    { id: "bd", component: "Badge", label: "Failed", color: "danger", variant: "solid", size: "lg", pill: false, maxWidth: 80, padding: 1 },
  ], { old: "was" }));
  assert.deepEqual(d.errors, []);
  const cap = d.$(".ainui-caption.ainui-caption-sm")!;
  assert.equal(cap.querySelector("strong")!.textContent, "today"); assert.equal(cap.style.color, "var(--ainui-danger)");
  const lab = d.$("label.ainui-label.ainui-label-sm.ainui-truncate")!;
  assert.equal(lab.getAttribute("for"), "email"); assert.equal(lab.textContent, "Email"); assert.equal(lab.style.fontWeight, "500");
  const t = d.$("p.ainui-text")!;
  assert.equal(t.querySelector("strong")!.style.fontWeight, "600");
  assert.deepEqual([...t.querySelectorAll("strong, em, u, s")].map((e) => e.tagName), ["STRONG", "EM", "U", "S"]);
  assert.equal(t.querySelector("s")!.textContent, "was");
  assert.equal(d.$("blockquote.ainui-blockquote em")!.textContent, "be");
  const bd = d.$(".ainui-badge.ainui-badge-solid.ainui-badge-danger.ainui-badge-lg")!;
  assert.equal(bd.textContent, "Failed"); assert.ok(!bd.classList.contains("ainui-badge-pill"));
  assert.equal(bd.style.maxWidth, "80px"); assert.equal(bd.style.padding, "4px");
  await d.unmount();
});

test("text: Code is inline without a language and a block with a copy button with one", async () => {
  const copied: string[] = [];
  Object.defineProperty(g.navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { copied.push(t); } } });
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["inline", "block"] },
    { id: "inline", component: "Code", text: "npm test" },
    { id: "block", component: "Code", text: "const a = 1 < 2;\n", language: "ts\" onload=\"x" },
  ]));
  assert.deepEqual(d.errors, []);
  assert.equal(d.$(".ainui-column code.ainui-code")!.textContent, "npm test");
  const code = d.$(".ainui-code-block pre > code")!;
  assert.equal(code.className, "language-tsonloadx"); assert.equal(code.textContent, "const a = 1 < 2;\n");
  await d.click(".ainui-code-copy");
  assert.deepEqual(copied, ["const a = 1 < 2;\n"]);
  assert.equal(d.$(".ainui-code-copy")!.textContent, "Copied");
  await d.unmount();
});

test("text: Markdown renders sanitised HTML and keeps the previous HTML while streaming", async () => {
  const md = (text: string, streaming: boolean) => ({ version: "1.0", updateDataModel: { surfaceId: "s", path: "/", value: { md: text, live: streaming } } });
  const d = await draw(surface([
    { id: "root", component: "Markdown", text: { "@path": "/md" }, streaming: { "@path": "/live" } },
  ], { md: "# Hello\n\nSome **bold** and [a link](https://example.test/x)\n\n<script>alert(1)</script>", live: true }));
  await d.wait(50);
  assert.deepEqual(d.errors, []);
  const el = d.$(".ainui-markdown.ainui-markdown-streaming")!;
  assert.equal(el.getAttribute("aria-busy"), "true");
  assert.equal(el.querySelector("h1")!.textContent, "Hello"); assert.equal(el.querySelector("strong")!.textContent, "bold");
  assert.equal(el.querySelector("script"), null);
  assert.equal(el.querySelector("a")!.getAttribute("rel"), "noopener noreferrer");
  await d.append(md("# Hello\n\n- one\n- two", false));
  await d.wait(50);
  assert.deepEqual(d.errors, []);
  assert.equal(d.$$(".ainui-markdown li").length, 2);
  assert.equal(d.$(".ainui-markdown h1")!.textContent, "Hello");
  assert.equal(d.$(".ainui-markdown-streaming"), null);
  await d.unmount();
});

test("text: Math shows KaTeX output, or the TeX source when it cannot", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["m", "b"] },
    { id: "m", component: "Math", value: "x^2" },
    { id: "b", component: "Math", value: { "@path": "/tex" }, block: true },
  ], { tex: "\\frac{a}{b}" }));
  await d.wait(300);
  assert.deepEqual(d.errors, []);
  const inline = d.$("span.ainui-math")!, block = d.$("div.ainui-math.ainui-math-block")!;
  for (const [el, tex] of [[inline, "x^2"], [block, "\\frac{a}{b}"]] as const) {
    const source = el.querySelector("code.ainui-math-source");
    if (source) assert.equal(source.textContent, tex); else assert.ok(el.querySelector(".katex"), "KaTeX markup");
  }
  if (block.querySelector(".katex")) assert.ok(block.querySelector(".katex-display"), "block is display mode");
  await d.unmount();
});

test("text: ShimmerText and Link (only http, https and mailto become links)", async () => {
  const opened: string[] = [];
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["sh", "l1", "l2", "l3"] },
    { id: "sh", component: "ShimmerText", text: "Thinking…", size: "sm", color: "info", italic: true },
    { id: "l1", component: "Link", text: "Site", href: "https://example.test/", title: "Go" },
    { id: "l2", component: "Link", text: "Mail", href: "mailto:a@example.test" },
    { id: "l3", component: "Link", text: "Bad", href: "javascript:alert(1)" },
  ]), { openUrl: (u: string) => { opened.push(u); } });
  assert.deepEqual(d.errors, []);
  const sh = d.$("span.ainui-shimmer-text.ainui-shimmer-text-sm")!;
  assert.equal(sh.textContent, "Thinking…"); assert.equal(sh.getAttribute("aria-busy"), "true"); assert.equal(sh.style.fontStyle, "italic");
  assert.match(sh.getAttribute("style")!, /--ainui-shimmer-base:\s*var\(--ainui-info\)/);
  const [l1, l2, l3] = d.$$<HTMLAnchorElement>("a.ainui-link");
  assert.equal(l1.getAttribute("href"), "https://example.test/"); assert.equal(l1.title, "Go");
  assert.equal(l1.target, "_blank"); assert.equal(l1.rel, "noopener noreferrer");
  assert.equal(l2.getAttribute("href"), "mailto:a@example.test");
  assert.equal(l3.hasAttribute("href"), false); assert.equal(l3.textContent, "Bad");
  await d.click("a.ainui-link");
  assert.deepEqual(opened, ["https://example.test/"], "the host opens the link");
  await d.unmount();
});

test("text: Tooltip shows its content on hover and focus and describes the trigger", async () => {
  const d = await draw(surface([
    { id: "root", component: "Tooltip", trigger: "t", content: "c" },
    { id: "t", component: "Badge", label: "Beta" }, { id: "c", component: "Text", text: "Not final yet" },
  ]));
  assert.deepEqual(d.errors, []);
  const tip = d.$("[role=tooltip]")!, trigger = d.$(".ainui-tooltip-trigger")!;
  assert.equal(tip.hidden, true); assert.equal(tip.textContent, "Not final yet");
  assert.equal(tip.querySelector("p"), null, "content is phrasing-only");
  assert.equal(trigger.getAttribute("aria-describedby"), tip.id); assert.equal(trigger.textContent, "Beta");
  await dispatch(trigger, new g.MouseEvent("mouseover", { bubbles: true }));
  assert.equal(tip.hidden, false);
  await dispatch(trigger, new g.MouseEvent("mouseout", { bubbles: true }));
  assert.equal(tip.hidden, true);
  await act(async () => { trigger.focus(); });
  assert.equal(tip.hidden, false);
  await dispatch(trigger, new g.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(tip.hidden, true);
  await d.unmount();
});
