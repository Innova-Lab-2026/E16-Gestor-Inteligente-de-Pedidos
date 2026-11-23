"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  agregarVarianteAction,
  crearProductoAction,
} from "@/app/(app)/catalogo/actions";

type VarianteDraft = {
  nombre: string;
  stock_disponible: string;
  stock_minimo: string;
};

export default function NuevoProductoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [genero, setGenero] = useState("");
  const [tieneVariantes, setTieneVariantes] = useState(false);
  const [stockDisponible, setStockDisponible] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [variantes, setVariantes] = useState<VarianteDraft[]>([
    { nombre: "", stock_disponible: "", stock_minimo: "" },
  ]);

  const addVarianteRow = () => {
    setVariantes((prev) => [
      ...prev,
      { nombre: "", stock_disponible: "", stock_minimo: "" },
    ]);
  };

  const updateVariante = (
    index: number,
    field: keyof VarianteDraft,
    value: string,
  ) => {
    setVariantes((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await crearProductoAction({
      nombre,
      precio: Number(precio),
      descripcion: descripcion || undefined,
      marca: marca || null,
      modelo: modelo || null,
      genero: genero || null,
      tiene_variantes: tieneVariantes,
      stock_disponible: tieneVariantes ? null : Number(stockDisponible) || 0,
      stock_minimo: tieneVariantes ? 0 : Number(stockMinimo) || 0,
    });

    if (res.error || !res.data) {
      setError(res.error ?? "No se pudo guardar el producto.");
      setLoading(false);
      return;
    }

    if (tieneVariantes) {
      const validas = variantes.filter((v) => v.nombre.trim().length > 0);
      for (const v of validas) {
        const varRes = await agregarVarianteAction(res.data.id, {
          nombre: v.nombre.trim(),
          stock_disponible: Number(v.stock_disponible) || 0,
          stock_minimo: Number(v.stock_minimo) || 0,
        });
        if (varRes.error) {
          setError(`Producto creado, pero falló una variante: ${varRes.error}`);
          setLoading(false);
          return;
        }
      }
    }

    router.push("/catalogo");
  }

  return (
    <section className="space-y-5 pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/catalogo"
          className="text-lg font-bold text-[#102a39]"
          aria-label="Volver al catálogo"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#7622ed]">Catálogo &gt; Cargar</h1>
          <p className="text-xs text-[#586574]">
            Cargá tus productos, stock y precio para organizar tus ventas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Nombre del producto *</span>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Buzo oversize"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Precio *</span>
          <input
            required
            type="number"
            min="1"
            step="any"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="Ej: 38000"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Descripción (Opcional)</span>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Buzo ancho con estampa"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Marca (Opcional)</span>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej: Nike"
              className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Modelo (Opcional)</span>
            <input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ej: Oversize"
              className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Género (Opcional)</span>
          <select
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            className="h-12 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
          >
            <option value="">Seleccionar...</option>
            <option value="Mujer">Mujer</option>
            <option value="Hombre">Hombre</option>
            <option value="Niñas">Niñas</option>
            <option value="Niños">Niños</option>
            <option value="Bebés">Bebés</option>
            <option value="Sin género">Sin género</option>
          </select>
        </label>

        <label className="flex items-center gap-2.5 pt-1 text-sm font-semibold">
          <input
            type="checkbox"
            checked={tieneVariantes}
            onChange={(e) => setTieneVariantes(e.target.checked)}
            className="h-4 w-4 accent-[#7622ed]"
          />
          <span>¿Tiene variantes? (talle, color, sabor, tamaño)</span>
        </label>

        {!tieneVariantes ? (
          <div className="space-y-2 rounded-2xl border border-[#e2e8f0] p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Stock actual *</span>
                <input
                  required
                  type="number"
                  min="0"
                  placeholder="Ej: 10"
                  value={stockDisponible}
                  onChange={(e) => setStockDisponible(e.target.value)}
                  className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold">Stock mínimo</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej: 3"
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                  className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
                />
              </label>
            </div>

            <p className="text-xs leading-relaxed text-[#586574]">
              <strong>Stock actual:</strong> unidades disponibles hoy para vender.{" "}
              <strong>Stock mínimo:</strong> cuando llegues a esa cantidad o menos, te avisamos con la etiqueta{" "}
              <span className="font-semibold text-amber-800">Stock bajo</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-[#e2e8f0] p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#102a39]">
                Variantes y cantidades
              </p>
              <p className="text-xs leading-relaxed text-[#586574]">
                Indicá cuánto tenés hoy de cada variante (<strong>Stock</strong>) y desde qué cantidad querés recibir alerta de reposición (<strong>Mínimo</strong>).
              </p>
            </div>

            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-[#102a39]">
              <span className="col-span-6 pl-3">Variante</span>
              <span className="col-span-3 text-center">Stock</span>
              <span className="col-span-3 text-center">Mínimo</span>
            </div>

            {variantes.map((v, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <input
                  required
                  aria-label={`Nombre de variante ${idx + 1}`}
                  placeholder="Ej: Azul"
                  value={v.nombre}
                  onChange={(e) => updateVariante(idx, "nombre", e.target.value)}
                  className="col-span-6 h-11 rounded-full border-2 border-[#102a39] px-3 text-xs focus:outline-none"
                />
                <input
                  required
                  type="number"
                  min="0"
                  aria-label={`Stock actual de ${v.nombre || `variante ${idx + 1}`}`}
                  placeholder="0"
                  value={v.stock_disponible}
                  onChange={(e) =>
                    updateVariante(idx, "stock_disponible", e.target.value)
                  }
                  className="col-span-3 h-11 rounded-full border-2 border-[#102a39] px-2 text-center text-xs focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  aria-label={`Stock mínimo de ${v.nombre || `variante ${idx + 1}`}`}
                  placeholder="0"
                  value={v.stock_minimo}
                  onChange={(e) =>
                    updateVariante(idx, "stock_minimo", e.target.value)
                  }
                  className="col-span-3 h-11 rounded-full border-2 border-[#102a39] px-2 text-center text-xs focus:outline-none"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addVarianteRow}
              className="text-xs font-bold text-[#7622ed] underline"
            >
              + Agregar otra variante
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar producto"}
        </button>
      </form>
    </section>
  );
}