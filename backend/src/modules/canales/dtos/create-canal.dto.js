import { z } from "zod";
import { CHANNEL_TYPE } from "../../../constants/channel-type.enum.js";

export const createCanalSchema = z.object({
  tipo: z.enum(Object.values(CHANNEL_TYPE), {
    errorMap: () => ({ message: "Tipo de canal inválido" }),
  }),
  identificador_externo: z
    .string()
    .trim()
    .min(1, "identificador_externo es obligatorio")
    .max(255),
  nombre: z.string().trim().max(150).optional(),
  config: z.record(z.any()).optional(),
  activo: z.boolean().default(true),
});

export const updateCanalSchema = z.object({
  nombre: z.string().trim().max(150).optional(),
  config: z.record(z.any()).optional(),
  activo: z.boolean().optional(),
});

export default createCanalSchema;