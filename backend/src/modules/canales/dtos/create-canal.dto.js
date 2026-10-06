import { z } from "zod";
import { CHANNEL_TYPE } from "../../../constants/channel-type.enum.js";

export const createCanalSchema = z.object({
  tipo: z.enum(Object.values(CHANNEL_TYPE), {
    errorMap: () => ({ message: "Tipo de canal inválido" }),
  }),
  identificadorExterno: z
    .string()
    .trim()
    .min(1, "identificadorExterno es obligatorio")
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

export const toCanalRow = (dto) => {
  const row = {};
  if (dto.nombre !== undefined) row.nombre = dto.nombre;
  if (dto.config !== undefined) row.config = dto.config;
  if (dto.activo !== undefined) row.activo = dto.activo;
  return row;
};

export default createCanalSchema;