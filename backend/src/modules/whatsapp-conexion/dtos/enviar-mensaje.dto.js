import { z } from "zod";

/**
 * Solicitud de envio de mensaje saliente por WhatsApp Cloud API.
 */
export const enviarMensajeSchema = z.object({
  conexionId: z.string().uuid("conexionId debe ser un UUID valido"),
  telefonoDestino: z
    .string()
    .min(1, "telefonoDestino es obligatorio")
    .max(50),
  tipo: z.enum(["texto", "plantilla"]).default("texto"),
  texto: z.string().min(1, "texto es obligatorio para mensajes de texto").optional(),
  nombrePlantilla: z.string().optional(),
  idiomaPlantilla: z.string().optional(),
  parametrosPlantilla: z.array(z.string()).optional(),
});

export default enviarMensajeSchema;
