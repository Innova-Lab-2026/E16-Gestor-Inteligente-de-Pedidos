"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
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
  const router = useRouter();
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
      <EmptyState
        titulo="Todavía no tenés clientes cargados"
        descripcion="Guardá los datos de tus clientes habituales para agilizar tus pedidos y envíos."
        textoBoton="Agregar primer cliente"
        onAccion={() => router.push("/clientes/nuevo")}
      />
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
          className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 pr-11 text-sm text-[#102a39] placeholder:text-[#586574] focus:outline-none"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-[#586574]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
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
          const iniciales = `${cliente.nombre.trim().charAt(0)}${
            cliente.apellido?.trim().charAt(0) ?? ""
          }`.toUpperCase();

          return (
            <Link
              key={cliente.id}
              href={`/clientes/${cliente.id}`}
              className="flex items-start gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs transition hover:border-[#7622ed]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7622ed]/10 text-sm font-bold text-[#7622ed]">
                {iniciales}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-[#102a39]">{nombreCompleto}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                  >
                    {badge.label === "OK" ? "Ok" : badge.label}
                  </span>
                </div>

                {cliente.observaciones && (
                  <p className="text-xs text-[#586574]">
                    {cliente.observaciones}
                  </p>
                )}
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

              <span className="pt-1 text-lg font-bold text-[#586574]">›</span>
            </Link>
          );
        })}

        {filtrados.length === 0 && (
          <p className="py-8 text-center text-sm text-[#586574]">
            No hay clientes que coincidan con la búsqueda.
          </p>
        )}
      </div>

    </div>
  );
}