import { z } from "zod";

const canalVentaSchema = z.enum(["WHATSAPP", "TELEGRAM", "EN_PERSONA"]);
const modalidadEntregaSchema = z.enum(["RETIRO", "ENVIO"]);

export const createEmprendimientoSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(150),
  rubro: z.string().trim().min(1).max(100),
  especialidad: z.string().trim().max(150).nullable().optional(),
  canales_venta: z.array(canalVentaSchema).min(1),
  modalidades_entrega: z.array(modalidadEntregaSchema).min(1),
}).superRefine((data, context) => {
  if (data.rubro === "Otro" && !data.especialidad?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["especialidad"],
      message: "La especialidad es obligatoria para el rubro Otro",
    });
  }
});

export const updateEmprendimientoSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  rubro: z.string().trim().min(1).max(100).optional(),
  especialidad: z.string().trim().max(150).nullable().optional(),
  canales_venta: z.array(canalVentaSchema).min(1).optional(),
  modalidades_entrega: z.array(modalidadEntregaSchema).min(1).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("El id debe ser un UUID válido"),
});

/**
 * @param {import('zod').infer<typeof createEmprendimientoSchema>} data
 */
export const toCreateEmprendimientoDTO = (data) => ({
  nombre: data.nombre,
  rubro: data.rubro,
  especialidad: data.especialidad ?? null,
  canales_venta: data.canales_venta,
  modalidades_entrega: data.modalidades_entrega,
});

export default createEmprendimientoSchema;