import { DashboardApp } from "@/components/dashboard-app";
import { getAppSession, isAuthReady } from "@/lib/auth";
import { loadDashboardBootstrap } from "@/lib/repository";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isAuthReady()) {
    const bootstrap = await loadDashboardBootstrap();
    return <DashboardApp initialData={bootstrap} />;
  }

  const session = await getAppSession();

  if (!session) {
    redirect("/login");
  }

  const bootstrap = await loadDashboardBootstrap({ session });

  return <DashboardApp initialData={bootstrap} />;
}
