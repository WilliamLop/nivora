import { NextResponse } from "next/server";

import { requireAdminSession, requireLeadAccess } from "@/lib/auth";
import { deleteLead, updateLead, updateLeadStageForSession } from "@/lib/repository";
import type { Lead, Stage } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireLeadAccess(id);
    const body = (await request.json()) as { stage?: Stage };

    if (!body.stage) {
      return NextResponse.json({ error: "La etapa es obligatoria." }, { status: 400 });
    }

    const lead = await updateLeadStageForSession(session, id, body.stage);
    return NextResponse.json({ lead });
  } catch (error) {
    const message = getErrorMessage(error, "No pude actualizar la etapa.");
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes acceso a ese lead." : message },
      { status }
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await requireAdminSession();
    const body = (await request.json()) as { lead?: Lead };

    if (!body.lead) {
      return NextResponse.json({ error: "El lead es obligatorio." }, { status: 400 });
    }

    const lead = await updateLead(id, body.lead);
    return NextResponse.json({ lead });
  } catch (error) {
    const message = getErrorMessage(error, "No pude actualizar el lead.");
    const status =
      message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : message.includes("Ya existe otro lead") ? 409 : 500;

    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await requireAdminSession();
    await deleteLead(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getErrorMessage(error, "No pude eliminar el lead.");
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}
