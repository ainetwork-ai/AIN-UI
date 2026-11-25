import React, { useEffect, useState } from "react";

type Row = { model: string; format: string; cases: number; scored: number; valid: number; componentChoice: number; firstTry: number; medianMs: number; failures: Array<{ id: string; reason: string }> };
type Results = { ranAt?: string; cases?: Array<{ id: string; prompt: string; expects: string[] }>; runs: Row[]; note?: string };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}% (${n}/${d})` : "—");

export function Evals() {
  const [data, setData] = useState<Results | null>(null);
  useEffect(() => { fetch("/api/evals").then((r) => r.json()).then(setData).catch(() => setData({ runs: [] })); }, []);
  return <main className="doc">
    <h1>Evals</h1>
    <p>The same requests, sent to each model in each format through this playground's own agent loop. A surface counts as a <strong>valid render</strong> when it passes the check a renderer applies (<code>validatePayload</code> against the AINUI catalog) — after at most one retry and, for Express, one fall back to JSON being counted as a failure of Express. <strong>Component choice</strong>: the surface uses the component the request called for. <strong>First try</strong>: valid without any retry.</p>
    {!data ? <p className="pg-note">Loading…</p> : !data.runs.length ? <p className="pg-note">No evaluation has been run yet (<code>npm run evals</code> in <code>demo/</code>).</p> : <>
      <p className="pg-note">Run {data.ranAt ? new Date(data.ranAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""} · {data.cases?.length ?? 0} requests per model and format.{data.note ? ` ${data.note}` : ""}</p>
      <div className="table-scroll"><table className="doc-table">
        <thead><tr><th>Model</th><th>Format</th><th>Valid render</th><th>First try</th><th>Component choice</th><th>Median time</th></tr></thead>
        <tbody>{data.runs.map((r) => <tr key={`${r.model}/${r.format}`}>
          <td>{r.model}</td><td>{r.format}</td><td>{pct(r.valid, r.scored)}</td><td>{pct(r.firstTry, r.scored)}</td><td>{pct(r.componentChoice, r.scored)}</td><td>{r.medianMs ? `${(r.medianMs / 1000).toFixed(1)} s` : "—"}</td>
        </tr>)}</tbody>
      </table></div>
      {data.runs.some((r) => r.scored < r.cases) && <p className="pg-note">Requests the model service did not answer (rate limit, timeout) are not scored.</p>}
      <h2>What failed</h2>
      {data.runs.filter((r) => r.failures.length).map((r) => <details key={`${r.model}/${r.format}`}><summary>{r.model} · {r.format} — {r.failures.length}</summary>
        <ul>{r.failures.map((f, i) => <li key={i}><code>{f.id}</code> — {f.reason}</li>)}</ul></details>)}
      <h2>The requests</h2>
      <ol>{(data.cases ?? []).map((c) => <li key={c.id}>{c.prompt} <span className="pg-chip">{c.expects.join(" / ")}</span></li>)}</ol>
    </>}
  </main>;
}
