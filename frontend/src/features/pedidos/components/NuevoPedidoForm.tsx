"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Producto, Variante } from "@/features/catalogo/types";
import type { Cliente } from "@/features/clientes/types";
import { crearClienteAction } from "@/features/clientes/actions";
import { crearPedidoManualAction } from "../actions";
import type { EstadoCobro, ModalidadEntrega } from "../types";

export type ProductoConVariantes = Producto & {
  variantes?: Variante[];
};

type ItemDraft = {
  producto_id: string;
  variante_id: string;
  cantidad: number;
};

export default function NuevoPedidoForm({
  productos,
  clientes,
}: {
  productos: ProductoConVariantes[];
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ItemDraft[]>([
    { producto_id: "", variante_id: "", cantidad: 1 },
  ]);

  const [modoCliente, setModoCliente] = useState<"existente" | "nuevo">(
    clientes.length > 0 ? "existente" : "nuevo",
  );
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");

  const [modalidad, setModalidad] = useState<ModalidadEntrega>("RETIRO");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [estadoCobro, setEstadoCobro] = useState<EstadoCobro>("PENDIENTE");
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [observaciones, setObservaciones] = useState("");

  const getProducto = (id: string) => productos.find((p) => p.id === id);

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { producto_id: "", variante_id: "", cantidad: 1 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((acc, it) => {
    const prod = getProducto(it.producto_id);
    if (!prod) return acc;
    return acc + Number(prod.precio) * it.cantidad;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const itemsValidos = items.filter((it) => it.producto_id);
    if (itemsValidos.length === 0) {
      setError("Seleccioná al menos un producto.");
      return;
    }

    for (const it of itemsValidos) {
      const prod = getProducto(it.producto_id);
      if (prod?.tiene_variantes && !it.variante_id) {
        setError(`Elegí una variante para "${prod.nombre}".`);
        return;
      }
    }

    setLoading(true);

    let resolvedClienteId: string | null = null;

    if (modoCliente === "existente" && clienteId) {
      resolvedClienteId = clienteId;
    } else if (modoCliente === "nuevo" && clienteNombre.trim()) {
      const cliRes = await crearClienteAction({
        nombre: clienteNombre.trim(),
        telefono:
          clienteTelefono.trim().length >= 5
            ? clienteTelefono.trim()
            : undefined,
        direccion: clienteDireccion.trim() || undefined,
      });
      if (cliRes.error || !cliRes.data) {
        setError(cliRes.error ?? "No se pudo registrar el cliente.");
        setLoading(false);
        return;
      }
      resolvedClienteId = cliRes.data.id;
    }

    const res = await crearPedidoManualAction({
      cliente_id: resolvedClienteId,
      modalidad_entrega: modalidad,
      direccion_entrega:
        modalidad === "ENVIO" ? direccionEntrega.trim() || undefined : undefined,
      fecha_prevista_entrega: fechaEntrega || undefined,
      hora_prevista_entrega: horaEntrega ? `${horaEntrega}:00` : undefined,
      estado_cobro: estadoCobro,
      medios_pago: estadoCobro === "PAGADO" ? [medioPago] : undefined,
      observaciones: observaciones.trim() || undefined,
      items: itemsValidos.map((it) => ({
        producto_id: it.producto_id,
        variante_id: it.variante_id || null,
        cantidad: Number(it.cantidad),
      })),
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    router.push("/pedidos");
  }

  if (productos.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-[#e2e8f0] p-5 text-center">
        <p className="font-bold text-[#102a39]">
          Necesitás al menos un producto activo en tu catálogo
        </p>
        <p className="mt-1 text-xs text-[#586574]">
          Cargá tus productos primero para poder registrar pedidos.
        </p>
        <Link
          href="/catalogo/nuevo"
          className="mt-4 inline-block rounded-full bg-[#056184] px-5 py-2.5 text-xs font-bold text-white"
        >
          Ir a cargar producto
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      <div className="space-y-3 rounded-2xl border border-[#e2e8f0] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#102a39]">Productos *</h2>
          <button
            type="button"
            onClick={addItem}
            className="text-xs font-bold text-[#7622ed] underline"
          >
            + Agregar producto
          </button>
        </div>

        {items.map((item, idx) => {
          const prod = getProducto(item.producto_id);
          const subtotal = prod ? Number(prod.precio) * item.cantidad : 0;

          return (
            <div
              key={idx}
              className="space-y-2.5 rounded-xl bg-[#f8fafc] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <select
                  required
                  value={item.producto_id}
                  onChange={(e) =>
                    updateItem(idx, {
                      producto_id: e.target.value,
                      variante_id: "",
                    })
                  }
                  className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="">Seleccionar producto...</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (${Number(p.precio).toLocaleString("es-AR")})
                    </option>
                  ))}
                </select>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs font-bold text-red-600"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {prod?.tiene_variantes && (
                <select
                  required
                  value={item.variante_id}
                  onChange={(e) =>
                    updateItem(idx, { variante_id: e.target.value })
                  }
                  className="h-10 w-full rounded-full border-2 border-[#102a39] bg-white px-3 text-xs focus:outline-none"
                >
                  <option value="">Elegir variante...</option>
                  {(prod.variantes ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre} ({v.stock_disponible} disp.)
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <span>Cantidad:</span>
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) =>
                      updateItem(idx, {
                        cantidad: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="h-9 w-20 rounded-full border-2 border-[#102a39] bg-white text-center text-xs font-bold focus:outline-none"
                  />
                </label>

                <span className="text-xs font-bold text-[#102a39]">
                  Subtotal: ${subtotal.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          );
        })}

        <div className="border-t border-[#e2e8f0] pt-2 text-right">
          <span className="text-base font-extrabold text-[#102a39]">
            Total a cobrar = ${total.toLocaleString("es-AR")}
          </span>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#e2e8f0] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#102a39]">Cliente</h2>
          {clientes.length > 0 && (
            <div className="flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModoCliente("existente")}
                className={
                  modoCliente === "existente"
                    ? "text-[#7622ed] underline"
                    : "text-[#586574]"
                }
              >
                Existente
              </button>
              <button
                type="button"
                onClick={() => setModoCliente("nuevo")}
                className={
                  modoCliente === "nuevo"
                    ? "text-[#7622ed] underline"
                    : "text-[#586574]"
                }
              >
                + Nuevo
              </button>
            </div>
          )}
        </div>

        {modoCliente === "existente" && clientes.length > 0 ? (
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="h-12 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
          >
            <option value="">Sin cliente asignado</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.apellido ?? ""}{" "}
                {c.telefono ? `(${c.telefono})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2.5">
            <input
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Nombre del cliente (Ej: Agustín Pérez)"
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
            <input
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              placeholder="Celular / WhatsApp (Opcional)"
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
            <input
              value={clienteDireccion}
              onChange={(e) => setClienteDireccion(e.target.value)}
              placeholder="Dirección habitual (Opcional)"
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-[#e2e8f0] p-4">
        <h2 className="text-sm font-bold text-[#102a39]">Entrega y cobro</h2>

        <div className="grid grid-cols-2 gap-2">
          {(["RETIRO", "ENVIO"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setModalidad(tipo)}
              className={`h-11 rounded-full border-2 text-xs font-bold transition ${
                modalidad === tipo
                  ? "border-[#7622ed] bg-[#7622ed] text-white"
                  : "border-[#102a39] bg-white text-[#102a39]"
              }`}
            >
              {tipo === "RETIRO" ? "Retiro en local" : "Con envío"}
            </button>
          ))}
        </div>

        {modalidad === "ENVIO" && (
          <input
            value={direccionEntrega}
            onChange={(e) => setDireccionEntrega(e.target.value)}
            placeholder="Dirección de entrega (Ej: Av. Lope de Vega 1252)"
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold">Fecha despacho</span>
            <input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-3 text-xs focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold">Horario</span>
            <input
              type="time"
              value={horaEntrega}
              onChange={(e) => setHoraEntrega(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-3 text-xs focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {(
            [
              { key: "PENDIENTE", label: "No cobrado" },
              { key: "PAGADO", label: "Cobrado" },
            ] as const
          ).map((est) => (
            <button
              key={est.key}
              type="button"
              onClick={() => setEstadoCobro(est.key)}
              className={`h-11 rounded-full border-2 text-xs font-bold transition ${
                estadoCobro === est.key
                  ? "border-[#056184] bg-[#056184] text-white"
                  : "border-[#102a39] bg-white text-[#102a39]"
              }`}
            >
              {est.label}
            </button>
          ))}
        </div>

        {estadoCobro === "PAGADO" && (
          <select
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
            className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-xs font-semibold focus:outline-none"
          >
            <option value="Transferencia">Transferencia</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Mercado Pago">Mercado Pago</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        )}

        <input
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Observaciones (Opcional)"
          className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
        />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
      >
        {loading ? "Guardando pedido..." : "Guardar pedido"}
      </button>
    </form>
  );
}