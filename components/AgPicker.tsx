import type { GroupOpt } from "@/lib/groups";

/** Auswahl der AG. Merkt sich die Wahl für alle Coach-Seiten. */
export function AgPicker({ groups, current, next }: { groups: GroupOpt[]; current?: GroupOpt; next: string }) {
  if (groups.length < 2) return null;
  return (
    <form action="/coach/ag" method="get" className="ag-picker">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="ag-pick" className="faint">AG</label>
      <select id="ag-pick" name="ag" defaultValue={current?.id} className="select" aria-label="AG wählen">
        {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <button className="btn ghost small" type="submit">Wechseln</button>
    </form>
  );
}

/** Kleines Schild, damit immer klar ist, in welcher AG man gerade arbeitet. */
export function AgTag({ g }: { g?: GroupOpt }) {
  if (!g) return null;
  return <span className={`tag ag-tag ag-${((g.nr - 1) % 3) + 1}`}>{g.label}</span>;
}
