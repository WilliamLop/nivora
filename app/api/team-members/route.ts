import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { createTeamMemberAsAdmin } from "@/lib/repository";
import type { AppRole } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as {
      email?: string;
      fullName?: string;
      password?: string;
      role?: AppRole;
    };

    if (!body.email?.trim() || !body.fullName?.trim() || !body.password?.trim() || !body.role) {
      return NextResponse.json(
        { error: "Email, nombre, contraseña temporal y rol son obligatorios." },
        { status: 400 }
      );
    }

    const member = await createTeamMemberAsAdmin(
      body.email.trim(),
      body.fullName.trim(),
      body.password.trim(),
      body.role
    );

    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude crear el usuario del equipo.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}
