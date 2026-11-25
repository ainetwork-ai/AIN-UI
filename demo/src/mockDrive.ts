/**
 * An in-memory drive for the "Files & payments" page: the skills `dispatchAinuiAction` calls, answered from a tree
 * that lives in this tab only. No React, no network; everything resets on reload.
 */
import type { AinuiEnv, SkillResult } from "ain-ui";

export type DriveEntry = {
  name: string;
  isDir: boolean;
  size: number;
  mtimeMs: number;
  mime: string;
  /** Paid and not bought: listed, but not readable. */
  locked?: boolean;
  /** Bytes kept in memory. A file without `content` is a static sample under /sample/<path>. */
  content?: string;
  encoding?: "utf8" | "base64";
  children?: DriveEntry[];
};

export const DEMO_DRIVE_ID = "demo";
export const PAID_PATH = "Docs/market-report.pdf";

const MIME: Record<string, string> = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", pdf: "application/pdf",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", html: "text/html", css: "text/css", log: "text/plain",
  json: "application/json", yaml: "application/yaml", yml: "application/yaml", js: "application/javascript", ts: "application/typescript",
};
const TEXT_APPLICATION = ["application/json", "application/yaml", "application/javascript", "application/typescript", "application/xml"];

export function mimeOf(path: string): string | null {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? null : MIME[path.slice(dot + 1).toLowerCase()] ?? null;
}
/** SVG is drawn as an image here, not opened in the editor. */
export const isText = (_path: string, mime: string): boolean => mime.startsWith("text/") || TEXT_APPLICATION.includes(mime);

const utf8Size = (s: string) => new TextEncoder().encode(s).length;
const base64Size = (s: string) => Math.floor(s.length * 3 / 4) - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 20, 9, 0);
const dir = (name: string, children: DriveEntry[], daysAgo = 0): DriveEntry =>
  ({ name, isDir: true, size: 0, mtimeMs: T0 - daysAgo * DAY, mime: "inode/directory", children });
const sample = (name: string, size: number, daysAgo: number, extra: Partial<DriveEntry> = {}): DriveEntry =>
  ({ name, isDir: false, size, mtimeMs: T0 - daysAgo * DAY, mime: mimeOf(name) ?? "application/octet-stream", ...extra });
const textFile = (name: string, content: string, daysAgo: number): DriveEntry =>
  ({ ...sample(name, utf8Size(content), daysAgo), content, encoding: "utf8" });

const seed = (): DriveEntry => dir("", [
  dir("Photos", [
    sample("blue-lake.svg", 581, 9), sample("coast.svg", 649, 8), sample("dawn-ridge.svg", 593, 7), sample("dunes.svg", 561, 6),
    sample("meadow.svg", 662, 5), sample("night-peaks.svg", 606, 4), sample("pine-forest.svg", 684, 3),
    textFile("captions.txt", "blue-lake: still water under blue hills\ncoast: low tide, late morning\ndawn-ridge: first light on the ridge\n", 2),
  ], 2),
  dir("Docs", [
    sample("market-report.pdf", 927, 1, { locked: true }),
    textFile("meeting-notes.md", "# Meeting notes\n\n- Ship the file picker this week\n- Price the market report at 0.25 USDC\n- Ask the folder agent for a summary before the review\n", 3),
    textFile("pricing.json", JSON.stringify({ "market-report.pdf": { amount: "0.25", currency: "USDC", network: "eip155:8453" } }, null, 2) + "\n", 4),
    dir("Archive", [textFile("2025-summary.txt", "Last year's summary. Nothing in this drive is real data.\n", 30)], 30),
  ], 1),
  textFile("welcome.md", "# Welcome to the demo drive\n\nEverything here lives in this browser tab. Edit this file, save it, create new ones, upload your own — a reload brings the original drive back.\n", 0),
  textFile("todo.txt", "[x] browse the Photos folder\n[ ] edit this list and save it\n[ ] buy the market report (nothing is really paid)\n", 1),
]);

const ok = (text: string, structured: unknown): SkillResult => ({ kind: "ok", text, structured });
const err = (code: "invalid_params" | "forbidden" | "internal" | "not_found", message: string): SkillResult => ({ kind: "err", code, message });

const segments = (path: unknown): string[] | null => {
  if (typeof path !== "string" && path !== undefined) return null;
  const parts = (path ?? "").split("/").filter(Boolean);
  return parts.some((p) => p === "." || p === ".." || p.includes("\\")) ? null : parts;
};

export type MockDrive = ReturnType<typeof createMockDrive>;

export function createMockDrive() {
  const root = seed();

  const find = (path: unknown): DriveEntry | null => {
    const parts = segments(path);
    if (!parts) return null;
    let at: DriveEntry | undefined = root;
    for (const p of parts) at = at?.isDir ? at.children?.find((c) => c.name === p) : undefined;
    return at ?? null;
  };
  const raw = (e: DriveEntry) => ({ name: e.name, isDir: e.isDir, size: e.size, mtimeMs: e.mtimeMs, mime: e.isDir ? "folder" : e.mime, ...(e.locked ? { locked: true } : {}) });
  const sorted = (list: DriveEntry[]) => [...list].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));

  /** The skills the dispatcher needs, with the result shapes `ainuiForSkill` / `a2uiForSkill` read. */
  async function run(skill: string, args: Record<string, unknown>): Promise<SkillResult> {
    const parts = segments(args.path);
    if (!parts) return err("invalid_params", "invalid path");
    const path = parts.join("/");
    const entry = find(path);
    switch (skill) {
      case "list_files": {
        if (!entry) return err("not_found", `no such folder: /${path}`);
        if (!entry.isDir) return err("invalid_params", `not a folder: /${path}`);
        const entries = sorted(entry.children ?? []).map(raw);
        return ok(`${entries.length} entries in /${path}`, { entries });
      }
      case "stat":
        if (!entry) return err("not_found", `no such file: /${path}`);
        return ok(`/${path}`, raw(entry));
      case "read_file": {
        if (!entry || entry.isDir) return err("not_found", `no such file: /${path}`);
        if (entry.locked) return err("forbidden", `payment required for ${path}`);
        if (entry.content === undefined) return err("invalid_params", `/${path} is a static sample; open it in the viewer`);
        const wantsBase64 = args.encoding === "base64";
        if (entry.encoding === "base64" && !wantsBase64) return err("invalid_params", `not a text file: ${path}`);
        const content = wantsBase64 && entry.encoding !== "base64" ? bytesToBase64(new TextEncoder().encode(entry.content)) : entry.content;
        return ok(`/${path}`, { content, encoding: wantsBase64 ? "base64" : "utf8", truncated: false });
      }
      case "write_file": {
        if (!parts.length) return err("invalid_params", "write_file needs a file path");
        if (typeof args.content !== "string") return err("invalid_params", "write_file needs string content");
        const parent = find(parts.slice(0, -1).join("/"));
        if (!parent?.isDir) return err("not_found", `no such folder: /${parts.slice(0, -1).join("/")}`);
        if (entry?.isDir) return err("invalid_params", `/${path} is a folder`);
        if (entry?.locked) return err("forbidden", `payment required for ${path}`);
        const name = parts[parts.length - 1];
        const mime = mimeOf(name) ?? "application/octet-stream";
        let content = args.content;
        let encoding: "utf8" | "base64" = args.encoding === "base64" ? "base64" : "utf8";
        // An uploaded text file arrives as base64: keep it as text so the editor can open it.
        if (encoding === "base64" && isText(name, mime)) {
          try { content = new TextDecoder("utf-8", { fatal: true }).decode(base64ToBytes(content)); encoding = "utf8"; } catch { /* not UTF-8: stays binary */ }
        }
        const next: DriveEntry = { name, isDir: false, size: encoding === "base64" ? base64Size(content) : utf8Size(content), mtimeMs: Date.now(), mime, content, encoding };
        parent.children = [...(parent.children ?? []).filter((c) => c.name !== name), next];
        return ok(`Wrote /${path}`, { path, size: next.size });
      }
      case "delete_path": {
        if (!parts.length) return err("invalid_params", "the drive root cannot be deleted");
        const parent = find(parts.slice(0, -1).join("/"));
        if (!entry || !parent) return err("not_found", `no such path: /${path}`);
        parent.children = (parent.children ?? []).filter((c) => c !== entry);
        return ok(`Deleted /${path}`, { kind: entry.isDir ? "folder" : "file" });
      }
      case "search": {
        const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
        if (!query) return err("invalid_params", "search needs a query");
        if (!entry?.isDir) return err("not_found", `no such folder: /${path}`);
        const LIMIT = 50;
        const matches: Array<{ path: string; isDir: boolean; locked?: boolean }> = [];
        let truncated = false;
        const walk = (folder: DriveEntry, prefix: string) => {
          for (const c of sorted(folder.children ?? [])) {
            const p = prefix ? `${prefix}/${c.name}` : c.name;
            if (c.name.toLowerCase().includes(query)) {
              if (matches.length >= LIMIT) { truncated = true; return; }
              matches.push({ path: p, isDir: c.isDir, ...(c.locked ? { locked: true } : {}) });
            }
            if (c.isDir) walk(c, p);
          }
        };
        walk(entry, path);
        return ok(`${matches.length} matches for "${query}"`, { matches, truncated });
      }
      default:
        return err("invalid_params", `the demo drive has no skill "${skill}"`);
    }
  }

  return {
    run,
    /** Everything is allowed in the demo; a real host passes the caller's allow-list. */
    allowed: (_skill: string) => true,
    env: (_driveId: string, _path: string): AinuiEnv => ({ canWrite: true, canDelete: true, rootLabel: "Demo drive", mimeOf, isText }),
    entry: find,
    /** Names in a folder, folders first (used by the folder chat's canned reply). */
    names: (path: string): string[] => sorted(find(path)?.children ?? []).map((c) => (c.isDir ? `${c.name}/` : c.name)),
    /** In-memory text of a file, or null for folders, binaries, locked and static files. */
    text: (path: string): string | null => {
      const e = find(path);
      return e && !e.isDir && !e.locked && e.encoding === "utf8" && typeof e.content === "string" ? e.content : null;
    },
    /** In-memory bytes of a created or uploaded file; null when the file is a static sample (or missing). */
    bytes: (path: string): { bytes: Uint8Array; mime: string } | null => {
      const e = find(path);
      if (!e || e.isDir || e.content === undefined) return null;
      return { bytes: e.encoding === "base64" ? base64ToBytes(e.content) : new TextEncoder().encode(e.content), mime: e.mime };
    },
    setLocked: (path: string, locked: boolean): boolean => {
      const e = find(path);
      if (!e || e.isDir) return false;
      if (locked) e.locked = true; else delete e.locked;
      return true;
    },
  };
}
