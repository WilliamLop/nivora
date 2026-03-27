import { redirect } from "next/navigation";

import { NivoraBrand } from "@/components/nivora-brand";
import { LoginForm } from "@/components/login-form";
import { getAppSession, isAuthReady } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isAuthReady()) {
    return (
      <main className="ops-login-shell">
        <NivoraBrand />
        <section className="panel ops-login-panel">
          <p className="mini-label">Configuracion pendiente</p>
          <h1>Activa Supabase Auth</h1>
          <p className="muted">
            Falta configurar <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> junto con
            <code> SUPABASE_URL</code> para poder entrar al CRM multiusuario.
          </p>
        </section>
      </main>
    );
  }

  const session = await getAppSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="ops-login-shell">
      <NivoraBrand />
      <section className="panel ops-login-panel">
        <p className="mini-label">Acceso al equipo</p>
        <h1>Inicia sesión</h1>
        <p className="muted">
          Usa tu usuario y contraseña para entrar a tu cartera o al panel de administración.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
