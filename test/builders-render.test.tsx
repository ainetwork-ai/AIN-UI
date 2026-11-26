import { test } from "node:test";
import assert from "node:assert/strict";
import { draw } from "./support/harness.js";
import { a2uiForSkill, ainuiForSkill } from "../src/index.js";

// Every builder surface, empty and filled, must draw with the 1.0 renderer: 1.0 refuses a surface
// whose components the root cannot reach (an empty folder used to carry its unused List template).
const ok = (structured: Record<string, unknown>) => ({ kind: "ok" as const, structured });
const entries = [{ name: "a.jpg", isDir: false, size: 10, mtime: 1 }, { name: "docs", isDir: true, size: 0, mtime: 1 }];
const cases: Array<[string, string, Record<string, unknown>, Record<string, unknown>]> = [
  ["drives, none", "list_drives", {}, { drives: [] }],
  ["drives", "list_drives", {}, { drives: [{ id: "d1", name: "Phone" }] }],
  ["folder, empty", "list_files", { path: "" }, { entries: [] }],
  ["folder", "list_files", { path: "Camera" }, { entries }],
  ["search, none", "search", { query: "x" }, { matches: [] }],
  ["search", "search", { query: "a" }, { matches: [{ path: "a.jpg", isDir: false }], truncated: true }],
  ["read", "read_file", { path: "n.md" }, { content: "hi", encoding: "utf8", size: 2 }],
  ["write", "write_file", { path: "docs/n.md" }, {}],
  ["delete", "delete_path", { path: "docs" }, { kind: "folder" }],
  ["stat", "stat", { path: "a.jpg" }, { name: "a.jpg", isDir: false, size: 10, mtimeMs: 1 }],
];

for (const [name, skill, args, structured] of cases) {
  for (const [label, build] of [["basic", a2uiForSkill], ["ainui", ainuiForSkill]] as const) {
    test(`${label} ${name} draws without errors`, async () => {
      const d = await draw((build as any)(skill, args, ok(structured), "d1", { canWrite: true, canDelete: true }));
      assert.deepEqual(d.errors.map((e) => e.message), []);
      assert.ok((d.container.textContent ?? "").length > 0);
      await d.unmount();
    });
  }
}

test("an error result draws as a card", async () => {
  const d = await draw(a2uiForSkill("list_files", {}, { kind: "err", code: "E", message: "boom" } as any, "d1"));
  assert.deepEqual(d.errors.map((e) => e.message), []);
  assert.match(d.container.textContent ?? "", /boom/);
  await d.unmount();
});
