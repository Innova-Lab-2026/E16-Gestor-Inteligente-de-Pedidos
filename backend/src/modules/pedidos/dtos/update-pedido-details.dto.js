import { z } from "zod";
import { DELIVERY_MODE } from "../../../constants/processing-status.enum.js";

export const updatePedidoDetailsSchema = z
  .object({
    modalidad_entrega: z.enum(Object.values(DELIVERY_MODE)).nullable().optional(),
    direccion_entrega: z.string().max(500).nullable().optional(),
    fecha_prevista_entrega: z.string().date().nullable().optional(),
    hora_prevista_entrega: z.string().time().nullable().optional(),
    medios_pago: z.array(z.string()).optional(),
  })
  .refine((details) => Object.keys(details).length > 0, {
    message: "Indicá al menos un dato para actualizar",
  });

export default updatePedidoDetailsSchema;
