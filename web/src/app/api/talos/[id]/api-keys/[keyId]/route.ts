import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsScopedApiKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyAgentApiKey } from "@/lib/auth";

// ---------------------------------------------------------------------------
// DELETE /api/talos/:id/api-keys/:keyId — revoke a scoped API key
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> },
) {
  const { id, keyId } = await params;

  const auth = await verifyAgentApiKey(request, id);
  if (!auth.ok) return auth.response;

  try {
    const deleted = await db
      .delete(tlsScopedApiKeys)
      .where(and(eq(tlsScopedApiKeys.talosId, id), eq(tlsScopedApiKeys.id, keyId)))
      .returning({ id: tlsScopedApiKeys.id });

    if (deleted.length === 0) {
      return Response.json({ error: "API key not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
