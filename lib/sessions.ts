import "server-only";
import { sql } from "./db";
import type { User } from "./auth";

export const PHASES = {
  durchschauen: "Durchschauen",
  einordnen: "Einordnen",
  bauen: "Bauen",
} as const;
export type Phase = keyof typeof PHASES;

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const CHUNK_BYTES = 3 * 1024 * 1024;

// Erlaubte Dateitypen (keine HTML- oder SVG-Dateien, die im Browser Code ausführen könnten)
export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.oasis.opendocument.presentation": "Präsentation",
  "application/vnd.oasis.opendocument.text": "Dokument",
  "application/zip": "ZIP",
  "text/plain": "Text",
  "text/csv": "CSV",
  "text/markdown": "Text",
  "image/png": "Bild",
  "image/jpeg": "Bild",
  "image/gif": "Bild",
  "image/webp": "Bild",
  "audio/mpeg": "Audio",
  "audio/mp4": "Audio",
  "video/mp4": "Video",
};
export const INLINE_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "audio/mpeg", "audio/mp4", "video/mp4", "text/plain"]);

export type SessionRow = {
  id: string; group_id: string; number: number; title: string; date_label: string | null; date_iso: string | null;
  phase: Phase | null; summary: string; published: boolean;
};

export async function loadSession(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await sql<SessionRow[]>`
    select id, group_id, number, title, summary, published, phase,
           to_char(date, 'Dy DD.MM.YYYY') as date_label, to_char(date, 'YYYY-MM-DD') as date_iso
    from ag_sessions where id = ${id}`)[0] ?? null;
}

/** Darf diese Person die Sitzung (und ihr Material) sehen? */
export function canView(user: User, s: { group_id: string; published: boolean }) {
  if (user.role === "coach") return true;
  return s.published && s.group_id === user.group_id;
}

const DAYS: Record<string, string> = { Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So" };
export const germanDay = (label: string | null) => (label ? label.replace(/^(\w{3})/, (d) => DAYS[d] ?? d) : null);

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
