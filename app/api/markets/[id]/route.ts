import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { updateMarket, deleteMarket } from "@/lib/repository";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const body = (await request.json()) as { name?: string };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre de la ciudad es requerido." }, { status: 400 });
    }

    const market = await updateMarket(id, body.name.trim());
    return NextResponse.json({ market });
  } catch (error) {
    const message = getErrorMessage(error, "No pude actualizar la ciudad.");
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const focus = await deleteMarket(id);
    return NextResponse.json({ success: true, focus });
  } catch (error) {
    const message = getErrorMessage(error, "No pude eliminar la ciudad.");
    const status =
      message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : message.includes("negocios") ? 409 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return fallback;
}
