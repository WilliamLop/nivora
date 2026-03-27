import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { resetTeamMemberPasswordAsAdmin } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const body = (await request.json()) as { password?: string };

    if (!body.password?.trim()) {
      return NextResponse.json({ error: "La contraseña temporal es obligatoria." }, { status: 400 });
    }

    const member = await resetTeamMemberPasswordAsAdmin(id, body.password.trim());
    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude resetear la contraseña.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}
