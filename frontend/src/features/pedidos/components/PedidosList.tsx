"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import type {
  EstadoCobro,
  EstadoOperativoPedido,
  EstadoPedido,
  Pedido,
} from "../types";

type TabPedidos = "vigentes" | "cancelados" | "entregados";

type FiltrosPedidos = {
  tab: TabPedidos;
  busqueda: string;
  clienteId: string;
  desde: string;
  hasta: string;
  estado: EstadoOperativoPedido | "";
  estadoCobro: EstadoCobro | "";
  requiereRevision: boolean;
  offset: number;
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
  filtros,
  hasNext,
}: {
  pedidos: Pedido[];
  filtros: FiltrosPedidos;
  hasNext: boolean;
}) {
  const router = useRouter();
  const navegarConFiltros = (cambios: Partial<FiltrosPedidos>) => {
    const siguiente = { ...filtros, ...cambios };
    const params = new URLSearchParams();
    params.set("tab", siguiente.tab);
    if (siguiente.busqueda) params.set("busqueda", siguiente.busqueda);
    if (siguiente.clienteId) params.set("cliente_id", siguiente.clienteId);
    if (siguiente.desde) params.set("desde", siguiente.desde);
    if (siguiente.hasta) params.set("hasta", siguiente.hasta);
    if (siguiente.tab === "vigentes" && siguiente.estado) {
      params.set("estado", siguiente.estado);
    }
    if (siguiente.estadoCobro) {
      params.set("estado_cobro", siguiente.estadoCobro);
    }
    if (siguiente.requiereRevision) {
      params.set("requiere_revision", "true");
    }
    params.set("offset", String(siguiente.offset));
    router.push(`/pedidos?${params.toString()}`);
  };

  const aplicarFiltros = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    navegarConFiltros({
      busqueda: String(formData.get("busqueda") ?? "").trim(),
      desde: String(formData.get("desde") ?? ""),
      hasta: String(formData.get("hasta") ?? ""),
      estadoCobro: String(formData.get("estado_cobro") ?? "") as EstadoCobro | "",
      offset: 0,
    });
  };

  const getNombreCliente = (p: Pedido) => {
    if (!p.cliente) return p.cliente_nombre ?? "Cliente sin asignar";
    return (
      [p.cliente.nombre, p.cliente.apellido].filter(Boolean).join(" ") ||
      "Cliente sin asignar"
    );
  };

  const paraPreparar = pedidos.filter(
    (p) => p.estado === "RECIBIDO" || p.estado === "EN_PREPARACION",
  );
  const paraEntregar = pedidos.filter(
    (p) => p.estado === "LISTO" || p.estado === "EN_VIAJE",
  );
  const tieneFiltros =
    Boolean(filtros.busqueda || filtros.clienteId || filtros.desde || filtros.hasta) ||
    Boolean(filtros.estado || filtros.estadoCobro || filtros.requiereRevision);

  const renderCard = (pedido: Pedido) => {
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
            onClick={() => navegarConFiltros({ tab: item.key, offset: 0 })}
            className={`border-b-2 py-2.5 transition ${
              filtros.tab === item.key
                ? "border-[#7622ed] font-bold text-[#7622ed]"
                : "border-transparent font-medium text-[#586574] hover:text-[#102a39]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        key={JSON.stringify(filtros)}
        onSubmit={aplicarFiltros}
        className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-3"
      >
        <div className="grid min-w-0 items-end gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1 text-xs font-semibold text-[#102a39]">
            Cliente o # pedido
            <input
              name="busqueda"
              type="search"
              defaultValue={filtros.busqueda}
              placeholder="Nombre o # pedido"
              className="h-10 w-full min-w-0 rounded-xl border border-[#cbd5e1] px-3 text-sm font-normal"
            />
          </label>
          <label className="min-w-0 space-y-1 text-xs font-semibold text-[#102a39]">
            Estado de cobro
            <select
              name="estado_cobro"
              defaultValue={filtros.estadoCobro}
              className="h-10 w-full min-w-0 rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm font-normal"
            >
              <option value="">Todos</option>
              <option value="PAGADO">Pagado</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-[#102a39]">
            Fecha desde
            <input
              name="desde"
              type="date"
              defaultValue={filtros.desde}
              className="h-10 w-full rounded-xl border border-[#cbd5e1] px-3 text-sm font-normal"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[#102a39]">
            Fecha hasta
            <input
              name="hasta"
              type="date"
              defaultValue={filtros.hasta}
              className="h-10 w-full rounded-xl border border-[#cbd5e1] px-3 text-sm font-normal"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-full bg-[#056184] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#044d69]"
          >
            Aplicar filtros
          </button>
          {tieneFiltros && (
            <button
              type="button"
              onClick={() =>
                navegarConFiltros({
                  busqueda: "",
                  clienteId: "",
                  desde: "",
                  hasta: "",
                  estado: "",
                  estadoCobro: "",
                  requiereRevision: false,
                  offset: 0,
                })
              }
              className="rounded-full border border-[#cbd5e1] px-4 py-2 text-xs font-semibold text-[#102a39]"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </form>

      {filtros.tab === "vigentes" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#102a39]">
              Estado del pedido:
            </span>
            {(
              [
                { estado: "", label: "Todos" },
                { estado: "RECIBIDO", label: "Recibido" },
                { estado: "EN_PREPARACION", label: "En preparación" },
                { estado: "LISTO", label: "Listo" },
              ] as const
            ).map((item) => {
              const activo = filtros.estado === item.estado;
              return (
                <button
                  key={item.estado || "todos"}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    navegarConFiltros({ estado: item.estado, offset: 0 })
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    activo
                      ? "border-[#7622ed] bg-[#7622ed] text-white"
                      : "border-[#cbd5e1] bg-white text-[#102a39]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#102a39]">
              Filtrar por:
            </span>
            {(
              [
                {
                  key: "revision",
                  label: "Para revisar",
                  active: filtros.requiereRevision,
                  action: () =>
                    navegarConFiltros({
                      requiereRevision: !filtros.requiereRevision,
                      offset: 0,
                    }),
                },
                {
                  key: "no_cobrados",
                  label: "No cobrados",
                  active: filtros.estadoCobro === "PENDIENTE",
                  action: () =>
                    navegarConFiltros({
                      estadoCobro:
                        filtros.estadoCobro === "PENDIENTE" ? "" : "PENDIENTE",
                      offset: 0,
                    }),
                },
              ] as const
            ).map((item) => {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    item.active
                      ? "border-[#7622ed] bg-[#7622ed] text-white"
                      : "border-[#cbd5e1] bg-white text-[#102a39]"
                  }`}
                >
                  {item.active ? `✓ ${item.label}` : item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {pedidos.length === 0 ? (
        !tieneFiltros && filtros.tab === "vigentes" && filtros.offset === 0 ? (
          <EmptyState
            titulo="No tenés pedidos vigentes"
            descripcion="Cargá un pedido nuevo para verlo en esta pestaña."
            textoBoton="Cargar nuevo pedido"
            onAccion={() => router.push("/pedidos/nuevo")}
          />
        ) : (
          <div className="mt-10 flex flex-col items-center pb-24 text-center">
            <h2 className="text-lg font-bold text-[#102a39]">
              {tieneFiltros
                ? "No encontramos pedidos con esos filtros"
                : filtros.tab === "vigentes"
                  ? "No tenés pedidos vigentes"
                  : filtros.tab === "cancelados"
                    ? "No tenés pedidos cancelados"
                    : "No tenés pedidos entregados"}
            </h2>
            <p className="mt-2 max-w-xs text-sm text-[#586574]">
              {tieneFiltros
                ? "Probá cambiar o limpiar los filtros para ver otros pedidos."
                : "Cuando ingrese uno nuevo por WhatsApp o cargues uno manual, lo vas a ver acá."}
            </p>
          </div>
        )
      ) : filtros.tab === "vigentes" ? (
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
        <div className="space-y-3 pb-24">{pedidos.map(renderCard)}</div>
      )}

      {(filtros.offset > 0 || hasNext) && (
        <nav
          aria-label="Paginación de pedidos"
          className="flex items-center justify-between border-t border-[#e2e8f0] pt-3"
        >
          <button
            type="button"
            disabled={filtros.offset === 0}
            onClick={() =>
              navegarConFiltros({
                offset: Math.max(0, filtros.offset - 50),
              })
            }
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-xs font-semibold text-[#102a39] disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-[#586574]">
            Página {Math.floor(filtros.offset / 50) + 1}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() =>
              navegarConFiltros({ offset: filtros.offset + 50 })
            }
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-xs font-semibold text-[#102a39] disabled:opacity-40"
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}