import { z } from "zod";

export const createClienteSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(150),
  apellido: z.string().trim().max(150).optional(),
  telefono: z.string().trim().min(5).max(50).optional(),
  direccion: z.string().trim().max(2000).optional(),
  observaciones: z.string().trim().max(2000).optional(),
  // Nuevos campos del catálogo (migración 009)
  tipo_documento: z.string().trim().max(50).optional(),
  numero_documento: z.string().trim().max(50).optional(),
  email: z.string().email().optional(),
  /** URL de foto de perfil (migración 009). */
  foto_url: z.string().url().optional().nullable(),
  condicion: z.enum(["OK", "SUSPENDIDO", "BLOQUEADO"]).default("OK"),
});

export const updateClienteSchema = createClienteSchema.partial();

export const clienteResponseSchema = z.object({
  id: z.string().uuid(),
  venturement_id: z.string().uuid().optional(),
  nombre: z.string(),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

export default createClienteSchema;