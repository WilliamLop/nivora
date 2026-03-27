import { NextResponse } from "next/server";

import { requireLeadAccess } from "@/lib/auth";
import { createLeadActivityForSession, loadLeadActivitiesForSession } from "@/lib/repository";
import type { LeadActivityType, OpsStatus, Stage } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireLeadAccess(id);
    const activities = await loadLeadActivitiesForSession(session, id);
    return NextResponse.json({ activities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude cargar el historial.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes acceso a ese lead." : message },
      { status }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireLeadAccess(id);
    const body = (await request.json()) as {
      activityType?: LeadActivityType | string;
      outcome?: string;
      summary?: string;
      nextFollowUpAt?: string | null;
      opsStatus?: OpsStatus | string;
      stage?: Stage | string;
    };

    if (!body.summary?.trim()) {
      return NextResponse.json({ error: "El resumen del seguimiento es obligatorio." }, { status: 400 });
    }

    const result = await createLeadActivityForSession(session, id, {
      activityType: body.activityType,
      outcome: body.outcome,
      summary: body.summary.trim(),
      nextFollowUpAt: body.nextFollowUpAt || null,
      opsStatus: body.opsStatus,
      stage: body.stage,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude guardar el seguimiento.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes acceso a ese lead." : message },
      { status }
    );
  }
}
