import { z } from "zod";
import { DELIVERY_MODE } from "../../../constants/processing-status.enum.js";
import { PAYMENT_STATUS } from "../../../constants/payment-status.enum.js";

const itemSchema = z.object({
  producto_id: z.string().uuid("producto_id debe ser un UUID"),
  variante_id: z.string().uuid().nullable().optional(),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser un entero mayor a 0"),
  // Si se omite, se toma el precio actual del producto (se congela igual).
  precio_unitario: z.coerce.number().positive().optional(),
});

/**
 * Pedido creado por el emprendedor desde la aplicación.
 * Regla del dominio: origen_tipo = MANUAL implica canal_id = NULL.
 */
export const createPedidoManualSchema = z.object({
  cliente_id: z.string().uuid().nullable().optional(),
  modalidad_entrega: z.enum(Object.values(DELIVERY_MODE)).optional(),
  fecha_prevista_entrega: z.string().date().optional(),
  estado_cobro: z.enum(Object.values(PAYMENT_STATUS)).default(PAYMENT_STATUS.PENDIENTE),
  observaciones: z.string().max(2000).optional(),
  items: z.array(itemSchema).min(1, "El pedido debe tener al menos un item"),
  /** Si se omite, el pedido queda en RECIBIDO y se reserva stock. */
  reservar_stock: z.boolean().default(true),
});

/**
 * Pedido generado a partir de un evento de canal ya normalizado.
 * `requiereRevision` lo decide el módulo de canales, no el controller.
 */
export const createPedidoChannelSchema = z.object({
  canal_id: z.string().uuid("canal_id es obligatorio para pedidos de canal"),
  cliente_id: z.string().uuid().nullable().optional(),
  requiere_revision: z.boolean().default(false),
  motivo_revision: z.string().max(2000).optional(),
  modalidad_entrega: z.enum(Object.values(DELIVERY_MODE)).optional(),
  fecha_prevista_entrega: z.string().date().optional(),
  estado_cobro: z.enum(Object.values(PAYMENT_STATUS)).default(PAYMENT_STATUS.PENDIENTE),
  observaciones: z.string().max(2000).optional(),
  items: z.array(itemSchema).default([]),
  reservar_stock: z.boolean().default(false),
});

export default createPedidoManualSchema;