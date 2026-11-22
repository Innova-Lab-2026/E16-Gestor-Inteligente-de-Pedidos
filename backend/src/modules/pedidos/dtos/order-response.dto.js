import { z } from "zod";
import { ORDER_STATUS } from "../../../constants/order-status.enum.js";
import { PAYMENT_STATUS } from "../../../constants/payment-status.enum.js";
import { ORDER_ORIGIN } from "../../../constants/order-origin.enum.js";
import { DELIVERY_MODE } from "../../../constants/processing-status.enum.js";

export const itemPedidoResponseSchema = z.object({
  id: z.string().uuid(),
  pedido_id: z.string().uuid(),
  producto_id: z.string().uuid(),
  variante_id: z.string().uuid().nullable(),
  cantidad: z.number().int(),
  precio_unitario: z.number(),
  subtotal: z.number(),
  /** Nombre del producto congelado al momento de la venta (migración 008). */
  producto_nombre: z.string().nullable().optional(),
  /** Nombre de la variante congelada al momento de la venta (migración 008). */
  variante_nombre: z.string().nullable().optional(),
  producto: z
    .object({ id: z.string(), nombre: z.string() })
    .optional(),
  variante: z
    .object({ id: z.string(), nombre: z.string() })
    .nullable()
    .optional(),
});

export const pedidoResponseSchema = z.object({
  id: z.string().uuid(),
  emprendimiento_id: z.string().uuid(),
  cliente_id: z.string().uuid().nullable(),
  origen_tipo: z.enum(Object.values(ORDER_ORIGIN)),
  canal_id: z.string().uuid().nullable(),
  estado: z.enum(Object.values(ORDER_STATUS)),
  estado_cobro: z.enum(Object.values(PAYMENT_STATUS)),
  /** Número correlativo legible por emprendimiento (migración 008). */
  numero: z.number().nullable().optional(),
  modalidad_entrega: z.enum(Object.values(DELIVERY_MODE)).nullable(),
  /** Dirección de entrega para envíos (migración 008). */
  direccion_entrega: z.string().nullable().optional(),
  /** Medio(s) de pago elegidos (migración 009). */
  medios_pago: z.array(z.string()).nullable().optional(),
  fecha_prevista_entrega: z.string().nullable(),
  /** Fecha/hora prevista de entrega (migración 009). */
  hora_prevista_entrega: z.string().nullable().optional(),
  /** Fecha y hora de preparación confirmada (migración 008). */
  confirmed_at: z.string().nullable().optional(),
  /** Fecha y hora en que pasó a LISTO (migración 008). */
  ready_at: z.string().nullable().optional(),
  /** Fecha y hora en que pasó a EN_VIAJE (migración 009). */
  shipped_at: z.string().nullable().optional(),
  /** Fecha y hora de entrega (migración 008). */
  delivered_at: z.string().nullable().optional(),
  /** Fecha y hora de cancelación (migración 008). */
  cancelled_at: z.string().nullable().optional(),
  /** Momento en que se avisó al cliente (migración 009). */
  cliente_avisado_at: z.string().nullable().optional(),
  /** Motivo de cancelación (migración 008). */
  motivo_cancelacion: z.string().nullable().optional(),
  subtotal: z.number(),
  total: z.number(),
  observaciones: z.string().nullable(),
  requiere_revision: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  items: z.array(itemPedidoResponseSchema).optional(),
  cliente: z.object({ id: z.string(), nombre: z.string() }).nullable().optional(),
  movimientos_stock: z.array(z.object({}).passthrough()).optional(),
});

export const pedidoListResponseSchema = z.array(pedidoResponseSchema);

/**
 * Serializa un pedido hacia la respuesta HTTP.
 * @param {object} pedido
 */
export const toPedidoResponse = (pedido) => {
  if (!pedido) return null;
  const { items, cliente, ...resto } = pedido;
  return {
    ...resto,
    ...(items ? { items } : {}),
    ...(cliente ? { cliente } : {}),
  };
};

export default pedidoResponseSchema;