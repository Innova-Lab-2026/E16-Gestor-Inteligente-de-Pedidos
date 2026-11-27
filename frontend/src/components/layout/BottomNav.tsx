"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/pedidos", label: "Pedidos", icon: "/icons/pedidos.png" },
  { href: "/catalogo", label: "Catálogo", icon: "/icons/catalogo.png" },
  { href: "/dashboard", label: "Hoy", icon: "/icons/hoy.png" },
  { href: "/clientes", label: "Clientes", icon: "/icons/clientes.png" },
  { href: "/reportes", label: "Reportes", icon: "/icons/reportes.png" },
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
            prefetch={false}
            className={`flex flex-col items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold transition ${
              active
                ? "bg-[#7622ed]/10 text-[#7622ed]"
                : "text-[#586574] opacity-75 hover:text-[#102a39] hover:opacity-100"
            }`}
          >
            <img
              src={item.icon}
              alt=""
              aria-hidden="true"
              className="h-5 w-5 object-contain"
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}