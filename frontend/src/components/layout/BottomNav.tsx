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
      className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-[#e2e8f0] bg-white px-2 py-2 md:max-w-[720px]"
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-label={item.label}
            className={`flex items-center justify-center rounded-full px-3.5 py-1.5 transition ${
              active ? "bg-[#7622ed]/15" : "bg-transparent hover:bg-[#7622ed]/5"
            }`}
          >
            <img
              src={item.icon}
              alt={item.label}
              className="h-10 w-auto object-contain"
            />
          </Link>
        );
      })}
    </nav>
  );
}