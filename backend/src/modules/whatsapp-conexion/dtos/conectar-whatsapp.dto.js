import { z } from "zod";

/**
 * Solicitud de inicio de conexion WhatsApp (Embedded Signup).
 * El frontend solicita la URL de autorizacion de Meta para un emprendimiento.
 */
export const conectarWhatsappSchema = z.object({
  emprendimientoId: z.string().uuid("emprendimientoId debe ser un UUID valido"),
  nombreCanal: z.string().trim().min(1).max(150).optional(),
});

export default conectarWhatsappSchema;

/**
 * Respuesta del inicio de conexión: URL de Meta Embedded Signup a la que
 * el frontend debe redirigir al usuario.
 */
export const conectarWhatsappResponseSchema = z.object({
  connectionUrl: z.string().url(),
  estado: z.string(),
});
