import { z } from "zod";
import { ORDER_STATUS } from "../../../constants/order-status.enum.js";
import { PAYMENT_STATUS } from "../../../constants/payment-status.enum.js";

export const changeOrderStatusSchema = z.object({
  estado: z.enum(Object.values(ORDER_STATUS), {
    errorMap: () => ({ message: "Estado de pedido inválido" }),
  }),
});

export const changePaymentStatusSchema = z.object({
  estadoCobro: z.enum(Object.values(PAYMENT_STATUS)),
});

export const pedidoIdParamSchema = z.object({
  id: z.string().uuid("El id del pedido debe ser un UUID válido"),
});

export const listPedidosQuerySchema = z.object({
  estado: z.enum(Object.values(ORDER_STATUS)).optional(),
  requiereRevision: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export default changeOrderStatusSchema;