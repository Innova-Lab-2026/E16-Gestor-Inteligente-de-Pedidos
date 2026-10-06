import { z } from "zod";
import { DELIVERY_MODE } from "../../../constants/processing-status.enum.js";
import { PAYMENT_STATUS } from "../../../constants/payment-status.enum.js";

const itemSchema = z.object({
  productoId: z.string().uuid("productoId debe ser un UUID"),
  varianteId: z.string().uuid().nullable().optional(),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser un entero mayor a 0"),
  // Si se omite, se toma el precio actual del producto (se congela igual).
  precioUnitario: z.coerce.number().positive().optional(),
});

/**
 * Pedido creado por el emprendedor desde la aplicación.
 * Regla del dominio: origen_tipo = MANUAL implica canal_id = NULL.
 */
export const createPedidoManualSchema = z.object({
  clienteId: z.string().uuid().nullable().optional(),
  modalidadEntrega: z.enum(Object.values(DELIVERY_MODE)).optional(),
  fechaPrevistaEntrega: z.string().date().optional(),
  estadoCobro: z.enum(Object.values(PAYMENT_STATUS)).default(PAYMENT_STATUS.PENDIENTE),
  observaciones: z.string().max(2000).optional(),
  items: z.array(itemSchema).min(1, "El pedido debe tener al menos un item"),
  /** Si se omite, el pedido queda en RECIBIDO y se reserva stock. */
  reservarStock: z.boolean().default(true),
});

/**
 * Pedido generado a partir de un evento de canal ya normalizado.
 * `requiereRevision` lo decide el módulo de canales, no el controller.
 */
export const createPedidoChannelSchema = z.object({
  canalId: z.string().uuid("canalId es obligatorio para pedidos de canal"),
  clienteId: z.string().uuid().nullable().optional(),
  requiereRevision: z.boolean().default(false),
  motivoRevision: z.string().max(2000).optional(),
  modalidadEntrega: z.enum(Object.values(DELIVERY_MODE)).optional(),
  fechaPrevistaEntrega: z.string().date().optional(),
  estadoCobro: z.enum(Object.values(PAYMENT_STATUS)).default(PAYMENT_STATUS.PENDIENTE),
  observaciones: z.string().max(2000).optional(),
  items: z.array(itemSchema).default([]),
  reservarStock: z.boolean().default(false),
});

export default createPedidoManualSchema;