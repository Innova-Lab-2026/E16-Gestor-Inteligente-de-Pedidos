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
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white text-[#102a39] shadow-sm"
        style={{
          backgroundImage: 'url("/images/cuadricula-bg.png")',
          backgroundPosition: "top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 260px",
        }}
      >
        <header className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-bungee-shade)] text-2xl text-[#7622ed]"
          >
            E
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Modo oscuro (próximamente)"
                title="Modo oscuro (próximamente)"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#e2e8f0] bg-white text-[#586574] transition hover:border-[#7622ed] hover:text-[#7622ed]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="3.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M12 2.75v2m0 14.5v2m9.25-9.25h-2m-14.5 0h-2m15.79-6.54-1.42 1.42M6.88 17.12l-1.42 1.42m13.08 0-1.42-1.42M6.88 6.88 5.46 5.46"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <span
                aria-hidden="true"
                className="absolute top-full left-1/2 z-10 mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#7622ed] px-1.5 py-0.5 text-[8px] leading-none font-semibold text-white"
              >
                Próximamente
              </span>
            </div>
            <EmprendimientoSelector />
          </div>
        </header>

        <main className="flex-1 px-5 pb-24">{children}</main>

        <FloatingNewOrderButton />
        <BottomNav />
        <OnboardingModal />
      </div>
    </EmprendimientoProvider>
  );
}