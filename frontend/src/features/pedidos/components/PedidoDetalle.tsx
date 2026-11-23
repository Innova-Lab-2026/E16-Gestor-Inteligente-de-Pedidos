"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cambiarCobroPedidoAction,
  cambiarEstadoPedidoAction,
  resolverRevisionPedidoAction,
} from "../actions";
import type { EstadoPedido, Pedido } from "../types";

type PedidoDetallado = Pedido & {
  items?: Array<{
    id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    producto_nombre?: string | null;
    variante_nombre?: string | null;
    producto?: { nombre: string } | null;
    variante?: { nombre: string } | null;
  }>;
};

const SIGUIENTE_ESTADO: Partial<
  Record<EstadoPedido, { estado: EstadoPedido; label: string }>
> = {
  RECIBIDO: { estado: "EN_PREPARACION", label: "Pasar a En preparación" },
  EN_PREPARACION: { estado: "LISTO", label: "Marcar como Listo" },
  LISTO: { estado: "ENTREGADO", label: "Marcar como Entregado" },
  EN_VIAJE: { estado: "ENTREGADO", label: "Marcar como Entregado" },
};

export default function PedidoDetalle({ pedido }: { pedido: PedidoDetallado }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siguiente =
    pedido.estado === "LISTO" && pedido.modalidad_entrega === "ENVIO"
      ? { estado: "EN_VIAJE" as EstadoPedido, label: "Despachar (En viaje)" }
      : SIGUIENTE_ESTADO[pedido.estado];

  const puedeCancelar =
    pedido.estado !== "ENTREGADO" && pedido.estado !== "CANCELADO";

  async function handleCambiarEstado(nuevoEstado: EstadoPedido) {
    setError(null);
    setLoading(true);
    const res = await cambiarEstadoPedidoAction(pedido.id, nuevoEstado);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleToggleCobro() {
    setError(null);
    setLoading(true);
    const nuevoCobro = pedido.estado_cobro === "PAGADO" ? "PENDIENTE" : "PAGADO";
    const res = await cambiarCobroPedidoAction(pedido.id, nuevoCobro);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleQuitarRevision() {
    setError(null);
    setLoading(true);
    const res = await resolverRevisionPedidoAction(pedido.id, false);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-[#586574]">
            Estado actual
          </span>
          <span className="rounded-full bg-[#7622ed]/10 px-3 py-1 text-xs font-bold text-[#7622ed]">
            {pedido.estado}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-[#586574]">
            Cobro
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={handleToggleCobro}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              pedido.estado_cobro === "PAGADO"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {pedido.estado_cobro === "PAGADO"
              ? "Cobrado (tocar para revertir)"
              : "No cobrado (tocar para cobrar)"}
          </button>
        </div>

        {pedido.cliente && (
          <p className="text-sm text-[#102a39]">
            <strong>Cliente:</strong> {pedido.cliente.nombre}
          </p>
        )}

        {pedido.modalidad_entrega && (
          <p className="text-sm text-[#102a39]">
            <strong>Entrega:</strong>{" "}
            {pedido.modalidad_entrega === "ENVIO" ? "Envío" : "Retiro"}
            {pedido.direccion_entrega ? ` · ${pedido.direccion_entrega}` : ""}
          </p>
        )}

        {pedido.observaciones && (
          <p className="rounded-xl bg-[#f8fafc] p-2.5 text-xs text-[#586574]">
            <strong>Observaciones:</strong> {pedido.observaciones}
          </p>
        )}
      </div>

      {pedido.requiere_revision && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <span className="text-xs font-bold text-red-700">
            Este pedido está marcado para revisar
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={handleQuitarRevision}
            className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"
          >
            Marcar revisado
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-3">
        <h2 className="text-sm font-bold text-[#102a39]">Detalle de productos</h2>
        <div className="divide-y divide-[#e2e8f0]">
          {(pedido.items ?? []).map((it) => {
            const nombreProd =
              it.producto_nombre ?? it.producto?.nombre ?? "Producto";
            const nombreVar = it.variante_nombre ?? it.variante?.nombre;
            return (
              <div
                key={it.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#102a39]">
                    {it.cantidad} × {nombreProd}
                  </p>
                  {nombreVar && (
                    <p className="text-xs text-[#586574]">
                      Variante: {nombreVar}
                    </p>
                  )}
                </div>
                <span className="font-bold text-[#102a39]">
                  ${Number(it.subtotal).toLocaleString("es-AR")}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#e2e8f0] pt-2 text-right">
          <span className="text-base font-extrabold text-[#102a39]">
            Total: ${Number(pedido.total).toLocaleString("es-AR")}
          </span>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="space-y-2.5">
        {siguiente && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleCambiarEstado(siguiente.estado)}
            className="h-12 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
          >
            {loading ? "Actualizando..." : siguiente.label}
          </button>
        )}

        {puedeCancelar && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleCambiarEstado("CANCELADO")}
            className="h-11 w-full rounded-full border-2 border-red-600 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar pedido y devolver stock
          </button>
        )}
      </div>
    </div>
  );
}