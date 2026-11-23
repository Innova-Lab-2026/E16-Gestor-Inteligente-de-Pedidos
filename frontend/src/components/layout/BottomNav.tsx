"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/pedidos", label: "Pedidos" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/dashboard", label: "Hoy" },
  { href: "/clientes", label: "Clientes" },
  { href: "/numeros", label: "Números" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-[#e2e8f0] bg-white px-2 py-2.5"
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
              active
                ? "bg-[#7622ed]/10 text-[#7622ed]"
                : "text-[#586574] hover:text-[#102a39]"
            }`}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}