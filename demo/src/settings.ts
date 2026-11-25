import { useCallback, useEffect, useState } from "react";

export const THEMES = [
  { id: "ain", label: "AIN" }, { id: "plain", label: "Plain" }, { id: "material", label: "Material" }, { id: "terminal", label: "Terminal" },
];
export type Settings = { model: string; format: string; theme: string; source: boolean };
const KEY = "ainui-playground";

function initial(): Settings {
  const query = new URLSearchParams(location.search);
  let saved: Partial<Settings> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { /* private window: defaults */ }
  const ds = query.get("ds");
  return {
    model: query.get("model") ?? saved.model ?? "",
    format: query.get("format") === "json" ? "json" : query.get("format") === "express" ? "express" : saved.format ?? "json",
    theme: ds && THEMES.some((t) => t.id === ds) ? ds : saved.theme ?? "ain",
    source: saved.source ?? true,
  };
}

/** The playground's choices; the URL (?ds=, ?format=, ?model=) wins over what was remembered. */
export function useSettings(): [Settings, (change: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(initial);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not remembered */ } }, [settings]);
  return [settings, useCallback((change) => setSettings((s) => ({ ...s, ...change })), [])];
}
