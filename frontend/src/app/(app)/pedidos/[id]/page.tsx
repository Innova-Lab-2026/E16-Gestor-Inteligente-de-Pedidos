import Link from "next/link";
import { notFound } from "next/navigation";
import { getPedidoById } from "@/features/pedidos/api";
import PedidoDetalle from "@/features/pedidos/components/PedidoDetalle";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, ok } = await getPedidoById(id);

  if (!ok || !data) notFound();

  return (
    <section className="space-y-4 pt-2">
      <div className="app-page-heading flex items-center gap-3">
        <Link
          href="/pedidos"
          className="text-lg font-bold text-[#102a39]"
          aria-label="Volver a pedidos"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#7622ed]">
            Pedido {data.numero ? `#${data.numero}` : ""}
          </h1>
          <p className="text-xs text-[#586574]">
            Creado el {new Date(data.created_at).toLocaleDateString("es-AR")}
          </p>
        </div>
      </div>

      <PedidoDetalle pedido={data} />
    </section>
  );
}