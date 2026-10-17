export const dynamic = "force-dynamic";

// Simple health check. CareBridge does not use a database.
export async function GET() {
  return Response.json({ ok: true });
}
