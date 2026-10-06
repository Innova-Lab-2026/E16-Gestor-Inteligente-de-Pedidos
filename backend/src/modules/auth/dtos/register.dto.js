import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  metadata: z.record(z.any()).optional(),
  // Opcional: crea un emprendimiento inicial para el usuario.
  emprendimiento: z
    .object({ nombre: z.string().trim().min(1).max(150) })
    .optional(),
});

export default registerSchema;