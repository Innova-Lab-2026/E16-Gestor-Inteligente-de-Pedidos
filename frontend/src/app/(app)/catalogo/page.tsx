import {
  getProductos,
  getVariantesProducto,
} from "@/app/(app)/catalogo/api";
import CatalogoList from "@/app/(app)/catalogo/components/CatalogoList";
import type { Variante } from "./types";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string | string[] }>;
}) {
  const { filtro } = await searchParams;
  const filtroUrl = Array.isArray(filtro) ? filtro[0] : filtro;
  const productosResult = await getProductos(true);
  const productos = productosResult.data ?? [];
  let variantesError: string | undefined;

  if (productosResult.ok) {
    const resultadosVariantes = await Promise.all(
      productos
        .filter((producto) => producto.tiene_variantes)
        .map(async (producto) => ({
          productoId: producto.id,
          ...(await getVariantesProducto(producto.id)),
        })),
    );
    const resultadoFallido = resultadosVariantes.find(
      (resultado) => !resultado.ok || !resultado.data,
    );
    if (resultadoFallido) {
      variantesError =
        resultadoFallido.error ?? "No pudimos cargar las variantes.";
    }

    const variantesPorProducto = new Map<string, Variante[]>();
    for (const resultado of resultadosVariantes) {
      if (resultado.ok && resultado.data) {
        variantesPorProducto.set(resultado.productoId, resultado.data);
      }
    }
    for (let index = 0; index < productos.length; index += 1) {
      const producto = productos[index];
      if (producto.tiene_variantes) {
        productos[index] = {
          ...producto,
          variantes: variantesPorProducto.get(producto.id) ?? [],
        };
      }
    }
  }

  const error = productosResult.error ?? variantesError;

  return (
    <section className="space-y-4 pt-2">
      <div className="app-page-heading">
        <h1 className="text-2xl font-bold text-[#102a39]">Catálogo</h1>
        <p className="text-sm text-[#586574]">
          Listado de productos. Editalos con un solo click.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : (
        <CatalogoList
          key={filtroUrl ?? ""}
          productos={productos}
          filtroUrl={filtroUrl}
        />
      )}
    </section>
  );
}