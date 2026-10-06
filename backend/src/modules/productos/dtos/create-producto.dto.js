import { z } from "zod";

export const createProductoSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(150),
  descripcion: z.string().trim().max(2000).optional(),
  precio: z.coerce.number().positive("precio debe ser mayor a 0"),
  tieneVariantes: z.boolean().default(false),
  stockDisponible: z.coerce.number().int().min(0).optional(),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  identificadorExterno: z.string().trim().max(100).optional(),
});

export const updateProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  descripcion: z.string().trim().max(2000).optional(),
  precio: z.coerce.number().positive().optional(),
  activo: z.boolean().optional(),
  tieneVariantes: z.boolean().optional(),
  stockDisponible: z.coerce.number().int().min(0).optional(),
  stockMinimo: z.coerce.number().int().min(0).optional(),
  identificadorExterno: z.string().trim().max(100).optional(),
});

/** Traduce el DTO validado al snake_case de la tabla. */
export const toProductoRow = (dto) => {
  const row = {};
  if (dto.nombre !== undefined) row.nombre = dto.nombre;
  if (dto.descripcion !== undefined) row.descripcion = dto.descripcion;
  if (dto.precio !== undefined) row.precio = dto.precio;
  if (dto.activo !== undefined) row.activo = dto.activo;
  if (dto.tieneVariantes !== undefined) row.tiene_variantes = dto.tieneVariantes;
  if (dto.stockDisponible !== undefined) row.stock_disponible = dto.stockDisponible;
  if (dto.stockMinimo !== undefined) row.stock_minimo = dto.stockMinimo;
  if (dto.identificadorExterno !== undefined) {
    row.identificador_externo = dto.identificadorExterno;
  }
  return row;
};

export default createProductoSchema;