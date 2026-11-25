"use client";

import Image from "next/image";
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
  atributos: Record<string, string>;
};

const TIPOS_VARIANTE = [
  { value: "talle", label: "Talle" },
  { value: "color", label: "Color" },
  { value: "tamaño", label: "Tamaño" },
  { value: "sabor", label: "Sabor" },
] as const;
type TipoVariante = (typeof TIPOS_VARIANTE)[number]["value"];

export default function NuevoProductoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fotoUrl, setFotoUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [genero, setGenero] = useState("");
  const [tieneVariantes, setTieneVariantes] = useState(false);
  const [stockDisponible, setStockDisponible] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [variantes, setVariantes] = useState<VarianteDraft[]>([]);
  const [modalVarianteOpen, setModalVarianteOpen] = useState(false);
  const [tipoVariante, setTipoVariante] = useState<TipoVariante>("talle");
  const [valorVariante, setValorVariante] = useState("");
  const [stockVariante, setStockVariante] = useState("");
  const [stockMinimoVariante, setStockMinimoVariante] = useState("");

  function guardarVariante(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = valorVariante.trim();
    if (!valor) return;

    const tipo = TIPOS_VARIANTE.find((item) => item.value === tipoVariante);
    if (!tipo) return;

    setVariantes((current) => [
      ...current,
      {
        nombre: `${tipo.label}: ${valor}`,
        stock_disponible: stockVariante,
        stock_minimo: stockMinimoVariante,
        atributos: { [tipoVariante]: valor },
      },
    ]);
    setValorVariante("");
    setStockVariante("");
    setStockMinimoVariante("");
    setModalVarianteOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await crearProductoAction({
      nombre,
      precio: Number(precio),
      descripcion: descripcion || undefined,
      foto_url: fotoUrl.trim() || null,
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
          atributos: v.atributos,
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
          <span className="text-sm font-semibold">Foto del producto (Opcional)</span>
          <input
            type="url"
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            placeholder="Pegá el enlace de la foto"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        {fotoUrl.trim() && (
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-[#e2e8f0] bg-slate-50">
            <Image
              src={fotoUrl}
              alt={nombre ? `Foto de ${nombre}` : "Vista previa del producto"}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        )}

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
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[#102a39]">
                  Variante
                </h2>
                <p className="text-xs leading-relaxed text-[#586574]">
                  Agregá talles, colores, tamaños o sabores y su stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalVarianteOpen(true)}
                className="shrink-0 rounded-full border border-[#7622ed] px-3 py-2 text-xs font-bold text-[#7622ed] transition hover:bg-[#7622ed]/5"
              >
                + Agregar
              </button>
            </div>

            <p className="text-xs text-[#586574]">
              El precio definido arriba se aplica a todas las variantes.
            </p>

            {variantes.length > 0 ? (
              <div className="divide-y divide-[#e2e8f0]">
                {variantes.map((variante, index) => (
                  <div
                    key={`${variante.nombre}-${index}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#102a39]">
                        {variante.nombre}
                      </p>
                      <p className="text-xs text-[#586574]">
                        Stock: {variante.stock_disponible || "0"} · Mínimo:{" "}
                        {variante.stock_minimo || "0"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar ${variante.nombre}`}
                      onClick={() =>
                        setVariantes((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="shrink-0 px-2 py-1 text-xs font-semibold text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-[#586574]">
                Todavía no agregaste variantes.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || (tieneVariantes && variantes.length === 0)}
          className="h-12 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar producto"}
        </button>
      </form>

      {modalVarianteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102a39]/60 px-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="variant-dialog-title"
            className="w-full max-w-[390px] rounded-3xl bg-white p-6 text-[#102a39] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="variant-dialog-title" className="text-lg font-bold">
                Variante
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setModalVarianteOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-xl text-[#586574] hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[#586574]">
              El precio del producto es compartido por todas las variantes.
            </p>
            <p className="mt-2 text-sm font-semibold text-[#102a39]">
              Precio:{" "}
              {precio
                ? `$${Number(precio).toLocaleString("es-AR")}`
                : "completá el precio del producto"}
            </p>

            <form onSubmit={guardarVariante} className="mt-5 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Tipo</span>
                <select
                  value={tipoVariante}
                  onChange={(e) => {
                    const selected = TIPOS_VARIANTE.find(
                      (tipo) => tipo.value === e.currentTarget.value,
                    );
                    if (selected) setTipoVariante(selected.value);
                  }}
                  className="h-12 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
                >
                  {TIPOS_VARIANTE.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold">Valor</span>
                <input
                  required
                  autoFocus
                  value={valorVariante}
                  onChange={(e) => setValorVariante(e.target.value)}
                  placeholder={
                    tipoVariante === "talle"
                      ? "Ej: M"
                      : tipoVariante === "color"
                        ? "Ej: Azul"
                        : tipoVariante === "tamaño"
                          ? "Ej: Grande"
                          : "Ej: Frutilla"
                  }
                  className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Stock</span>
                  <input
                    required
                    type="number"
                    min="0"
                    value={stockVariante}
                    onChange={(e) => setStockVariante(e.target.value)}
                    placeholder="0"
                    className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Stock mínimo</span>
                  <input
                    type="number"
                    min="0"
                    value={stockMinimoVariante}
                    onChange={(e) => setStockMinimoVariante(e.target.value)}
                    placeholder="0"
                    className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="h-12 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69]"
              >
                Guardar
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}