import { z } from "zod";
import { getUser } from "@/lib/auth";
import { json } from "@/lib/live-api";
import { darfSehen, einstellungen, ladeDenkpartner, zaehle } from "@/lib/denkpartner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_VERLAUF = 24;
const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(200),
});

/** Chat mit einem Denkpartner. Gespräche werden nicht gespeichert, nur gezählt. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  if (origin) {
    let oh = "?"; try { oh = new URL(origin).host; } catch { /* ungültig */ }
    if (oh !== host && origin !== process.env.APP_ORIGIN) return json({ error: "Nicht erlaubt." }, 403);
  }
  const user = await getUser();
  if (!user) return json({ error: "Bitte einloggen." }, 401);
  if (user.must_change_password) return json({ error: "Bitte zuerst dein Passwort ändern." }, 403);
  const { id } = await params;
  const d = await ladeDenkpartner(id);
  if (!d || !darfSehen(user, d)) return json({ error: "Diesen Denkpartner gibt es nicht mehr." }, 404);
  const { enabled, limit } = await einstellungen(user);
  if (!enabled) return json({ error: "Der Baukasten ist für deine AG gerade ausgeschaltet." }, 403);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Der KI-Dienst ist noch nicht eingerichtet." }, 503);

  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: "Ungültige Anfrage." }, 400);
  const messages = p.data.messages.map((m) => ({ role: m.role, content: m.content.trim() })).filter((m) => m.content).slice(-MAX_VERLAUF);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Es fehlt eine Nachricht." }, 400);

  const n = limit > 0 ? await zaehle(user.id, limit) : null;
  if (n === null) return json({ error: "Deine Nachrichten für diese Woche sind aufgebraucht. Am Montag geht es weiter." }, 429);

  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(55000),
    headers: {
      "content-type": "application/json",
      "x-api-key": (process.env.ANTHROPIC_API_KEY ?? "").trim(),
      "anthropic-version": "2023-06-01",
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID.trim() } : {}),
    },
    body: JSON.stringify({
      model: (process.env.DENKPARTNER_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5").trim(),
      max_tokens: 800,
      stream: true,
      system: d.prompt,
      messages,
    }),
  }).catch(() => null);
  if (!res || !res.ok || !res.body) {
    console.error("Denkpartner: KI-Dienst", res?.status, res ? (await res.text()).slice(0, 300) : "keine Verbindung");
    return json({ error: "Der KI-Dienst antwortet gerade nicht. Versuch es gleich noch einmal." }, 502);
  }

  // Server-Sent Events von Anthropic lesen und nur den Text weiterreichen
  const upstream = res.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      while (true) {
        const { done, value } = await upstream.read();
        if (done) { ctrl.close(); return; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        let sent = false;
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
              ctrl.enqueue(enc.encode(ev.delta.text)); sent = true;
            } else if (ev.type === "error") {
              ctrl.enqueue(enc.encode("\n[Die Antwort wurde unterbrochen. Bitte noch einmal senden.]")); ctrl.close(); return;
            }
          } catch { /* unvollständige Zeile */ }
        }
        if (sent) return;
      }
    },
    cancel() { upstream.cancel().catch(() => {}); },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      "x-remaining": String(Math.max(0, limit - n)),
    },
  });
}
