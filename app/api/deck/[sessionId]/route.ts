import { sql } from "@/lib/db";
import { guard, json } from "@/lib/live-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_DECK = 4 * 1024 * 1024; // Vercel nimmt höchstens 4,5 MB pro Anfrage an

/**
 * Kleines Skript, das in den Foliensatz eingesetzt wird. Es meldet der Präsentation die
 * aktuelle Folie, springt auf Wunsch zu einer Folie und reicht einige Tasten nach außen weiter.
 * Der Foliensatz läuft in einem abgeschotteten iframe ohne Zugriff auf Cookies oder die Plattform.
 */
const BRIDGE = `<script>(function(){
  var last=-1, total=0;
  function slides(){return document.querySelectorAll('.deck-slide, section[data-document-role="page"]');}
  function current(){
    var s=slides(); total=s.length; if(!total) return 1;
    var off=0, on=-1;
    for(var i=0;i<s.length;i++){ if(s[i].hasAttribute('data-off')) off++; else if(on<0) on=i; }
    if(off>0 && on>=0) return on+1;
    var m=/^#(\\d+)$/.exec(location.hash); if(m) return Math.max(1,Math.min(total,+m[1]));
    var best=0, top=window.scrollY||0;
    for(var j=0;j<s.length;j++){ if(Math.abs(s[j].offsetTop-top)<Math.abs(s[best].offsetTop-top)) best=j; }
    return best+1;
  }
  function tick(){ var n=current(); if(n!==last){ last=n; parent.postMessage({type:'provoid-deck', slide:n, total:total}, '*'); } }
  window.addEventListener('message', function(e){
    if(e.source!==parent||!e.data) return;
    if(e.data.type==='provoid-goto'){ location.hash='#'+e.data.slide; }
    if(e.data.type==='provoid-ping'){ last=-1; tick(); }
  });
  window.addEventListener('keydown', function(e){
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    var k=e.key;
    if(k==='e'||k==='E'||k==='f'||k==='F'||k==='q'||k==='Q'){ e.preventDefault(); e.stopImmediatePropagation(); parent.postMessage({type:'provoid-key', key:k.toLowerCase()}, '*'); }
  }, true);
  setInterval(tick, 250);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', tick); else tick();
})();</script>`;

function inject(html: string) {
  const i = html.search(/<\/head>/i);
  return i >= 0 ? html.slice(0, i) + BRIDGE + html.slice(i) : BRIDGE + html;
}

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId, true);
  if ("error" in g) return g.error;
  const [d] = await sql<{ html: string }[]>`select html from session_decks where session_id = ${sessionId}`;
  if (!d) return new Response("Kein Foliensatz.", { status: 404 });
  return new Response(inject(d.html), {
    headers: {
      "content-type": "text/plain; charset=utf-8", // wird nur als srcdoc eingesetzt, nie direkt angezeigt
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId, true);
  if ("error" in g) return g.error;
  const name = (new URL(req.url).searchParams.get("name") ?? "folien.html").slice(0, 200);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_DECK) return json({ error: "Der Foliensatz ist größer als 4 MB." }, 413);
  const html = await req.text();
  if (html.length > MAX_DECK) return json({ error: "Der Foliensatz ist größer als 4 MB." }, 413);
  if (!/<html|<!doctype html/i.test(html.slice(0, 2000))) return json({ error: "Das ist keine HTML-Datei." }, 400);
  const slides = (html.match(/class="deck-slide"/g) ?? []).length || (html.match(/data-document-role="page"/g) ?? []).length;
  await sql`
    insert into session_decks (session_id, filename, html, slides) values (${sessionId}, ${name}, ${html}, ${slides})
    on conflict (session_id) do update set filename = excluded.filename, html = excluded.html, slides = excluded.slides, uploaded_at = now()`;
  return json({ ok: true, slides });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId, true);
  if ("error" in g) return g.error;
  await sql`delete from session_decks where session_id = ${sessionId}`;
  return json({ ok: true });
}
