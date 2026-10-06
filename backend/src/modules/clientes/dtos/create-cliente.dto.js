import { z } from "zod";

export const createClienteSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(150),
  telefono: z.string().trim().min(5).max(50).optional(),
  direccion: z.string().trim().max(2000).optional(),
  observaciones: z.string().trim().max(2000).optional(),
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