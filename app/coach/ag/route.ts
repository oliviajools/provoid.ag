import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { AG_COOKIE } from "@/lib/groups";

export const dynamic = "force-dynamic";

/** Wechselt die AG für alle Coach-Seiten und springt zurück auf die Seite, von der die Auswahl kam. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("ag") ?? "";
  const next = url.searchParams.get("next") ?? "/coach";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/coach";
  const user = await getUser();
  const target = new URL(safeNext, url.origin);
  if (user?.role === "coach" && /^[0-9a-f-]{36}$/i.test(id)) target.searchParams.set("ag", id);
  const res = NextResponse.redirect(target, 303);
  if (user?.role === "coach" && /^[0-9a-f-]{36}$/i.test(id)) {
    res.cookies.set(AG_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
