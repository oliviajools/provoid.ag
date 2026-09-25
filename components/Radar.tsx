import { SKILLS, SKILL_SHORT } from "@/lib/compass";

/** Netzdiagramm der Selbsteinschätzung (1 bis 5). Weitere Runden (Halbzeit, Ende) können als zusätzliche Flächen folgen. */
export function Radar({ values, label }: { values: Record<string, number>; label: string }) {
  const size = 300, c = size / 2, r = 112, n = SKILLS.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * (r * v) / 5, c + Math.sin(a) * (r * v) / 5] as const;
  };
  const poly = (v: (i: number) => number) => SKILLS.map((_, i) => pt(i, v(i)).join(",")).join(" ");
  return (
    <figure className="radar" style={{ margin: 0 }}>
      <svg viewBox={`-70 0 ${size + 140} ${size}`} role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((g) => (
          <polygon key={g} points={poly(() => g)} fill="none" stroke="var(--line)" strokeWidth={g === 5 ? 1.2 : 0.8} />
        ))}
        {SKILLS.map((_, i) => {
          const [x, y] = pt(i, 5);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" strokeWidth={0.8} />;
        })}
        <polygon points={poly((i) => values[SKILLS[i].id] ?? 0)} fill="rgba(132,116,245,0.35)" stroke="var(--accent)" strokeWidth={2} />
        {SKILLS.map((s, i) => {
          const [x, y] = pt(i, values[s.id] ?? 0);
          return <circle key={s.id} cx={x} cy={y} r={3.5} fill="var(--accent)" />;
        })}
        {SKILLS.map((s, i) => {
          const [x, y] = pt(i, 5.7);
          const anchor = Math.abs(x - c) < 5 ? "middle" : x > c ? "start" : "end";
          return (
            <text key={s.id} x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
              {SKILL_SHORT[s.id]} · {values[s.id] ?? "–"}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
