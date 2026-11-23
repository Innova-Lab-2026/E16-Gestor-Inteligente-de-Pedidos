import Link from "next/link";
import { requireSession } from "@/features/auth/guards";
import { backendFetch } from "@/lib/api";
import BottomNav from "@/components/layout/BottomNav";

type Emprendimiento = { id: string; nombre: string };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  const { data } = await backendFetch<Emprendimiento[]>("/emprendimientos");
  const nombreEmprendimiento = data?.[0]?.nombre ?? "Mi emprendimiento";

  return (
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
        <span className="rounded-full border-2 border-[#7622ed] bg-white px-4 py-1 text-sm font-bold text-[#7622ed]">
          {nombreEmprendimiento}
        </span>
      </header>

      <main className="flex-1 px-5 pb-24">{children}</main>

      <BottomNav />
    </div>
  );
}