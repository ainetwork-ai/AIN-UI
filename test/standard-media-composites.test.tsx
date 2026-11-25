import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, surface } from "./support/harness.js";

test("media: images, icons, vector drawings, players and sandboxed HTML", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["img", "bad", "asset", "icon", "path", "fav", "svg", "video", "audio", "html"] },
    { id: "img", component: "Image", url: "https://example.test/a.jpg", description: "A lake", fit: "cover", lightbox: true },
    { id: "bad", component: "Image", url: "javascript:alert(1)", description: "never loaded" },
    { id: "asset", component: "Image", url: { "@path": "/photo" }, description: "Private photo" },
    { id: "icon", component: "Icon", name: "arrowBack", label: "Back" },
    { id: "path", component: "Icon", name: { svgPath: "M4 12h16" } },
    { id: "fav", component: "Favicon", url: "https://ainetwork.ai/about" },
    { id: "svg", component: "Svg", viewBox: "0 0 10 10", label: "Dot", circles: [{ cx: 5, cy: 5, r: 4, fill: "danger" }], paths: { "@path": "/paths" } },
    { id: "video", component: "Video", url: "https://example.test/v.mp4", title: "Clip", posterUrl: "https://example.test/p.jpg" },
    { id: "audio", component: "AudioPlayer", url: "https://example.test/a.mp3", description: "Roar" },
    { id: "html", component: "HtmlView", html: "<script>parent.x=1</script><b>hi</b>", title: "Snippet", height: 120 },
  ], { paths: [{ d: "M0 0L10 10", onclick: "x" }], photo: { $asset: { drive_id: "d1", path: "Camera/p.jpg", variant: "original", mime: "image/jpeg" } } }));
  assert.deepEqual(d.errors, []);
  const sources = d.$$<HTMLImageElement>("img").map((i) => i.getAttribute("src"));
  assert.ok(sources.includes("https://example.test/a.jpg"));
  assert.ok(sources.includes("/files/Camera/p.jpg"), "an asset reference goes through the host's resolver");
  assert.ok(!sources.some((s) => s?.startsWith("javascript:")), "a script URL is never put in src");
  assert.equal(d.$("img[alt='A lake']")!.getAttribute("alt"), "A lake");
  const labelled = d.$(".ainui-icon[role=img]")!;
  assert.equal(labelled.getAttribute("aria-label"), "Back");
  assert.ok(d.$$(".ainui-icon").length >= 2);
  assert.match(d.$(".ainui-favicon img, img.ainui-favicon")?.getAttribute("src") ?? d.html(), /ainetwork\.ai/);
  const svg = d.$(".ainui-svg")!;
  assert.equal(svg.getAttribute("aria-label"), "Dot");
  assert.ok(svg.querySelector("circle"));
  assert.equal(svg.querySelector("path")!.getAttribute("onclick"), null, "only known drawing attributes are passed on");
  assert.ok(d.$(".ainui-video"));
  assert.match(d.html(), /v\.mp4|p\.jpg/);
  assert.equal(d.$("audio")!.getAttribute("src"), "https://example.test/a.mp3");
  const frame = d.$<HTMLIFrameElement>("iframe.ainui-html-view, .ainui-html-view iframe")!;
  assert.equal(frame.getAttribute("sandbox"), "", "no script, no same-origin access");
  assert.equal(frame.getAttribute("title"), "Snippet");
  assert.match(frame.getAttribute("srcdoc")!, /<b>hi<\/b>/);
  await d.click("img[alt='A lake']");
  assert.ok(d.$(".ainui-lightbox"), "a click opens the picture full-screen");
  await d.unmount();
});

test("composites: link card, citation, follow-ups, entity card and image grid", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["link", "text", "follow", "entity", "grid"] },
    { id: "link", component: "LinkCard", href: "https://a2ui.org/spec", title: "A2UI specification", description: "The protocol", domain: "a2ui.org" },
    { id: "text", component: "Text", text: "The sky scatters blue light.", children: ["cite"] },
    { id: "cite", component: "Citation", index: 1, title: "Rayleigh scattering", url: "https://example.test/rayleigh", snippet: "Shorter wavelengths scatter more.", source: "example.test" },
    { id: "follow", component: "FollowUp", title: "Next", items: ["Why are sunsets red?", { label: "And clouds?", message: "Why are clouds white?" }], onFollowUp: { event: { name: "asked" } } },
    { id: "entity", component: "EntityCard", title: "Pour-over kettle", subtitle: "Kitchen", description: "Gooseneck, 1 L", meta: "$39", badge: { label: "New", color: "success" }, rating: 4.5, ratingCount: 128,
      actions: [{ label: "Add to cart" }, { label: "Details", variant: "outline" }], onAction: { event: { name: "entity.action", context: { sku: "K-1" } } } },
    { id: "grid", component: "ImageGrid", columns: 2, images: [{ url: "https://example.test/1.jpg", description: "One" }, { url: "https://example.test/2.jpg", description: "Two" }] },
  ]));
  assert.deepEqual(d.errors, []);
  const card = d.$(".ainui-link-card")!;
  assert.match(card.textContent!, /A2UI specification.*The protocol/s);
  assert.match(d.html(), /href="https:\/\/a2ui\.org\/spec"/);
  assert.match(d.html(), /rel="noopener noreferrer"/);
  const marker = d.$(".ainui-citation-marker")!;
  assert.match(marker.textContent!, /1/);
  assert.ok(d.$(".ainui-text .ainui-citation"), "the citation sits inside the sentence it supports");
  const pills = d.$$(".ainui-follow-up-item");
  assert.deepEqual(pills.map((p) => p.textContent), ["Why are sunsets red?", "And clouds?"]);
  await d.click(".ainui-follow-up-item:nth-of-type(2)");
  assert.deepEqual(d.sent, ["Why are clouds white?"], "a follow-up is the user's next message");
  assert.equal(d.actions[0].name, "asked"); assert.equal(d.actions[0].context.message, "Why are clouds white?");
  const entity = d.$(".ainui-entity-card")!;
  assert.match(entity.textContent!, /Pour-over kettle.*Kitchen/s);
  assert.match(entity.textContent!, /New/); assert.match(entity.textContent!, /128/);
  const buttons = Array.from(entity.querySelectorAll(".ainui-entity-card-actions button")) as HTMLElement[];
  assert.deepEqual(buttons.map((b) => b.textContent), ["Add to cart", "Details"]);
  await d.click(".ainui-entity-card-actions button");
  assert.equal(d.actions[1].name, "entity.action");
  assert.deepEqual(d.actions[1].context, { sku: "K-1", action: "Add to cart", label: "Add to cart" });
  assert.equal(d.$$(".ainui-image-grid-item").length, 2);
  await d.click(".ainui-image-grid-open");
  assert.ok(d.$(".ainui-lightbox"));
  await d.unmount();
});

test("media and composites survive missing and wrongly typed props", async () => {
  const names = ["Icon", "Favicon", "Svg", "FollowUp", "ImageGrid", "Citation"];
  const d = await draw(surface([
    { id: "root", component: "Column", children: names.map((n) => `c_${n}`) },
    ...names.map((n) => ({ id: `c_${n}`, component: n, ...(n === "Icon" ? { name: { "@path": "/missing" } } : n === "Favicon" ? { url: { "@path": "/missing" } } : {}) })),
  ]));
  assert.deepEqual(d.errors, []);
  await d.unmount();
});
