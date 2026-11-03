import { z } from "zod";

/**
 * Query params del callback de Embedded Signup de Meta.
 * Meta redirige aqui con el codigo de autorizacion y el estado.
 */
export const callbackWhatsappSchema = z.object({
  code: z.string().min(1, "code es obligatorio"),
  state: z.string().min(1, "state es obligatorio"),
});

export default callbackWhatsappSchema;

/**
 * Dto interno para completar la conexion despues del callback de Meta.
 */
export const completarConexionSchema = z.object({
  emprendimientoId: z.string().uuid(),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  numeroTelefono: z.string().min(1),
  accessToken: z.string().min(1),
  tokenExpiresAt: z.string().datetime().optional(),
  nombreCanal: z.string().trim().max(150).optional(),
  metadata: z.record(z.any()).optional(),
});
