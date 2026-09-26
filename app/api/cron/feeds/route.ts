import { NextResponse } from "next/server";
import { importFeeds } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Wird von Vercel Cron einmal täglich aufgerufen (siehe vercel.json).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "nicht erlaubt" }, { status: 401 });
  }
  const results = await importFeeds();
  return NextResponse.json({ ok: true, results });
}
