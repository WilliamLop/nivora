import { NextResponse } from "next/server";

import { requireLeadAccess } from "@/lib/auth";
import { updateLeadOpsForSession } from "@/lib/repository";
import type { OpsStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireLeadAccess(id);
    const body = (await request.json()) as {
      assignedUserId?: string | null;
      opsStatus?: OpsStatus | string;
      nextFollowUpAt?: string | null;
      summary?: string | null;
    };

    const lead = await updateLeadOpsForSession(session, id, body);
    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude actualizar el control del lead.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes acceso a ese lead." : message },
      { status }
    );
  }
}
