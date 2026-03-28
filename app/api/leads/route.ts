import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { createLead, deleteLeads, importLeads } from "@/lib/repository";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Usa la pagina principal para cargar el dashboard." }, { status: 405 });
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as { lead?: Lead; leads?: Lead[]; importFileName?: string };

    if (Array.isArray(body.leads)) {
      const result = await importLeads(body.leads, session.userId, body.importFileName);
      return NextResponse.json(result);
    }

    if (body.lead) {
      const lead = await createLead(body.lead, session.userId);
      return NextResponse.json({ lead });
    }

    return NextResponse.json({ error: "Payload invalido para leads." }, { status: 400 });
  } catch (error) {
    const message = getErrorMessage(error, "No pude guardar los leads.");
    const status =
      message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : message.includes("Ya existe un lead") ? 409 : 500;

    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (!ids.length) {
      return NextResponse.json({ error: "Debes enviar al menos un lead para eliminar." }, { status: 400 });
    }

    const count = await deleteLeads(ids);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    const message = getErrorMessage(error, "No pude eliminar los leads.");
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
