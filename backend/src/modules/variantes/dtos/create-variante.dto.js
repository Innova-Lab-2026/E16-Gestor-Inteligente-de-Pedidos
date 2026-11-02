import { z } from "zod";

export const createVarianteSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(100),
  stock_disponible: z.coerce.number().int().min(0).default(0),
  stock_minimo: z.coerce.number().int().min(0).default(0),
  activo: z.boolean().default(true),
});

export const updateVarianteSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  stock_disponible: z.coerce.number().int().min(0).optional(),
  stock_minimo: z.coerce.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});

export default createVarianteSchema;