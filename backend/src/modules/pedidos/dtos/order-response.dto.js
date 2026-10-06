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
  modalidad_entrega: z.enum(Object.values(DELIVERY_MODE)).nullable(),
  fecha_prevista_entrega: z.string().nullable(),
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