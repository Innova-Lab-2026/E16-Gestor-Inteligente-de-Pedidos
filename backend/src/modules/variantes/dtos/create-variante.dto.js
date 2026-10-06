import { z } from "zod";

export const createVarianteSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(100),
  stockDisponible: z.coerce.number().int().min(0).default(0),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  activo: z.boolean().default(true),
});

export const updateVarianteSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  stockDisponible: z.coerce.number().int().min(0).optional(),
  stockMinimo: z.coerce.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});

export const toVarianteRow = (dto) => {
  const row = {};
  if (dto.nombre !== undefined) row.nombre = dto.nombre;
  if (dto.stockDisponible !== undefined) row.stock_disponible = dto.stockDisponible;
  if (dto.stockMinimo !== undefined) row.stock_minimo = dto.stockMinimo;
  if (dto.activo !== undefined) row.activo = dto.activo;
  return row;
};

export default createVarianteSchema;