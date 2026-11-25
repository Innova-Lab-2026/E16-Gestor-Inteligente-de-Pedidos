"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/features/auth/actions";
import { useEmprendimiento } from "./EmprendimientoProvider";

export default function EmprendimientoSelector() {
  const {
    emprendimientos,
    emprendimientoActivo,
    seleccionarEmprendimiento,
    error,
  } = useEmprendimiento();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);

  async function seleccionar(id: string) {
    setChanging(true);
    const selected = await seleccionarEmprendimiento(id);
    setChanging(false);
    if (selected) setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex max-w-[230px] items-center gap-2 rounded-full border border-[#6D28D9] bg-white px-4 py-1.5 text-sm font-bold text-[#6D28D9]"
      >
        <span className="truncate">
          {emprendimientoActivo?.nombre ?? "Mi emprendimiento"}
        </span>
        {emprendimientos.length > 1 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 shrink-0"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Seleccionar emprendimiento"
          className="absolute right-0 z-30 mt-2 w-[min(320px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#6D28D9]/25 bg-white p-2 shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto">
            {emprendimientos.map((emprendimiento) => {
              const isActive = emprendimiento.id === emprendimientoActivo?.id;
              return (
                <button
                  key={emprendimiento.id}
                  type="button"
                  role="menuitem"
                  disabled={changing}
                  onClick={() => void seleccionar(emprendimiento.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#102a39] transition hover:bg-[#6D28D9]/5 disabled:opacity-60"
                >
                  <span className="truncate">
                    {emprendimiento.nombre ?? "Mi emprendimiento"}
                  </span>
                  {isActive && (
                    <svg
                      aria-label="Activo"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-5 w-5 shrink-0 text-[#6D28D9]"
                    >
                      <path
                        d="m4 10 4 4 8-8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-[#6D28D9]/15 pt-2">
            <Link
              href="/emprendimientos/nuevo"
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-sm font-bold text-[#0E4D64] transition hover:bg-[#0E4D64]/5"
            >
              + Crear nuevo emprendimiento
            </Link>
          </div>
          <div className="mt-1 border-t border-[#6D28D9]/15 pt-2">
            <button
              type="button"
              role="menuitem"
              aria-disabled="true"
              aria-label="Configuración (próximamente)"
              title="Configuración (próximamente)"
              className="flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#586574] opacity-75"
            >
              <span>Configuración</span>
              <span
                aria-hidden="true"
                className="shrink-0 rounded-full bg-[#7622ed]/10 px-2 py-1 text-[10px] font-semibold text-[#7622ed]"
              >
                Próximamente
              </span>
            </button>
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
          {error && (
            <p role="alert" className="px-3 pb-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
