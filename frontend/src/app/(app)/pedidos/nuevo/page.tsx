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
      <div className="flex items-center gap-3">
        <Link
          href="/pedidos"
          className="text-lg font-bold text-[#102a39]"
          aria-label="Volver a pedidos"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#7622ed]">Nuevo pedido</h1>
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