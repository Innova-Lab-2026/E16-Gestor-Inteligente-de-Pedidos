import Link from "next/link";
import { getProductos, getVariantesProducto } from "@/app/(app)/catalogo/api";
import { getClientes } from "@/features/clientes/api";
import NuevoPedidoForm, {
  type ProductoConVariantes,
} from "@/features/pedidos/components/NuevoPedidoForm";

export default async function NuevoPedidoPage() {
  const [prodRes, cliRes] = await Promise.all([
    getProductos(false),
    getClientes(),
  ]);

  const productosBase = prodRes.data ?? [];

  const productosConVariantes: ProductoConVariantes[] = await Promise.all(
    productosBase.map(async (prod) => {
      if (!prod.tiene_variantes) return prod;
      const varRes = await getVariantesProducto(prod.id);
      return { ...prod, variantes: varRes.data ?? [] };
    }),
  );

  return (
    <section className="space-y-4 pt-2">
      <div className="app-page-heading">
        <Link
          href="/pedidos"
          prefetch={false}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          aria-label="Volver a pedidos"
        >
          ← Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nuevo pedido</h1>
          <p className="text-xs text-[#586574]">
            Completá los datos para descontar stock y agendar la entrega.
          </p>
        </div>
      </div>

      <NuevoPedidoForm
        productos={productosConVariantes}
        clientes={cliRes.data ?? []}
      />
    </section>
  );
}