import { z } from "zod";

const canalVentaSchema = z.enum(["WHATSAPP", "TELEGRAM", "EN_PERSONA"]);
const modalidadEntregaSchema = z.enum(["RETIRO", "ENVIO"]);

export const registerSchema = z.object({
  email: z.string().trim().email("email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  metadata: z.record(z.any()).optional(),
  // Opcional: crea un emprendimiento inicial para el usuario.
  emprendimiento: z
    .object({
      nombre: z.string().trim().min(1).max(150),
      rubro: z.string().trim().min(1).max(100),
      especialidad: z.string().trim().max(150).nullable().optional(),
      canales_venta: z.array(canalVentaSchema).min(1),
      modalidades_entrega: z.array(modalidadEntregaSchema).min(1),
    })
    .superRefine((data, context) => {
      if (data.rubro === "Otro" && !data.especialidad?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["especialidad"],
          message: "La especialidad es obligatoria para el rubro Otro",
        });
      }
    })
    .optional(),
});

export default registerSchema;