"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  agregarVarianteAction,
  ajustarStockAction,
  editarProductoAction,
  editarVarianteAction,
} from "../actions";
import type { Producto, TipoMovimientoStock, Variante } from "../types";

export default function ProductoDetalle({ producto }: { producto: Producto }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Edición general del producto
  const [nombre, setNombre] = useState(producto.nombre);
  const [precio, setPrecio] = useState(String(producto.precio));
  const [descripcion, setDescripcion] = useState(producto.descripcion ?? "");
  const [marca, setMarca] = useState(producto.marca ?? "");
  const [modelo, setModelo] = useState(producto.modelo ?? "");
  const [genero, setGenero] = useState(producto.genero ?? "");
  const [stockMinimo, setStockMinimo] = useState(String(producto.stock_minimo ?? 0));
  const [activo, setActivo] = useState(producto.activo);

  // Ajuste de stock (producto simple o variante seleccionada)
  const [varianteStockId, setVarianteStockId] = useState<string>(
    producto.variantes?.[0]?.id ?? "",
  );
  const [tipoMovimiento, setTipoMovimiento] =
    useState<TipoMovimientoStock>("REPOSICION");
  const [cantidadMov, setCantidadMov] = useState("");
  const [motivoMov, setMotivoMov] = useState("");

  // Nueva variante
  const [nuevaVarNombre, setNuevaVarNombre] = useState("");
  const [nuevaVarStock, setNuevaVarStock] = useState("");
  const [nuevaVarMinimo, setNuevaVarMinimo] = useState("");

  async function handleGuardarProducto(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setLoading(true);

    const res = await editarProductoAction(producto.id, {
      nombre: nombre.trim(),
      precio: Number(precio),
      descripcion: descripcion.trim() || undefined,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      genero: genero || null,
      activo,
      ...(!producto.tiene_variantes
        ? { stock_minimo: Number(stockMinimo) || 0 }
        : {}),
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOkMsg("Producto actualizado.");
    router.refresh();
  }

  async function handleAjustarStock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    const cant = Number(cantidadMov);
    if (!cant || cant === 0) {
      setError("Ingresá una cantidad distinta de 0.");
      return;
    }

    setLoading(true);
    const res = await ajustarStockAction({
      producto_id: producto.id,
      variante_id: producto.tiene_variantes ? varianteStockId || null : null,
      tipo: tipoMovimiento,
      cantidad: cant,
      motivo: motivoMov.trim() || undefined,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setCantidadMov("");
    setMotivoMov("");
    setOkMsg("Stock actualizado.");
    router.refresh();
  }

  async function handleToggleVariante(v: Variante) {
    setError(null);
    setOkMsg(null);
    setLoading(true);
    const res = await editarVarianteAction(producto.id, v.id, {
      activo: !v.activo,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleAgregarVariante(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaVarNombre.trim()) return;
    setError(null);
    setOkMsg(null);
    setLoading(true);

    const res = await agregarVarianteAction(producto.id, {
      nombre: nuevaVarNombre.trim(),
      stock_disponible: Number(nuevaVarStock) || 0,
      stock_minimo: Number(nuevaVarMinimo) || 0,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNuevaVarNombre("");
    setNuevaVarStock("");
    setNuevaVarMinimo("");
    setOkMsg("Variante agregada.");
    router.refresh();
  }

  return (
    <div className="space-y-5 pb-12">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {okMsg}
        </p>
      )}

      {/* Datos principales */}
      <form
        onSubmit={handleGuardarProducto}
        className="space-y-3.5 rounded-2xl border border-[#e2e8f0] bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#102a39]">Datos del producto</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              activo
                ? "bg-emerald-100 text-emerald-800"
                : "bg-[#102a39] text-white"
            }`}
          >
            {activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">Nombre *</span>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Precio *</span>
            <input
              required
              type="number"
              min="1"
              step="any"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>

          {!producto.tiene_variantes && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#586574]">
                Stock mínimo
              </span>
              <input
                type="number"
                min="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
              />
            </label>
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">Descripción</span>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Marca</span>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Modelo</span>
            <input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">Género</span>
          <select
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
          >
            <option value="">Sin especificar</option>
            <option value="Mujer">Mujer</option>
            <option value="Hombre">Hombre</option>
            <option value="Niñas">Niñas</option>
            <option value="Niños">Niños</option>
            <option value="Bebés">Bebés</option>
            <option value="Sin género">Sin género</option>
          </select>
        </label>

        <label className="flex items-center gap-2.5 pt-1 text-sm font-semibold text-[#102a39]">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="h-4 w-4 accent-[#7622ed]"
          />
          <span>Producto activo (visible para nuevos pedidos)</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Variantes (si corresponde) */}
      {producto.tiene_variantes && (
        <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <h2 className="text-sm font-bold text-[#102a39]">Variantes</h2>

          <div className="divide-y divide-[#e2e8f0]">
            {(producto.variantes ?? []).map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#102a39]">{v.nombre}</p>
                  <p className="text-xs text-[#586574]">
                    Stock: <strong>{v.stock_disponible} u.</strong> · Mín:{" "}
                    {v.stock_minimo}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleToggleVariante(v)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    v.activo
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-[#102a39]"
                  }`}
                >
                  {v.activo ? "Activa" : "Inactiva"}
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAgregarVariante}
            className="space-y-2 border-t border-[#e2e8f0] pt-3"
          >
            <p className="text-xs font-bold text-[#7622ed]">
              + Agregar nueva variante
            </p>
            <div className="grid grid-cols-12 gap-2">
              <input
                required
                placeholder="Ej: Rojo"
                value={nuevaVarNombre}
                onChange={(e) => setNuevaVarNombre(e.target.value)}
                className="col-span-6 h-10 rounded-full border-2 border-[#102a39] px-3 text-xs focus:outline-none"
              />
              <input
                required
                type="number"
                min="0"
                placeholder="Stock"
                value={nuevaVarStock}
                onChange={(e) => setNuevaVarStock(e.target.value)}
                className="col-span-3 h-10 rounded-full border-2 border-[#102a39] px-2 text-center text-xs focus:outline-none"
              />
              <input
                type="number"
                min="0"
                placeholder="Mín."
                value={nuevaVarMinimo}
                onChange={(e) => setNuevaVarMinimo(e.target.value)}
                className="col-span-3 h-10 rounded-full border-2 border-[#102a39] px-2 text-center text-xs focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-full border-2 border-[#7622ed] text-xs font-bold text-[#7622ed] transition hover:bg-[#7622ed]/5 disabled:opacity-50"
            >
              Agregar variante
            </button>
          </form>
        </div>
      )}

      {/* Ajuste de stock */}
      <form
        onSubmit={handleAjustarStock}
        className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#102a39]">Ajustar stock</h2>
          {!producto.tiene_variantes && (
            <span className="text-xs font-bold text-[#7622ed]">
              Actual: {producto.stock_disponible ?? 0} u.
            </span>
          )}
        </div>

        {producto.tiene_variantes && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Variante</span>
            <select
              required
              value={varianteStockId}
              onChange={(e) => setVarianteStockId(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
            >
              {(producto.variantes ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre} (Stock: {v.stock_disponible})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Tipo</span>
            <select
              value={tipoMovimiento}
              onChange={(e) =>
                setTipoMovimiento(e.target.value as TipoMovimientoStock)
              }
              className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-3 text-xs focus:outline-none"
            >
              <option value="REPOSICION">Reposición (+)</option>
              <option value="PRODUCCION">Producción (+)</option>
              <option value="PERDIDA">Pérdida (-)</option>
              <option value="CORRECCION_MANUAL">Corrección manual</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Cantidad</span>
            <input
              required
              type="number"
              placeholder="Ej: 5"
              value={cantidadMov}
              onChange={(e) => setCantidadMov(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">
            Motivo (Opcional)
          </span>
          <input
            placeholder="Ej: Ingreso de proveedor"
            value={motivoMov}
            onChange={(e) => setMotivoMov(e.target.value)}
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-[#7622ed] text-sm font-bold text-white transition hover:bg-[#6018c7] disabled:opacity-50"
        >
          Registrar movimiento
        </button>
      </form>
    </div>
  );
}