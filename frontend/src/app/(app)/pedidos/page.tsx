import { getPedidos } from "@/features/pedidos/api";
import PedidosList from "@/features/pedidos/components/PedidosList";

export default async function PedidosPage() {
  const { data, error } = await getPedidos();

  return (
    <section className="space-y-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-[#102a39]">Pedidos</h1>
        <p className="text-sm text-[#586574]">
          Gestioná tus ventas y seguí el estado de cada entrega.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : (
        <PedidosList pedidos={data ?? []} />
      )}
    </section>
  );
}