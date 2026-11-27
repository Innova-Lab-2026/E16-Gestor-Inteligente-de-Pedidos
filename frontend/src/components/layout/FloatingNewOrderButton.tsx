"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./FloatingNewOrderButton.module.css";

export default function FloatingNewOrderButton() {
  const pathname = usePathname();
  const isCreatePage = /(?:^|\/)(?:nuevo|crear)(?:\/|$)/.test(pathname);

  if (pathname.startsWith("/configuracion") || isCreatePage) {
    return null;
  }

  const action = pathname.startsWith("/catalogo")
    ? { href: "/catalogo/nuevo", label: "Nuevo producto" }
    : pathname.startsWith("/clientes")
      ? { href: "/clientes/nuevo", label: "Nuevo cliente" }
      : { href: "/pedidos/nuevo", label: "Nuevo pedido" };

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-5 md:max-w-[720px]">
      <Link
        href={action.href}
        prefetch={false}
        aria-label={action.label}
        className={`${styles.action} pointer-events-auto`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-6 w-6 shrink-0"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.actionLabel}>{action.label}</span>
      </Link>
    </div>
  );
}