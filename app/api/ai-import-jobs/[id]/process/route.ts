import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth";
import { processAiImportJob } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const result = await processAiImportJob(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude procesar el worker de IA.";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: message === "AUTH_REQUIRED" ? "Debes iniciar sesion." : message === "FORBIDDEN" ? "No tienes permisos." : message },
      { status }
    );
  }
}
