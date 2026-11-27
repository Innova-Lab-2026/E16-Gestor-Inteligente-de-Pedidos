import { z } from "zod";

const optionalField = (schema) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );

const condicionSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.enum(["OK", "DEUDOR", "IRRESPETUOSO", "CANCELADOR"]).default("OK"),
);

export const createClienteSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio").max(150),
  apellido: optionalField(z.string().trim().max(150)),
  telefono: optionalField(z.string().trim().min(5).max(50)),
  direccion: optionalField(z.string().trim().max(2000)),
  observaciones: optionalField(z.string().trim().max(2000)),
  // Nuevos campos del catálogo (migración 009)
  tipo_documento: optionalField(z.string().trim().max(50)),
  numero_documento: optionalField(z.string().trim().max(50)),
  email: optionalField(z.string().trim().email()),
  /** URL de foto de perfil (migración 009). */
  foto_url: optionalField(z.string().url().nullable()),
  condicion: condicionSchema,
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