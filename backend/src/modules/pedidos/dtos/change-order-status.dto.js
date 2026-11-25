import { z } from "zod";
import { ORDER_STATUS } from "../../../constants/order-status.enum.js";
import { PAYMENT_STATUS } from "../../../constants/payment-status.enum.js";

export const changeOrderStatusSchema = z.object({
  estado: z.enum(Object.values(ORDER_STATUS)),
  motivo: z.string().trim().max(500).nullish(),
});

export const changePaymentStatusSchema = z.object({
  estado_cobro: z.enum(Object.values(PAYMENT_STATUS)),
});

export const pedidoIdParamSchema = z.object({
  id: z.string().uuid("El id del pedido debe ser un UUID válido"),
});

const estadoPedidoQuery = z.enum(Object.values(ORDER_STATUS));
const estadoCobroQuery = z.enum(Object.values(PAYMENT_STATUS));

export const listPedidosQuerySchema = z
  .object({
    estado: z
      .union([
        estadoPedidoQuery,
        z
          .array(estadoPedidoQuery)
          .min(1)
          .max(Object.values(ORDER_STATUS).length),
      ])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .optional(),
    requiere_revision: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    fecha_prevista_entrega: z.string().date().optional(),
    desde: z.string().date().optional(),
    hasta: z.string().date().optional(),
    cliente_id: z.string().uuid().optional(),
    cliente: z.string().trim().min(1).max(100).optional(),
    busqueda: z.string().trim().min(1).max(100).optional(),
    estado_cobro: estadoCobroQuery.optional(),
    estado_pago: z
      .enum(["PAGADO", "PENDIENTE", "pagado", "pendiente"])
      .transform((value) => value.toUpperCase())
      .optional(),
    limite: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .transform(({ estado_pago, ...query }) => ({
    ...query,
    estado_cobro: query.estado_cobro ?? estado_pago,
  }));

export default changeOrderStatusSchema;