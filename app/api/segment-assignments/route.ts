import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import {
  deleteSegmentAssignmentAsAdmin,
  upsertSegmentAssignmentAsAdmin,
} from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as {
      userId?: string;
      marketId?: string;
      segmentId?: string;
    };

    if (!body.userId?.trim() || !body.marketId?.trim() || !body.segmentId?.trim()) {
      return NextResponse.json(
        { error: "Usuario, ciudad y nicho son obligatorios para crear la asignación." },
        { status: 400 }
      );
    }

    const assignment = await upsertSegmentAssignmentAsAdmin(
      body.userId.trim(),
      body.marketId.trim(),
      body.segmentId.trim()
    );

    return NextResponse.json({ assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude guardar la asignación.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as { assignmentId?: string };

    if (!body.assignmentId?.trim()) {
      return NextResponse.json({ error: "La asignación es obligatoria." }, { status: 400 });
    }

    const result = await deleteSegmentAssignmentAsAdmin(session.userId, body.assignmentId.trim());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude eliminar la asignación.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}
