"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import type { EstadoPedido, Pedido } from "../types";

type TabPedidos = "vigentes" | "cancelados" | "entregados";
type FiltroPedido = "revision" | "no_cobrados" | null;

type PedidoConCliente = Pedido & {
  clientes?: { nombre: string } | null;
};

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  RECIBIDO: "Recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_VIAJE: "En viaje",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const ESTADO_BADGE: Record<EstadoPedido, string> = {
  RECIBIDO: "bg-sky-100 text-sky-800",
  EN_PREPARACION: "bg-amber-100 text-amber-800",
  LISTO: "bg-emerald-100 text-emerald-800",
  EN_VIAJE: "bg-indigo-100 text-indigo-800",
  ENTREGADO: "bg-slate-200 text-slate-700",
  CANCELADO: "bg-red-100 text-red-700",
};

export default function PedidosList({
  pedidos,
}: {
  pedidos: PedidoConCliente[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabPedidos>("vigentes");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroPedido>(null);

  const toggleFiltro = (valor: Exclude<FiltroPedido, null>) => {
    setFiltro((prev) => (prev === valor ? null : valor));
  };

  const getNombreCliente = (p: PedidoConCliente) =>
    p.cliente?.nombre ?? p.clientes?.nombre ?? "Cliente sin asignar";

  const filtrados = pedidos.filter((p) => {
    if (tab === "vigentes" && (p.estado === "CANCELADO" || p.estado === "ENTREGADO")) {
      return false;
    }
    if (tab === "cancelados" && p.estado !== "CANCELADO") return false;
    if (tab === "entregados" && p.estado !== "ENTREGADO") return false;

    if (filtro === "revision" && !p.requiere_revision) return false;
    if (filtro === "no_cobrados" && p.estado_cobro !== "PENDIENTE") return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const cliente = getNombreCliente(p).toLowerCase();
      const numero = p.numero ? `#${p.numero}` : "";
      if (!cliente.includes(q) && !numero.includes(q)) return false;
    }

    return true;
  });

  const paraPreparar = filtrados.filter(
    (p) => p.estado === "RECIBIDO" || p.estado === "EN_PREPARACION",
  );
  const paraEntregar = filtrados.filter(
    (p) => p.estado === "LISTO" || p.estado === "EN_VIAJE",
  );

  const renderCard = (pedido: PedidoConCliente) => {
    const cobrado = pedido.estado_cobro === "PAGADO";
    const canal =
      pedido.origen_tipo === "WHATSAPP"
        ? "WhatsApp"
        : pedido.origen_tipo === "MANUAL"
          ? "Manual"
          : pedido.origen_tipo;

    return (
      <Link
        key={pedido.id}
        href={`/pedidos/${pedido.id}`}
        className={`block rounded-2xl border bg-white p-4 shadow-xs transition ${
          pedido.requiere_revision
            ? "border-orange-400 hover:border-orange-500"
            : "border-[#e2e8f0] hover:border-[#7622ed]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#102a39]">
                {getNombreCliente(pedido)}
              </h3>
              {pedido.numero && (
                <span className="text-xs font-semibold text-[#586574]">
                  #{pedido.numero}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="font-bold text-[#102a39]">
              ${Number(pedido.total).toLocaleString("es-AR")}
            </p>
            <span
              className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                cobrado
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                {cobrado ? (
                  <path d="m5 12 4 4L19 6" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 9 6 6m0-6-6 6" />
                  </>
                )}
              </svg>
              {cobrado ? "Cobrado" : "No cobrado"}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_BADGE[pedido.estado]}`}
            >
              {ESTADO_LABEL[pedido.estado]}
            </span>

            {pedido.requiere_revision && (
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-800">
                Para revisar
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-[#586574]">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
              <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.4Z" />
            </svg>
            {canal}
          </span>
          {pedido.modalidad_entrega && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-[#586574]">
              {pedido.modalidad_entrega === "ENVIO" ? "Con envío" : "Retiro"}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-[#586574]">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
            {pedido.fecha_prevista_entrega ?? "Sin fecha"}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 border-b border-[#e2e8f0] text-xs">
        {(
          [
            { key: "vigentes", label: "Vigentes" },
            { key: "cancelados", label: "Cancelados" },
            { key: "entregados", label: "Entregados" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`border-b-2 py-2.5 transition ${
              tab === item.key
                ? "border-[#7622ed] font-bold text-[#7622ed]"
                : "border-transparent font-medium text-[#586574] hover:text-[#102a39]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente o # de pedido..."
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

      {tab === "vigentes" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#102a39]">Filtrar por:</span>
          {(
            [
              { key: "revision", label: "Para revisar" },
              { key: "no_cobrados", label: "No cobrados" },
            ] as const
          ).map((item) => {
            const activo = filtro === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleFiltro(item.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activo
                    ? "border-[#7622ed] bg-[#7622ed] text-white"
                    : "border-[#cbd5e1] bg-white text-[#102a39]"
                }`}
              >
                {activo ? `✓ ${item.label}` : item.label}
              </button>
            );
          })}
        </div>
      )}

      {pedidos.length === 0 ? (
        <EmptyState
          titulo="Todavía no tenés pedidos cargados"
          descripcion="Cuando ingrese uno nuevo por WhatsApp o cargues uno manual, lo vas a ver acá."
          textoBoton="Cargar nuevo pedido"
          onAccion={() => router.push("/pedidos/nuevo")}
        />
      ) : filtrados.length === 0 ? (
        <div className="mt-10 flex flex-col items-center pb-24 text-center">
          <h2 className="text-lg font-bold text-[#102a39]">
            {tab === "vigentes"
              ? "No tenés pedidos vigentes"
              : tab === "cancelados"
                ? "No tenés pedidos cancelados"
                : "No tenés pedidos entregados"}
          </h2>
          <p className="mt-2 max-w-xs text-sm text-[#586574]">
            Cuando ingrese uno nuevo por WhatsApp o cargues uno manual, lo vas a ver acá.
          </p>
          {tab === "vigentes" && (
            <Link
              href="/pedidos/nuevo"
              className="mt-6 rounded-full bg-[#056184] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#044d69]"
            >
              Cargar nuevo pedido
            </Link>
          )}
        </div>
      ) : tab === "vigentes" ? (
        <div className="space-y-5 pb-24">
          {paraPreparar.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold tracking-wide text-[#586574] uppercase">
                Para preparar ({paraPreparar.length})
              </h2>
              <div className="space-y-3">{paraPreparar.map(renderCard)}</div>
            </div>
          )}

          {paraEntregar.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold tracking-wide text-[#586574] uppercase">
                Para entregar ({paraEntregar.length})
              </h2>
              <div className="space-y-3">{paraEntregar.map(renderCard)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 pb-24">{filtrados.map(renderCard)}</div>
      )}

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-5">
        <Link
          href="/pedidos/nuevo"
          aria-label="Cargar nuevo pedido"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#056184] text-2xl font-bold text-white shadow-lg transition hover:bg-[#044d69]"
        >
          +
        </Link>
      </div>
    </div>
  );
}