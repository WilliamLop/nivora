import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { saveWorkspaceFocus } from "@/lib/repository";
import type { WorkspaceFocus } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as Partial<WorkspaceFocus>;
    const focus = await saveWorkspaceFocus(body);

    return NextResponse.json({ focus });
  } catch (error) {
    const message = getErrorMessage(error, "No pude guardar el foco.");
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
