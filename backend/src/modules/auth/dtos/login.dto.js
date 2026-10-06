import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("email inválido"),
  password: z.string().min(1, "password es obligatorio"),
});

export const toLoginDTO = (data) => ({
  email: data.email,
  password: data.password,
});

export default loginSchema;