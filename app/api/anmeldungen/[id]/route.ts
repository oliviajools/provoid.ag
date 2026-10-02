import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  // Schutz vor Formel-Ausführung in Excel
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user || user.role !== "coach") return new Response("Nicht erlaubt", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const [f] = await sql<{ slug: string; options: { id: string; label: string }[] }[]>`select slug, options from signup_forms where id = ${id}`;
  if (!f) return new Response("Nicht gefunden", { status: 404 });
  const rows = await sql`
    select option_id, waitlist, child_first, child_last, class_name, parent_name, email, phone, photo_ok, notes,
           to_char(created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') as created
    from signups where form_id = ${id} order by option_id, waitlist, created_at`;
  const label = (o: string) => f.options.find((x) => x.id === o)?.label ?? o;
  const header = ["Gruppe", "Status", "Vorname", "Nachname", "Klasse", "Erziehungsberechtigte Person", "E-Mail", "Telefon", "Fotos erlaubt", "Anmerkungen", "Angemeldet am"];
  const lines = [header.map(esc).join(";")].concat(rows.map((r) => [
    label(r.option_id), r.waitlist ? "Warteliste" : "Platz", r.child_first, r.child_last, r.class_name,
    r.parent_name, r.email, r.phone, r.photo_ok ? "ja" : "nein", r.notes, r.created,
  ].map(esc).join(";")));
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="anmeldungen-${f.slug}.csv"`,
      "cache-control": "no-store",
    },
  });
}
