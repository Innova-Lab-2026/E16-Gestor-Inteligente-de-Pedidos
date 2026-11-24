"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function FloatingNewOrderButton() {
  const pathname = usePathname();
  const isCreatePage = /(?:^|\/)(?:nuevo|crear)(?:\/|$)/.test(pathname);

  if (pathname.startsWith("/configuracion") || isCreatePage) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-5">
      <Link
        href="/pedidos/nuevo"
        aria-label="Cargar nuevo pedido"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#056184] text-2xl font-bold text-white shadow-lg transition hover:bg-[#044d69]"
      >
        +
      </Link>
    </div>
  );
}
