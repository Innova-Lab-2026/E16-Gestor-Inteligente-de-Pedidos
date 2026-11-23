import type { EstadoPedido, Pedido } from "@/features/pedidos/types";

export type ResumenDashboard = {
  cantidadPedidos: number;
  porEstado: Record<EstadoPedido, number>;
  facturado: number;
  pendienteCobro: number;
  pedidosRequiriendoRevision: number;
  ultimosPedidos: Pedido[];
};