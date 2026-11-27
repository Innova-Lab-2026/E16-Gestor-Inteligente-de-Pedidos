import Link from "next/link";
import { cookies } from "next/headers";
import { requireSession } from "@/features/auth/guards";
import { EMPRENDIMIENTO_COOKIE } from "@/features/auth/constants";
import { EmprendimientoProvider } from "@/features/emprendimientos/EmprendimientoProvider";
import type { Emprendimiento } from "@/features/emprendimientos/actions";
import EmprendimientoSelector from "@/features/emprendimientos/EmprendimientoSelector";
import { backendFetch } from "@/lib/api";
import BottomNav from "@/components/layout/BottomNav";
import FloatingNewOrderButton from "@/components/layout/FloatingNewOrderButton";
import OnboardingModal from "@/components/OnboardingModal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  const { data } = await backendFetch<Emprendimiento[]>("/emprendimientos");
  const emprendimientos = data ?? [];
  const savedId = (await cookies()).get(EMPRENDIMIENTO_COOKIE)?.value;
  const initialActiveId =
    emprendimientos.find((item) => item.id === savedId)?.id ??
    emprendimientos[0]?.id ??
    null;

  return (
    <EmprendimientoProvider
      emprendimientos={emprendimientos}
      initialActiveId={initialActiveId}
    >
      <div className="min-h-dvh bg-[#eef2f6]">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white text-[#102a39] shadow-xl">
          <header className="app-grid-header flex w-full items-center justify-between px-5 pt-5 pb-4">
            <Link
              href="/dashboard"
              prefetch={false}
              className="font-[family-name:var(--font-bungee-shade)] text-4xl text-[#7622ed]">
                E
            </Link>
            <div className="flex items-center gap-2">
              <EmprendimientoSelector />
            </div>
          </header>

          <main className="flex-1 px-5 pb-24">{children}</main>

          <FloatingNewOrderButton />
          <BottomNav />
          <OnboardingModal />
        </div>
      </div>
    </EmprendimientoProvider>
  );
}