// modules/productos/dtos/create-producto.dto.js
import { z } from "zod";

export const createProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  descripcion: z.string().trim().max(2000).optional(),
  precio: z.coerce.number().positive(),
  activo: z.boolean().default(true),

  // Claves snake_case para coincidir con el request JSON y la DB
  tiene_variantes: z.boolean().default(false),
  stock_disponible: z.coerce.number().int().min(0).nullable().optional(),
  stock_minimo: z.coerce.number().int().min(0).default(0),
  identificador_externo: z.string().trim().max(100).optional(),
  sku_o_identificador: z.string().trim().max(100).optional(),
});

export const updateProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  descripcion: z.string().trim().max(2000).optional(),
  precio: z.coerce.number().positive().optional(),
  activo: z.boolean().optional(),
  tiene_variantes: z.boolean().optional(),
  stock_disponible: z.coerce.number().int().min(0).nullable().optional(),
  stock_minimo: z.coerce.number().int().min(0).optional(),
  identificador_externo: z.string().trim().max(100).optional(),
});
