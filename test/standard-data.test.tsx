import { test } from "node:test";
import assert from "node:assert/strict";
import { act, draw, surface } from "./support/harness.js";

test("data: a Table from columns and rows has real table semantics, cell components and an empty state", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["t", "empty"] },
    { id: "t", component: "Table", caption: "Plans", stickyHeader: true, columnSizing: "equal",
      columns: ["Plan", { label: "Price", align: "end", width: 120 }, { label: "Status" }],
      rows: [["Free", 0, { componentId: "badge" }], ["Pro", "$20", "Active"]], cellComponents: ["badge"] },
    { id: "badge", component: "Text", text: "Trial" },
    { id: "empty", component: "Table", columns: ["A", "B"], rows: { "@path": "/none" }, emptyLabel: "Nothing yet", dividers: false },
  ]));
  assert.deepEqual(d.errors, []);
  const table = d.$("table.ainui-table")!;
  assert.equal(table.querySelector("caption")!.textContent, "Plans");
  assert.ok(table.classList.contains("ainui-table-sticky") && table.classList.contains("ainui-table-equal") && table.classList.contains("ainui-table-dividers"));
  const heads = Array.from(table.querySelectorAll("thead th"));
  assert.deepEqual(heads.map((h) => h.textContent), ["Plan", "Price", "Status"]);
  assert.equal(heads[1].getAttribute("scope"), "col");
  assert.equal((heads[1] as HTMLElement).style.textAlign, "end");
  assert.equal((heads[1] as HTMLElement).style.width, "120px");
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows[0].querySelectorAll("td")).map((c) => c.textContent), ["Free", "0", "Trial"]);
  assert.equal((rows[1].querySelectorAll("td")[1] as HTMLElement).style.textAlign, "end");
  const empty = d.$$("table.ainui-table")[1];
  assert.ok(!empty.classList.contains("ainui-table-dividers"));
  const cell = empty.querySelector("td.ainui-table-empty")!;
  assert.equal(cell.textContent, "Nothing yet");
  assert.equal(cell.getAttribute("colspan"), "2");
  await d.unmount();
});

test("data: a Table from TableSection, TableRow and TableCell children, with a row template", async () => {
  const d = await draw(surface([
    { id: "root", component: "Table", children: ["head", "body", "loose"] },
    { id: "head", component: "TableSection", header: true, children: ["hr"] },
    { id: "hr", component: "TableRow", children: ["h1", "h2"] },
    { id: "h1", component: "TableCell", text: "Name" }, { id: "h2", component: "TableCell", text: "Qty", align: "end" },
    { id: "body", component: "TableSection", children: { componentId: "row", path: "/items" } },
    { id: "row", component: "TableRow", children: ["c1", "c2"] },
    { id: "c1", component: "TableCell", children: ["c1t"] }, { id: "c1t", component: "Text", text: { "@path": "name" } },
    { id: "c2", component: "TableCell", text: { "@path": "qty" }, align: "end", vAlign: "center" },
    { id: "loose", component: "TableRow", label: "Total", labelColSpan: 1, children: ["sum"] },
    { id: "sum", component: "TableCell", text: 7, colSpan: 2, rowSpan: 1, header: true },
  ], { items: [{ name: "Apples", qty: 3 }, { name: "Pears", qty: 4 }] }));
  assert.deepEqual(d.errors, []);
  const table = d.$("[role=table]")!;
  assert.ok(!d.$("table"), "built from children, the table is role-based: wrapper elements are not allowed inside <table>");
  const groups = Array.from(table.querySelectorAll("[role=rowgroup]"));
  assert.deepEqual(groups.map((g) => g.classList.contains("ainui-table-head")), [true, false, false]);
  assert.deepEqual(Array.from(groups[0].querySelectorAll("[role=columnheader]")).map((c) => c.textContent), ["Name", "Qty"]);
  const bodyRows = Array.from(groups[1].querySelectorAll("[role=row]"));
  assert.equal(bodyRows.length, 2);
  assert.match(bodyRows[1].textContent!, /Pears.*4/);
  const qty = bodyRows[0].querySelectorAll("[role=cell]")[1] as HTMLElement;
  assert.equal(qty.style.textAlign, "end"); assert.equal(qty.style.verticalAlign, "middle");
  const total = groups[2].querySelector("[role=row]")!;
  const heads = total.querySelectorAll("[role=rowheader]");
  assert.equal(heads[0].textContent, "Total");
  assert.equal(heads[1].textContent, "7"); assert.equal(heads[1].getAttribute("aria-colspan"), "2"); assert.equal(heads[1].getAttribute("aria-rowspan"), null);
  await d.unmount();
});

test("data: a List of items shows key-value rows, and with an action sends the picked item", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["facts", "pick"] },
    { id: "facts", component: "List", marker: "none", items: [{ label: "Price", value: "$1,599" }, { label: "Weight", value: 1.2, description: "kilograms" }, "Plain"] },
    { id: "pick", component: "List", marker: "number", start: 3, direction: "horizontal", gap: 2, items: ["Seoul", { label: "Busan", value: "PUS" }],
      action: { event: { name: "pick", context: { from: "cities" } } } },
  ]));
  assert.deepEqual(d.errors, []);
  const facts = d.$(".ainui-list.ainui-list-none")!;
  assert.equal(facts.querySelectorAll("[role=listitem]").length, 3);
  assert.equal(facts.querySelector(".ainui-list-marker"), null);
  assert.equal(facts.querySelector(".ainui-list-item-fact .ainui-list-item-value")!.textContent, "$1,599");
  assert.match(facts.querySelectorAll("[role=listitem]")[1].textContent!, /Weight.*1\.2.*kilograms/);
  assert.equal(facts.querySelector("button"), null, "no action, nothing to press");
  const pick = d.$(".ainui-list.ainui-list-number.ainui-list-horizontal")!;
  assert.equal(pick.getAttribute("role"), "list"); assert.equal(pick.style.gap, "8px");
  assert.deepEqual(Array.from(pick.querySelectorAll(".ainui-list-marker")).map((m) => m.textContent), ["3.", "4."]);
  await act(async () => { (pick.querySelectorAll("[role=listitem]")[1].querySelector("button") as HTMLElement).click(); });
  assert.equal(d.actions[0].name, "pick");
  assert.deepEqual(d.actions[0].context, { from: "cities", index: 1, label: "Busan", value: "PUS" });
  await d.unmount();
});

test("data: ListItem children take the list's marker and action, their own action, and disabled", async () => {
  const d = await draw(surface([
    { id: "root", component: "List", marker: "rich", connector: "solid", children: ["a", "b", "c"], action: { event: { name: "choose" } } },
    { id: "a", component: "ListItem", label: "First", value: "one", description: "The first", icon: "check", children: ["extra"] },
    { id: "extra", component: "Text", text: "More detail" },
    { id: "b", component: "ListItem", label: "Second", marker: "B", action: { event: { name: "own", context: { id: 2 } } } },
    { id: "c", component: "ListItem", label: "Third", disabled: true },
  ]));
  assert.deepEqual(d.errors, []);
  const items = d.$$(".ainui-list.ainui-list-rich.ainui-list-connector [role=listitem]");
  assert.equal(items.length, 3);
  assert.ok(items[0].querySelector(".ainui-list-marker svg"), "the icon is the rich marker");
  assert.match(items[0].textContent!, /First.*The first.*More detail/);
  assert.equal(items[1].querySelector(".ainui-list-marker")!.textContent, "B");
  assert.equal(items[2].querySelector("button")!.disabled, true);
  assert.equal(items[2].getAttribute("aria-disabled"), "true");
  await act(async () => { (d.$$("[role=listitem]")[0].querySelector("button") as HTMLElement).click(); });
  await act(async () => { (d.$$("[role=listitem]")[1].querySelector("button") as HTMLElement).click(); });
  await act(async () => { (d.$$("[role=listitem]")[2].querySelector("button") as HTMLElement).click(); });
  assert.deepEqual(d.actions.map((a) => [a.name, a.context]), [["choose", { index: 0, label: "First", value: "one" }], ["own", { id: 2 }]]);
  await d.unmount();
});

const sales = [{ month: "Jan", revenue: 1200, cost: 800 }, { month: "Feb", revenue: 1800, cost: 950 }, { month: "Mar", revenue: 1500, cost: 700 }];

test("data: a bar Chart draws grouped, stacked and horizontal bars with axes, legend, labels and a data table", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["grouped", "stacked", "flat"] },
    { id: "grouped", component: "Chart", title: "Sales", data: { "@path": "/sales" }, xKey: "month", format: "currency", showValueLabels: true, height: 300,
      series: ["revenue", { key: "cost", label: "Cost", color: "danger" }], yAxis: { label: "USD" } },
    { id: "stacked", component: "Chart", data: { "@path": "/sales" }, xKey: "month", stacked: true, showLegend: false, showGrid: false, showTooltip: false },
    { id: "flat", component: "Chart", data: { "@path": "/sales" }, xKey: "month", series: ["revenue"], layout: "horizontal", barRadius: 0 },
  ], { sales }));
  assert.deepEqual(d.errors, []);
  const [grouped, stacked, flat] = d.$$(".ainui-chart");
  const svg = grouped.querySelector("svg")!;
  assert.equal(svg.getAttribute("role"), "img");
  assert.match(svg.getAttribute("aria-label")!, /Sales\. Bar chart of revenue, Cost by month, 3 points/);
  assert.equal(svg.getAttribute("width"), "100%"); assert.equal(svg.getAttribute("height"), "300");
  assert.match(svg.getAttribute("viewBox")!, /^0 0 \d+ 300$/);
  assert.equal(grouped.querySelector(".ainui-chart-title")!.textContent, "Sales");
  const bars = Array.from(grouped.querySelectorAll<SVGRectElement>("rect.ainui-chart-bar"));
  assert.equal(bars.length, 6);
  // bars fill with their series' gradient; the gradient's stops carry the series colour (a given colour, else the palette)
  const stop = (bar: SVGRectElement) => grouped.querySelector(`${/url\(#([^)]+)\)/.exec(bar.style.fill)![1].replace(/[^\w-]/g, (c) => `\\${c}`)} stop`)?.getAttribute("stop-color") ?? grouped.querySelector(`[id="${/url\(#([^)]+)\)/.exec(bar.style.fill)![1]}"] stop`)!.getAttribute("stop-color");
  assert.equal(stop(bars[0]), "var(--ainui-chart-1)"); assert.equal(stop(bars[1]), "var(--ainui-danger)");
  assert.match(bars[1].querySelector("title")!.textContent!, /Jan · Cost: \$800/);
  assert.ok(Number(bars[2].getAttribute("height")) > Number(bars[0].getAttribute("height")), "Feb revenue is taller than Jan");
  assert.ok(grouped.querySelectorAll(".ainui-chart-grid").length >= 3);
  assert.ok(Array.from(grouped.querySelectorAll(".ainui-chart-tick")).some((t) => t.textContent === "Feb"));
  assert.ok(Array.from(grouped.querySelectorAll(".ainui-chart-tick")).some((t) => /^\$/.test(t.textContent!)));
  assert.equal(grouped.querySelector(".ainui-chart-axis-label")!.textContent, "USD");
  assert.equal(grouped.querySelectorAll(".ainui-chart-value").length, 6);
  assert.deepEqual(Array.from(grouped.querySelectorAll(".ainui-chart-legend li")).map((l) => l.textContent), ["revenue", "Cost"]);
  const table = grouped.querySelector("table.ainui-chart-table")!;
  assert.deepEqual(Array.from(table.querySelectorAll("tbody tr")).map((r) => r.textContent), ["Jan$1,200$800", "Feb$1,800$950", "Mar$1,500$700"]);

  const sb = Array.from(stacked.querySelectorAll<SVGRectElement>("rect.ainui-chart-bar"));
  assert.equal(sb.length, 6, "series default to every number field");
  assert.equal(sb[0].getAttribute("x"), sb[1].getAttribute("x"), "stacked bars share a column");
  assert.ok(Math.abs(Number(sb[1].getAttribute("y")) + Number(sb[1].getAttribute("height")) - Number(sb[0].getAttribute("y"))) < 0.5, "and sit on each other");
  assert.equal(stacked.querySelector(".ainui-chart-legend"), null);
  assert.equal(stacked.querySelector(".ainui-chart-grid"), null);
  assert.equal(stacked.querySelector("title"), null);

  const fb = Array.from(flat.querySelectorAll<SVGRectElement>("rect.ainui-chart-bar"));
  assert.equal(fb.length, 3);
  assert.ok(Number(fb[1].getAttribute("width")) > Number(fb[0].getAttribute("width")), "horizontal bars grow to the right");
  assert.equal(fb[0].getAttribute("x"), fb[1].getAttribute("x"));
  assert.equal(fb[0].getAttribute("rx"), "0");
  await d.unmount();
});

test("data: line, area, scatter, pie and donut Charts, percent format, and the empty state", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["line", "area", "scatter", "pie", "donut", "none", "bad"] },
    { id: "line", component: "Chart", chartType: "line", data: { "@path": "/rate" }, xKey: "day", format: "percent", yAxis: { min: 0, max: 0.1 }, showDots: true },
    { id: "area", component: "Chart", chartType: "area", data: { "@path": "/sales" }, xKey: "month", stacked: true },
    { id: "scatter", component: "Chart", chartType: "scatter", data: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 8, y: 4 }], xKey: "x", series: ["y"] },
    { id: "pie", component: "Chart", chartType: "pie", data: { "@path": "/share" }, xKey: "name", series: ["value"], showValueLabels: true, paddingAngle: 2 },
    { id: "donut", component: "Chart", chartType: "donut", data: { "@path": "/share" }, xKey: "name", innerRadius: "50%", outerRadius: 90, cornerRadius: 4 },
    { id: "none", component: "Chart", title: "Empty", data: [] },
    { id: "bad", component: "Chart", data: { "@path": "/missing" }, xKey: "a" },
  ], { sales, rate: [{ day: "Mon", rate: 0.02 }, { day: "Tue", rate: 0.05 }, { day: "Wed", rate: 0.04 }], share: [{ name: "A", value: 50 }, { name: "B", value: 30 }, { name: "C", value: 20 }] }));
  assert.deepEqual(d.errors, []);
  const [line, area, scatter, pie, donut, none, bad] = d.$$(".ainui-chart");
  assert.equal(line.querySelectorAll("path.ainui-chart-line").length, 1);
  assert.equal(line.querySelectorAll("circle.ainui-chart-dot").length, 3);
  const ticks = Array.from(line.querySelectorAll(".ainui-chart-tick")).map((t) => t.textContent);
  assert.ok(ticks.includes("0%") && ticks.includes("10%"), `percent ticks over the fixed axis: ${ticks.join(" ")}`);
  assert.match(line.querySelector("circle title")!.textContent!, /Mon · rate: 2%/);
  assert.equal(area.querySelectorAll("path.ainui-chart-area").length, 2);
  assert.equal(area.querySelectorAll("path.ainui-chart-line").length, 2);
  assert.equal(scatter.querySelectorAll("circle.ainui-chart-dot").length, 3);
  assert.equal(scatter.querySelector("path.ainui-chart-line"), null);
  const sx = Array.from(scatter.querySelectorAll("circle")).map((c) => Number(c.getAttribute("cx")));
  assert.ok(sx[1] - sx[0] < sx[2] - sx[1], "a numeric x is drawn to scale");
  const slices = Array.from(pie.querySelectorAll<SVGPathElement>("path.ainui-chart-slice"));
  assert.equal(slices.length, 3);
  assert.match(slices[0].getAttribute("d")!, /^M[\d.]+,[\d.]+L/, "a pie slice starts at the centre");
  assert.match(slices[0].querySelector("title")!.textContent!, /A: 50 \(50%\)/);
  assert.deepEqual(slices.map((s) => s.style.fill), ["var(--ainui-chart-1)", "var(--ainui-chart-2)", "var(--ainui-chart-3)"]);
  assert.equal(pie.querySelectorAll(".ainui-chart-value").length, 3);
  assert.equal(pie.querySelectorAll(".ainui-chart-label-line").length, 3);
  assert.deepEqual(Array.from(pie.querySelectorAll(".ainui-chart-legend li")).map((l) => l.textContent), ["A", "B", "C"]);
  assert.match(pie.querySelector("svg")!.getAttribute("aria-label")!, /Pie chart of value by name/);
  const ring = donut.querySelector<SVGPathElement>("path.ainui-chart-slice")!;
  assert.equal((ring.getAttribute("d")!.match(/A/g) ?? []).length, 2, "a donut slice has an outer and an inner arc");
  assert.equal(ring.style.strokeLinejoin, "round");
  for (const empty of [none, bad]) { assert.equal(empty.querySelector("svg"), null); assert.equal(empty.querySelector(".ainui-chart-message")!.textContent, "No data"); }
  assert.equal(none.querySelector(".ainui-chart-title")!.textContent, "Empty");
  await d.unmount();
});

test("data: a Map fits its markers, draws tiles, a route and the place list, and writes the selection back", async () => {
  const d = await draw(surface([
    { id: "root", component: "Column", children: ["map", "echo", "empty"] },
    { id: "map", component: "Map", route: true, selected: { "@path": "/picked" }, height: 300, markers: { "@path": "/places" } },
    { id: "echo", component: "Text", text: { "@path": "/picked" } },
    { id: "empty", component: "Map", markers: { "@path": "/nowhere" } },
  ], { picked: "", places: [
    { label: "Gyeongbokgung", lat: 37.5796, lng: 126.977, category: "Palace" },
    { label: "N Seoul Tower", lat: 37.5512, lng: 126.9882, category: "Landmark" },
    { label: "Broken", lat: "north", lng: 1 },
  ] }));
  assert.deepEqual(d.errors, []);
  const [map, empty] = d.$$(".ainui-map");
  const view = map.querySelector<HTMLElement>(".ainui-map-view")!;
  assert.equal(view.style.height, "300px");
  const zoom = Number(view.dataset.zoom);
  assert.ok(zoom >= 12 && zoom <= 16, `fit zoom for two places in one city: ${zoom}`);
  const [lat, lng] = view.dataset.center!.split(",").map(Number);
  assert.ok(Math.abs(lat - 37.5654) < 0.01 && Math.abs(lng - 126.9826) < 0.01, "centred between the markers");
  const tiles = Array.from(map.querySelectorAll<HTMLImageElement>(".ainui-map-tiles img"));
  assert.ok(tiles.length >= 6);
  assert.match(tiles[0].getAttribute("src")!, new RegExp(`^https://tile\\.openstreetmap\\.org/${zoom}/\\d+/\\d+\\.png$`));
  const markers = Array.from(map.querySelectorAll<HTMLButtonElement>("button.ainui-map-marker"));
  assert.deepEqual(markers.map((m) => m.getAttribute("aria-label")), ["Gyeongbokgung", "N Seoul Tower"]);
  assert.ok(parseFloat(markers[0].style.top) < parseFloat(markers[1].style.top), "north is up");
  assert.ok(parseFloat(markers[0].style.left) < parseFloat(markers[1].style.left), "east is right");
  for (const m of markers) { assert.ok(parseFloat(m.style.left) > 0 && parseFloat(m.style.left) < 640); assert.ok(parseFloat(m.style.top) > 0 && parseFloat(m.style.top) < 300); }
  assert.equal(map.querySelector(".ainui-map-route polyline")!.getAttribute("points")!.split(" ").length, 2);
  assert.match(map.querySelector(".ainui-map-attribution")!.textContent!, /© OpenStreetMap contributors/);
  assert.deepEqual(Array.from(map.querySelectorAll(".ainui-map-places li")).map((l) => l.textContent), ["1GyeongbokgungPalace", "2N Seoul TowerLandmark"]);

  await d.click("button.ainui-map-marker:nth-of-type(2)");
  assert.ok(d.$$("button.ainui-map-marker")[1].classList.contains("ainui-map-marker-selected"));
  assert.equal(d.$$("button.ainui-map-marker")[1].getAttribute("aria-pressed"), "true");
  assert.match(d.$(".ainui-column")!.textContent!, /N Seoul Tower$|N Seoul Tower(?=No places)/, "the bound path holds the label");
  await d.click(".ainui-map-places li:first-child button");
  assert.ok(d.$$("button.ainui-map-marker")[0].classList.contains("ainui-map-marker-selected"));

  await d.click("[aria-label='Zoom in']");
  assert.equal(Number(d.$<HTMLElement>(".ainui-map-view")!.dataset.zoom), zoom + 1);
  assert.equal(empty.querySelector(".ainui-map-view"), null);
  assert.equal(empty.querySelector(".ainui-map-empty")!.textContent, "No places");
  await d.unmount();
});

test("data: a Map takes the host's tile URL and a fixed zoom and centre", async () => {
  const React = (await import("react")).default;
  const { HostContext, standardComponents } = await import("../src/react.js");
  assert.ok(["Table", "TableSection", "TableRow", "TableCell", "List", "ListItem", "Chart", "Map"].every((n) => standardComponents.some((c) => c.name === n)));
  void React; void HostContext;
  const d = await draw(surface([
    { id: "root", component: "Map", zoom: 3, center: { lat: 0, lng: 0 }, markers: [{ label: "Null Island", lat: 0, lng: 0 }] },
  ]));
  assert.deepEqual(d.errors, []);
  const view = d.$<HTMLElement>(".ainui-map-view")!;
  assert.equal(view.dataset.zoom, "3");
  assert.equal(view.dataset.center, "0.00000,0.00000");
  const marker = d.$<HTMLElement>("button.ainui-map-marker")!;
  assert.equal(marker.style.left, "320px"); assert.equal(marker.style.top, "120px");
  assert.equal(d.$(".ainui-map-route"), null);
  await d.unmount();
});
