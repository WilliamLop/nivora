import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { createSegment } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as {
      marketId?: string;
      marketName?: string;
      name?: string;
    };

    if (!body.marketId?.trim()) {
      return NextResponse.json({ error: "La ciudad es requerida." }, { status: 400 });
    }

    if (!body.marketName?.trim()) {
      return NextResponse.json({ error: "El nombre de la ciudad es requerido." }, { status: 400 });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre del nicho es requerido." }, { status: 400 });
    }

    const segment = await createSegment(body.marketId.trim(), body.marketName.trim(), body.name.trim());

    return NextResponse.json({ segment });
  } catch (error) {
    const message = getErrorMessage(error, "No pude crear el nicho.");
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
