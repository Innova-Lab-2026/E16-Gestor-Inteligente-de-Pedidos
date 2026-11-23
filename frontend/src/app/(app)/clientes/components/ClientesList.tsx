"use client";

import { useState } from "react";
import Link from "next/link";
import type { Cliente, CondicionCliente } from "../types";

const BADGE_CONDICION: Record<
  CondicionCliente,
  { label: string; className: string }
> = {
  OK: {
    label: "OK",
    className: "bg-emerald-100 text-emerald-800",
  },
  SUSPENDIDO: {
    label: "Suspendido",
    className: "bg-amber-100 text-amber-800",
  },
  BLOQUEADO: {
    label: "Bloqueado",
    className: "bg-red-100 text-red-700",
  },
};

export default function ClientesList({ clientes }: { clientes: Cliente[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroCondicion, setFiltroCondicion] =
    useState<CondicionCliente | null>(null);

  const toggleCondicion = (valor: CondicionCliente) => {
    setFiltroCondicion((prev) => (prev === valor ? null : valor));
  };

  const filtrados = clientes.filter((c) => {
    if (filtroCondicion && c.condicion !== filtroCondicion) return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const texto = [
        c.nombre,
        c.apellido,
        c.telefono,
        c.email,
        c.numero_documento,
        c.direccion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!texto.includes(q)) return false;
    }

    return true;
  });

  if (clientes.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <h2 className="text-lg font-bold text-[#102a39]">
          Todavía no tenés clientes cargados
        </h2>
        <p className="mt-2 max-w-xs text-sm text-[#586574]">
          Guardá los datos de tus clientes habituales para agilizar tus
          pedidos y envíos.
        </p>
        <Link
          href="/clientes/nuevo"
          className="mt-6 rounded-full bg-[#056184] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#044d69]"
        >
          Agregar primer cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono o DNI..."
          className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm text-[#102a39] placeholder:text-[#586574] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#102a39]">
          Filtrar por:
        </span>
        {(["OK", "SUSPENDIDO", "BLOQUEADO"] as const).map((cond) => {
          const activo = filtroCondicion === cond;
          const label = BADGE_CONDICION[cond].label;
          return (
            <button
              key={cond}
              type="button"
              onClick={() => toggleCondicion(cond)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activo
                  ? "border-[#7622ed] bg-[#7622ed] text-white"
                  : "border-[#cbd5e1] bg-white text-[#102a39]"
              }`}
            >
              {activo ? `✓ ${label}` : label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 pb-24">
        {filtrados.map((cliente) => {
          const nombreCompleto = [cliente.nombre, cliente.apellido]
            .filter(Boolean)
            .join(" ");
          const badge =
            BADGE_CONDICION[cliente.condicion] ?? BADGE_CONDICION.OK;

          return (
            <Link
              key={cliente.id}
              href={`/clientes/${cliente.id}`}
              className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs transition hover:border-[#7622ed]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-[#102a39]">{nombreCompleto}</h2>
                  {cliente.condicion !== "OK" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>

                {cliente.telefono && (
                  <p className="text-xs text-[#586574]">
                    Tel: {cliente.telefono}
                  </p>
                )}

                {cliente.direccion && (
                  <p className="line-clamp-1 text-xs text-[#586574]">
                    {cliente.direccion}
                  </p>
                )}
              </div>

              <span className="text-lg font-bold text-[#586574]">›</span>
            </Link>
          );
        })}

        {filtrados.length === 0 && (
          <p className="py-8 text-center text-sm text-[#586574]">
            No hay clientes que coincidan con la búsqueda.
          </p>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-5">
        <Link
          href="/clientes/nuevo"
          aria-label="Agregar nuevo cliente"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#056184] text-2xl font-bold text-white shadow-lg transition hover:bg-[#044d69]"
        >
          +
        </Link>
      </div>
    </div>
  );
}