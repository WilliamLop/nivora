import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { assignLeadsToUserAsAdmin } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as {
      leadIds?: string[];
      assignedUserId?: string | null;
    };

    const leadIds = Array.isArray(body.leadIds) ? body.leadIds : [];

    if (!leadIds.length) {
      return NextResponse.json({ error: "Debes enviar al menos un lead." }, { status: 400 });
    }

    const count = await assignLeadsToUserAsAdmin(session.userId, leadIds, body.assignedUserId || null);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude reasignar los leads.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}
