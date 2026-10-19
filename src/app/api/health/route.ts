import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  // A database is OPTIONAL for CareBridge. When it is not configured we simply
  // report that — the app itself is healthy.
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, database: "not_configured" }, { headers: NO_STORE });
  }
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, database: "connected" }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, database: "error" }, { status: 500, headers: NO_STORE });
  }
}
