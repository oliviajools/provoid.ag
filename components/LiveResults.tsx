export type BoardActive = {
  id: string; title: string; kind: "grid" | "wall" | "text"; rows: string[]; options: string[];
  solution: (number | null)[] | null; mode: "open" | "reveal"; private: boolean; homework?: boolean;
};
export type BoardResult =
  | { kind: "grid"; respondents: number; counts: number[][] }
  | { kind: "wall"; entries: { col: number; text: string }[] }
  | { kind: "text"; respondents: number; answers: string[][]; hidden: boolean };

function tone(o: string, i: number) {
  const t = o.toLowerCase();
  if (t.startsWith("grün")) return "cg";
  if (t.startsWith("gelb")) return "cy";
  if (t.startsWith("rot")) return "cr";
  return `c${i % 4}`;
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** Ergebnisse ohne Namen, für die Tafel und für die Auflösung auf den Geräten. */
export function LiveResults({ active, result, big = false, mine }: {
  active: BoardActive; result: BoardResult; big?: boolean; mine?: Record<string, string>;
}) {
  const showSolution = active.mode === "reveal" && !!active.solution;
  return (
    <div className={`live-results${big ? " big" : ""}`}>
      {big && <h2>{active.title}</h2>}

      {result.kind === "grid" && (
        <div className="lr-grid">
          {active.rows.map((row, ri) => {
            const counts = result.counts[ri] ?? [];
            const sum = counts.reduce((a, b) => a + b, 0);
            const sol = showSolution ? active.solution?.[ri] ?? null : null;
            const my = mine?.[String(ri)];
            return (
              <div className="lr-row" key={ri}>
                <div className="lr-label">
                  <b>{row}</b>
                  {sol !== null && <span className="lr-sol">{active.options[sol]}</span>}
                  {my !== undefined && sol !== null && <span className={`lr-me ${Number(my) === sol ? "ok" : "no"}`}>{Number(my) === sol ? "richtig" : "daneben"}</span>}
                </div>
                {big ? (
                  <div className="lr-stack">
                    {active.options.map((o, oi) => {
                      const v = pct(counts[oi] ?? 0, sum);
                      return (
                        <div key={oi} className={`lr-seg ${tone(o, oi)}${sol === oi ? " correct" : ""}`} style={{ flexGrow: sum ? Math.max(counts[oi] ?? 0, 0.0001) : 1 }}
                          title={`${o}: ${v} %`}>
                          {(v >= 12 || !sum) && <span>{sol === oi ? "✓ " : ""}{o} {sum ? `${v} %` : ""}</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div className="lr-bars">
                  {active.options.map((o, oi) => (
                    <div className={`lr-bar${sol === oi ? " correct" : ""}${my !== undefined && Number(my) === oi ? " mine" : ""}`} key={oi}>
                      <span className="lr-fill" style={{ width: `${pct(counts[oi] ?? 0, sum)}%` }} />
                      <span className="lr-text">{o}</span>
                      <span className="lr-n">{pct(counts[oi] ?? 0, sum)} %</span>
                    </div>
                  ))}
                </div>
                )}
              </div>
            );
          })}
          {big && <div className="lr-legend">{active.options.map((o, oi) => <span key={oi}><i className={tone(o, oi)} />{o}</span>)}</div>}
          <p className="faint">{result.respondents} {result.respondents === 1 ? "Person hat" : "Personen haben"} abgestimmt.</p>
        </div>
      )}

      {result.kind === "wall" && (
        <div className="lr-wall" style={{ gridTemplateColumns: `repeat(${Math.max(1, active.rows.length)}, minmax(0, 1fr))` }}>
          {(active.rows.length ? active.rows : ["Eure Ideen"]).map((col, ci) => (
            <div className="lr-col" key={ci}>
              {active.rows.length > 1 && <h3>{col}</h3>}
              <div className="lr-notes">
                {result.entries.filter((e) => e.col === ci).map((e, k) => <div className="lr-note" key={k}>{e.text}</div>)}
                {result.entries.filter((e) => e.col === ci).length === 0 && <p className="faint">Noch keine Zettel.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {result.kind === "text" && (
        result.hidden
          ? <p className="muted">{result.respondents} {result.respondents === 1 ? "Person hat" : "Personen haben"} geantwortet. Die Antworten siehst nur du in der Sitzungsübersicht.</p>
          : <div className="lr-text-list">
              {active.rows.map((q, qi) => (
                <div key={qi} className="lr-q">
                  <h3>{q}</h3>
                  <div className="lr-notes">
                    {(result.answers[qi] ?? []).map((a, k) => <div className="lr-note" key={k}>{a}</div>)}
                    {(result.answers[qi] ?? []).length === 0 && <p className="faint">Noch keine Antworten.</p>}
                  </div>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}
