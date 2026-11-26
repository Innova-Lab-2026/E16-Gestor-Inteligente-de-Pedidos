export type EstadoPedido =
  | "RECIBIDO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_VIAJE"
  | "ENTREGADO"
  | "CANCELADO";

export type EstadoCobro = "PAGADO" | "PENDIENTE";
export type OrigenPedido = "MANUAL" | "WHATSAPP" | "TELEGRAM" | "WEB";
export type ModalidadEntrega = "RETIRO" | "ENVIO";

export type ItemPedido = {
  id: string;
  pedido_id: string;
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto_nombre?: string | null;
  variante_nombre?: string | null;
  producto?: { id?: string; nombre: string } | null;
  variante?: { id?: string; nombre: string } | null;
};

export type Pedido = {
  id: string;
  emprendimiento_id: string;
  cliente_id: string | null;
  origen_tipo: OrigenPedido;
  canal_id: string | null;
  estado: EstadoPedido;
  estado_cobro: EstadoCobro;
  numero?: number | null;
  modalidad_entrega: ModalidadEntrega | null;
  direccion_entrega?: string | null;
  medios_pago?: string[] | null;
  fecha_prevista_entrega: string | null;
  hora_prevista_entrega?: string | null;
  subtotal: number;
  total: number;
  observaciones: string | null;
  requiere_revision: boolean;
  created_at: string;
  items?: ItemPedido[];
  cliente?: { id: string; nombre: string } | null;
};

export type CreatePedidoManualInput = {
  cliente_id?: string | null;
  modalidad_entrega?: ModalidadEntrega;
  direccion_entrega?: string;
  fecha_prevista_entrega?: string;
  hora_prevista_entrega?: string;
  medios_pago?: string[];
  estado_cobro?: EstadoCobro;
  observaciones?: string;
  items: {
    producto_id: string;
    variante_id?: string | null;
    cantidad: number;
    precio_unitario?: number;
  }[];
};

export type UpdatePedidoDetailsInput = {
  modalidad_entrega?: ModalidadEntrega | null;
  direccion_entrega?: string | null;
  fecha_prevista_entrega?: string | null;
  hora_prevista_entrega?: string | null;
  medios_pago?: string[];
};