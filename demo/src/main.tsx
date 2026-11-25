import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "ain-ui/styles.css";
import "./app.css";
import { Playground } from "./Playground";
import { Components } from "./Components";
import { Start } from "./Start";
import { Evals } from "./Evals";
import { Watch } from "./Watch";
import { Ain } from "./Ain";

const NAV = [["/", "Playground"], ["/components", "Components"], ["/ain", "Files & payments"], ["/watch", "Watch"], ["/evals", "Evals"], ["/start", "Get started"]] as const;

function usePath(): [string, (to: string) => void] {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    addEventListener("popstate", on);
    return () => removeEventListener("popstate", on);
  }, []);
  return [path, (to) => { history.pushState(null, "", to); setPath(to); scrollTo(0, 0); }];
}

function App() {
  const [path, go] = usePath();
  const embed = new URLSearchParams(location.search).get("embed") === "1";
  // In-app links navigate without a reload.
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.("a");
    const href = a?.getAttribute("href");
    if (!a || !href || !href.startsWith("/") || href.startsWith("/api/") || href === "/catalog.json" || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); go(href);
  };
  const page = path === "/" ? <Playground embed={embed} />
    : path.startsWith("/components") ? <Components path={path} />
      : path === "/ain" ? <Ain /> : path === "/watch" ? <Watch /> : path === "/evals" ? <Evals /> : path === "/start" ? <Start />
        : <main className="doc"><h1>Not found</h1><p><a href="/">Back to the playground</a></p></main>;
  return <div className="app" onClick={onClick}>
    {!embed && <header className="top">
      <a className="brand" href="/"><img src="/favicon.svg" alt="" width="22" height="22" /> AIN-UI <span>Playground</span></a>
      <nav aria-label="Sections">{NAV.map(([to, label]) => <a key={to} href={to} aria-current={(to === "/" ? path === "/" : path.startsWith(to)) ? "page" : undefined}>{label}</a>)}</nav>
      <a className="repo" href="https://github.com/ainetwork-ai/AIN-UI" target="_blank" rel="noopener noreferrer">GitHub</a>
    </header>}
    {page}
  </div>;
}

createRoot(document.getElementById("app")!).render(<App />);
