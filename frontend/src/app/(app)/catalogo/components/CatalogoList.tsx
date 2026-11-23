"use client";

import { useState } from "react";
import Link from "next/link";
import type { Producto } from "../types";

type FiltroStock = "stock_bajo" | "sin_stock" | "inactivos" | null;

export default function CatalogoList({ productos }: { productos: Producto[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroStock>(null);

  const toggleFiltro = (valor: Exclude<FiltroStock, null>) => {
    setFiltro((prev) => (prev === valor ? null : valor));
  };

  const getStockTotal = (p: Producto) => {
    if (p.tiene_variantes && p.variantes) {
      return p.variantes.reduce((acc, v) => acc + (v.stock_disponible ?? 0), 0);
    }
    return p.stock_disponible ?? 0;
  };

  const filtrados = productos.filter((p) => {
    const texto = `${p.nombre} ${p.marca ?? ""} ${p.modelo ?? ""}`.toLowerCase();
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;

    const stock = getStockTotal(p);
    if (filtro === "inactivos") return !p.activo;
    if (!p.activo) return false;
    if (filtro === "sin_stock") return !p.tiene_variantes && stock === 0;
    if (filtro === "stock_bajo") {
      return !p.tiene_variantes && stock > 0 && stock <= (p.stock_minimo ?? 0);
    }
    return true;
  });

  if (productos.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <h2 className="text-lg font-bold text-[#102a39]">
          No tenés productos cargados
        </h2>
        <p className="mt-2 max-w-xs text-sm text-[#586574]">
          Cuando ingreses tus productos los verás listados en orden alfabético.
        </p>
        <Link
          href="/catalogo/nuevo"
          className="mt-6 rounded-full bg-[#056184] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#044d69]"
        >
          Cargá tu primer producto
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
          placeholder="Buscar producto..."
          className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm text-[#102a39] placeholder:text-[#586574] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#102a39]">Filtrar por:</span>
        {(
          [
            { key: "stock_bajo", label: "Stock bajo" },
            { key: "sin_stock", label: "Sin stock" },
            { key: "inactivos", label: "Inactivos" },
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

      <div className="space-y-3 pb-24">
        {filtrados.map((producto) => {
          const stock = getStockTotal(producto);
          const sinStock = producto.activo && !producto.tiene_variantes && stock === 0;
          const stockBajo =
            producto.activo &&
            !producto.tiene_variantes &&
            stock > 0 &&
            stock <= (producto.stock_minimo ?? 0);

          return (
            <Link
              key={producto.id}
              href={`/catalogo/${producto.id}`}
              className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs transition hover:border-[#7622ed]"
            >
              <div className="space-y-1">
                <h2 className="font-bold text-[#102a39]">{producto.nombre}</h2>
                <p className="text-xs text-[#586574]">
                  ${Number(producto.precio).toLocaleString("es-AR")}
                  {producto.tiene_variantes
                    ? " · Con variantes"
                    : " · Sin variantes"}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {!producto.activo && (
                    <span className="rounded-full bg-[#102a39] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      inactivo
                    </span>
                  )}
                  {sinStock && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                      sin stock
                    </span>
                  )}
                  {stockBajo && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                      stock bajo
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!producto.tiene_variantes && (
                  <span className="text-sm font-bold text-[#102a39]">{stock} u.</span>
                )}
                <span className="text-lg font-bold text-[#586574]">›</span>
              </div>
            </Link>
          );
        })}

        {filtrados.length === 0 && (
          <p className="py-8 text-center text-sm text-[#586574]">
            No hay productos que coincidan con el filtro.
          </p>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-5">
        <Link
          href="/catalogo/nuevo"
          aria-label="Cargar nuevo producto"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#056184] text-2xl font-bold text-white shadow-lg transition hover:bg-[#044d69]"
        >
          +
        </Link>
      </div>
    </div>
  );
}