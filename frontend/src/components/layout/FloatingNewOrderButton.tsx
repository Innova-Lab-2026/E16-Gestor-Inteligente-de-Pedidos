"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function FloatingNewOrderButton() {
  const pathname = usePathname();
  const isCreatePage = /(?:^|\/)(?:nuevo|crear)(?:\/|$)/.test(pathname);
  const hasSectionCreateButton =
    pathname === "/catalogo" || pathname === "/clientes";

  if (
    pathname.startsWith("/configuracion") ||
    isCreatePage ||
    hasSectionCreateButton
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-5">
      <Link
        href="/pedidos/nuevo"
        aria-label="Cargar nuevo pedido"
        className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-[#056184] text-white shadow-lg transition hover:bg-[#044d69]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-6 w-6"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </Link>
    </div>
  );
}
