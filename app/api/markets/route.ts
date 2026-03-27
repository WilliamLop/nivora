import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { createMarket } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as { name?: string };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre de la ciudad es requerido." }, { status: 400 });
    }

    const market = await createMarket(body.name.trim());
    return NextResponse.json({ market });
  } catch (error) {
    const message = getErrorMessage(error, "No pude crear la ciudad.");
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
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
