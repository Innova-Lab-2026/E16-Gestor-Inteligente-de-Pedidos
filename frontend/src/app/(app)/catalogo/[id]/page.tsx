import Link from "next/link";
import {
  getProductoById,
  getVariantesProducto,
} from "@/app/(app)/catalogo/api";
import ProductoDetalle from "@/app/(app)/catalogo/components/ProductoDetalle";

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: producto, error } = await getProductoById(id);

  if (error || !producto) {
    return (
      <section className="space-y-4 pt-2">
        <Link href="/catalogo" className="text-sm font-bold text-[#102a39]">
          ← Volver al catálogo
        </Link>
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error ?? "No encontramos el producto."}
        </p>
      </section>
    );
  }

  let productoCompleto = producto;
  if (producto.tiene_variantes && !producto.variantes) {
    const varRes = await getVariantesProducto(id);
    if (varRes.data) {
      productoCompleto = { ...producto, variantes: varRes.data };
    }
  }

  return (
    <section className="space-y-4 pt-2">
      <div className="app-page-heading">
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          aria-label="Volver al catálogo"
        >
          ← Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {productoCompleto.nombre}
          </h1>
          <p className="text-xs text-[#586574]">
            Editá datos, variantes y stock del producto.
          </p>
        </div>
      </div>

      <ProductoDetalle producto={productoCompleto} />
    </section>
  );
}