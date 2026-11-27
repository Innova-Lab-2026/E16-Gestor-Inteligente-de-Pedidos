"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarDetallesPedidoAction,
  cambiarCobroPedidoAction,
  cambiarEstadoPedidoAction,
  resolverRevisionPedidoAction,
} from "../actions";
import type { EstadoPedido, ModalidadEntrega, Pedido } from "../types";

const MEDIOS_PAGO = ["Transferencia", "Efectivo", "Mercado Pago", "Tarjeta"];

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  RECIBIDO: "Recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_VIAJE: "En viaje",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

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
  const [editandoDetalles, setEditandoDetalles] = useState(false);
  const [modalidad, setModalidad] = useState<ModalidadEntrega | null>(
    pedido.modalidad_entrega,
  );
  const [direccion, setDireccion] = useState(pedido.direccion_entrega ?? "");
  const [fecha, setFecha] = useState(pedido.fecha_prevista_entrega ?? "");
  const [hora, setHora] = useState(
    pedido.hora_prevista_entrega?.slice(0, 5) ?? "",
  );
  const [mediosPago, setMediosPago] = useState(pedido.medios_pago ?? []);
  const nombreCliente = pedido.cliente
    ? [pedido.cliente.nombre, pedido.cliente.apellido]
        .filter(Boolean)
        .join(" ") || null
    : pedido.cliente_nombre ?? null;
  const telefonoCliente = pedido.cliente
    ? pedido.cliente.telefono
    : pedido.cliente_telefono;
  const direccionCliente = pedido.cliente
    ? pedido.cliente.direccion
    : pedido.cliente_direccion;
  const emailCliente = pedido.cliente
    ? pedido.cliente.email
    : pedido.cliente_email;

  const siguiente = SIGUIENTE_ESTADO[pedido.estado];

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

  async function handleGuardarDetalles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const res = await actualizarDetallesPedidoAction(pedido.id, {
      modalidad_entrega: modalidad,
      direccion_entrega:
        modalidad === "ENVIO" ? direccion.trim() || null : null,
      fecha_prevista_entrega: fecha || null,
      hora_prevista_entrega: hora ? `${hora}:00` : null,
      medios_pago: mediosPago,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEditandoDetalles(false);
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
            {ESTADO_LABEL[pedido.estado]}
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

        {(nombreCliente ||
          telefonoCliente ||
          direccionCliente ||
          emailCliente) && (
          <div className="space-y-1 text-sm text-[#102a39]">
            {nombreCliente && (
              <p>
                <strong>Cliente:</strong> {nombreCliente}
              </p>
            )}
            {telefonoCliente && (
              <p>
                <strong>Teléfono:</strong> {telefonoCliente}
              </p>
            )}
            {emailCliente && (
              <p>
                <strong>Email:</strong> {emailCliente}
              </p>
            )}
            {direccionCliente && (
              <p>
                <strong>Dirección del cliente:</strong> {direccionCliente}
              </p>
            )}
          </div>
        )}

        {pedido.modalidad_entrega && (
          <p className="text-sm text-[#102a39]">
            <strong>Entrega:</strong>{" "}
            {pedido.modalidad_entrega === "ENVIO" ? "Envío" : "Retiro"}
            {pedido.direccion_entrega ? ` · ${pedido.direccion_entrega}` : ""}
          </p>
        )}

        {pedido.fecha_prevista_entrega && (
          <p className="text-sm text-[#102a39]">
            <strong>Fecha de entrega:</strong> {pedido.fecha_prevista_entrega}
          </p>
        )}

        {pedido.hora_prevista_entrega && (
          <p className="text-sm text-[#102a39]">
            <strong>Horario:</strong> {pedido.hora_prevista_entrega.slice(0, 5)}
          </p>
        )}

        {pedido.medios_pago?.length ? (
          <p className="text-sm text-[#102a39]">
            <strong>Medio de pago:</strong> {pedido.medios_pago.join(", ")}
          </p>
        ) : null}

        {pedido.observaciones && (
          <p className="rounded-xl bg-[#f8fafc] p-2.5 text-xs text-[#586574]">
            <strong>Observaciones:</strong> {pedido.observaciones}
          </p>
        )}

        {!editandoDetalles && (
          <button
            type="button"
            disabled={loading}
            onClick={() => setEditandoDetalles(true)}
            className="rounded-full border border-[#056184] px-3 py-1.5 text-xs font-bold text-[#056184] disabled:opacity-50"
          >
            Editar entrega y pago
          </button>
        )}
      </div>

      {editandoDetalles && (
        <form
          onSubmit={handleGuardarDetalles}
          className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4"
        >
          <h2 className="text-sm font-bold text-[#102a39]">
            Editar entrega y pago
          </h2>
          <label className="block space-y-1 text-xs font-semibold">
            Modalidad de entrega
            <select
              value={modalidad ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setModalidad(
                  value === "ENVIO" || value === "RETIRO" ? value : null,
                );
              }}
              className="h-11 w-full rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm font-normal"
            >
              <option value="">Sin especificar</option>
              <option value="RETIRO">Retiro en local</option>
              <option value="ENVIO">Envío</option>
            </select>
          </label>
          {modalidad === "ENVIO" && (
            <label className="block space-y-1 text-xs font-semibold">
              Dirección de entrega
              <input
                value={direccion}
                onChange={(event) => setDireccion(event.target.value)}
                maxLength={500}
                className="h-11 w-full rounded-xl border border-[#cbd5e1] px-3 text-sm font-normal"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-semibold">
              Fecha de entrega
              <input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#cbd5e1] px-3 text-sm font-normal"
              />
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              Horario
              <input
                type="time"
                value={hora}
                onChange={(event) => setHora(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#cbd5e1] px-3 text-sm font-normal"
              />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">Medios de pago</legend>
            {[...new Set([...MEDIOS_PAGO, ...mediosPago])].map((medio) => (
              <label key={medio} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mediosPago.includes(medio)}
                  onChange={(event) =>
                    setMediosPago((actuales) =>
                      event.target.checked
                        ? [...actuales, medio]
                        : actuales.filter((item) => item !== medio),
                    )
                  }
                />
                {medio}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#056184] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setEditandoDetalles(false)}
              className="rounded-full border border-[#cbd5e1] px-4 py-2 text-xs font-semibold text-[#102a39] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

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
            {pedido.estado === "RECIBIDO"
              ? "Cancelar pedido"
              : "Cancelar pedido y devolver stock"}
          </button>
        )}
      </div>
    </div>
  );
}