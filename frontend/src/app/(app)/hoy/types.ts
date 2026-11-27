export type EstadoPedido =
  | "RECIBIDO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_VIAJE"
  | "ENTREGADO"
  | "CANCELADO";

export type UltimoPedidoItem = {
  id: string;
  numero?: number | null;
  numero_pedido?: number | null;
  estado: EstadoPedido;
  estado_cobro?: "PENDIENTE" | "PAGADO" | string;
  total: number | string;
  created_at?: string;
  modalidad_entrega?: "RETIRO" | "ENVIO" | string | null;
  requiere_revision?: boolean;
  cliente_nombre?: string | null;
  cliente?: {
    id?: string;
    nombre: string;
    apellido?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    email?: string | null;
  } | null;
};

export type DashboardResumen = {
  cantidadPedidos: number;
  porEstado: Partial<Record<EstadoPedido, number>>;
  facturado: number;
  pendienteCobro: number;
  pedidosRequiriendoRevision: number;
  ultimosPedidos: UltimoPedidoItem[];
  productosMasVendidos: Array<{
    productoId: string;
    nombre: string;
    unidadesVendidas: number;
    totalVendido: number;
  }>;
  unidadesVendidas: number;
  productosBajoStock: number;
};