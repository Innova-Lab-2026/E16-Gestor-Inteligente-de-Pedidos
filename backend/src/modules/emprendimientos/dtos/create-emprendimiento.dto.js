import { z } from "zod";

export const createEmprendimientoSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(150),
});

export const updateEmprendimientoSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("El id debe ser un UUID válido"),
});

/**
 * @param {import('zod').infer<typeof createEmprendimientoSchema>} data
 */
export const toCreateEmprendimientoDTO = (data) => ({
  nombre: data.nombre,
});

export default createEmprendimientoSchema;