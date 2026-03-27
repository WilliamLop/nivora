import { NextResponse } from "next/server";

import { clearAuthCookies, resolveAuthorizedMember, setAuthCookies } from "@/lib/auth";
import { createSupabaseUserClient, isSupabaseAuthConfigured } from "@/lib/supabase-auth";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured() || !isSupabaseAuthConfigured()) {
      return NextResponse.json(
        { error: "Falta configurar Supabase Auth para iniciar sesion." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password?.trim() || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios." }, { status: 400 });
    }

    const supabase = createSupabaseUserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: "No pude validar ese usuario o contraseña." }, { status: 401 });
    }

    const member = await resolveAuthorizedMember(data.user);

    if (!member) {
      const response = NextResponse.json(
        { error: "Este usuario no tiene acceso al CRM. Pide al admin que lo active en el equipo." },
        { status: 403 }
      );
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.json({ success: true, user: member });
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No pude iniciar sesion con esas credenciales.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
