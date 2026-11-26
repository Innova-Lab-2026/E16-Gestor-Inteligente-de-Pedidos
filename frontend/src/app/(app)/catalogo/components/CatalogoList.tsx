"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import type { Producto } from "../types";

type FiltroStock = "stock_bajo" | "sin_stock" | "inactivos" | null;

export default function CatalogoList({ productos }: { productos: Producto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroStock>(null);

  const toggleFiltro = (valor: Exclude<FiltroStock, null>) => {
    setFiltro((prev) => (prev === valor ? null : valor));
  };

  const getCantidadVariantes = (p: Producto) => p.variantes?.length ?? 0;
  const tieneVariantes = (p: Producto) => getCantidadVariantes(p) > 0;

  const getStockTotal = (p: Producto) => {
    if (tieneVariantes(p) && p.variantes) {
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
    if (filtro === "sin_stock") return !tieneVariantes(p) && stock === 0;
    if (filtro === "stock_bajo") {
      return !tieneVariantes(p) && stock > 0 && stock <= (p.stock_minimo ?? 0);
    }
    return true;
  });

  if (productos.length === 0) {
    return (
      <EmptyState
        titulo="No tenés productos cargados"
        descripcion="Cuando ingreses tus productos los verás listados en orden alfabético."
        textoBoton="Cargá tu primer producto"
        onAccion={() => router.push("/catalogo/nuevo")}
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
          placeholder="Buscar producto..."
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
          const cantidadVariantes = getCantidadVariantes(producto);
          const productoTieneVariantes = cantidadVariantes > 0;
          const sinStock =
            producto.activo && !productoTieneVariantes && stock === 0;
          const stockBajo =
            producto.activo &&
            !productoTieneVariantes &&
            stock > 0 &&
            stock <= (producto.stock_minimo ?? 0);

          return (
            <Link
              key={producto.id}
              href={`/catalogo/${producto.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs transition hover:border-[#7622ed]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#586574]">
                {producto.activo ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                    <path d="M3 8v9l9 5 9-5V8M12 13v9" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="m4 4 16 16" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-bold text-[#102a39]">{producto.nombre}</h2>
                <p className="text-xs text-[#586574]">
                  ${Number(producto.precio).toLocaleString("es-AR")}
                  {producto.activo
                    ? productoTieneVariantes
                      ? ` · ${cantidadVariantes} ${
                          cantidadVariantes === 1 ? "variante" : "variantes"
                        }`
                      : " · Sin variantes"
                    : " / no se vende"}
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

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold text-[#102a39]">{stock} u.</span>
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
          prefetch={false}
          aria-label="Cargar nuevo producto"
          className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-[#056184] text-white shadow-lg transition hover:bg-[#044d69]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}