import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { deleteSegment, mergeSegments } from "@/lib/repository";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    await deleteSegment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getErrorMessage(error, "No pude eliminar el nicho.");
    const status =
      message === "AUTH_REQUIRED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message.includes("negocios") || message.includes("importaciones")
            ? 409
            : 500;

    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const body = (await request.json()) as { mergeIntoSegmentId?: string };

    if (!body.mergeIntoSegmentId?.trim()) {
      return NextResponse.json({ error: "El nicho destino es requerido." }, { status: 400 });
    }

    const result = await mergeSegments(id, body.mergeIntoSegmentId.trim());

    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error, "No pude fusionar el nicho.");
    const status =
      message === "AUTH_REQUIRED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message.includes("mismo") || message.includes("ciudad") || message.includes("destino")
            ? 409
            : 500;

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
