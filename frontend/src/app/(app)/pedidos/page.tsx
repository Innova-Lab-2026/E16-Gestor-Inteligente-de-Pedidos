import { getPedidos } from "@/features/pedidos/api";
import PedidosList from "@/features/pedidos/components/PedidosList";
import type {
  EstadoCobro,
  EstadoOperativoPedido,
  EstadoPedido,
} from "@/features/pedidos/types";

type TabPedidos = "vigentes" | "cancelados" | "entregados";
type SearchParams = Record<string, string | string[] | undefined>;

const ESTADOS_POR_TAB: Record<TabPedidos, EstadoPedido[]> = {
  vigentes: ["RECIBIDO", "EN_PREPARACION", "LISTO", "EN_VIAJE"],
  cancelados: ["CANCELADO"],
  entregados: ["ENTREGADO"],
};

const ESTADOS_OPERATIVOS: EstadoOperativoPedido[] = [
  "RECIBIDO",
  "EN_PREPARACION",
  "LISTO",
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isEstadoOperativo(
  value: string | undefined,
): value is EstadoOperativoPedido {
  return ESTADOS_OPERATIVOS.some((estado) => estado === value);
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawTab = firstParam(params.tab);
  const tab: TabPedidos =
    rawTab === "cancelados" || rawTab === "entregados" ? rawTab : "vigentes";
  const rawEstado = firstParam(params.estado);
  const estado: EstadoOperativoPedido | "" =
    tab === "vigentes" && isEstadoOperativo(rawEstado) ? rawEstado : "";
  const offsetParam = Number(firstParam(params.offset) ?? 0);
  const offset =
    Number.isSafeInteger(offsetParam) && offsetParam > 0
      ? Math.floor(offsetParam / 50) * 50
      : 0;
  const filtros = {
    tab,
    busqueda: firstParam(params.busqueda) ?? "",
    clienteId: firstParam(params.cliente_id) ?? "",
    desde: firstParam(params.desde) ?? "",
    hasta: firstParam(params.hasta) ?? "",
    estado,
    estadoCobro: (firstParam(params.estado_cobro) ?? "") as EstadoCobro | "",
    requiereRevision: firstParam(params.requiere_revision) === "true",
    offset,
  };

  const { data, error } = await getPedidos({
    estado: filtros.estado || ESTADOS_POR_TAB[tab],
    ...(filtros.busqueda ? { busqueda: filtros.busqueda } : {}),
    ...(filtros.clienteId ? { cliente_id: filtros.clienteId } : {}),
    ...(filtros.desde ? { desde: filtros.desde } : {}),
    ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
    ...(filtros.estadoCobro
      ? { estado_cobro: filtros.estadoCobro }
      : {}),
    ...(filtros.requiereRevision
      ? { requiere_revision: true }
      : {}),
    limite: 51,
    offset,
  });
  const pedidos = data?.slice(0, 50) ?? [];
  const hasNext = (data?.length ?? 0) > 50;

  return (
    <section className="space-y-4 pt-2">
      <div className="app-page-heading">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Pedidos
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestioná tus ventas y seguí el estado de cada entrega.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : (
        <PedidosList
          pedidos={pedidos}
          filtros={filtros}
          hasNext={hasNext}
        />
      )}
    </section>
  );
}