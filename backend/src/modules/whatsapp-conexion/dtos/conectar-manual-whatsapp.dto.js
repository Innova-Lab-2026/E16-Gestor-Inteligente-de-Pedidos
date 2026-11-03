import { z } from "zod";

export const conectarManualWhatsappSchema = z.object({
  wabaId: z.string().trim().min(1, "wabaId es requerido"),
  phoneNumberId: z.string().trim().min(1, "phoneNumberId es requerido"),
  numeroTelefono: z.string().trim().min(1, "numeroTelefono es requerido"),
  accessToken: z.string().trim().min(1, "accessToken es requerido"),
  nombreCanal: z.string().trim().min(1).max(150).optional(),
});

export default conectarManualWhatsappSchema;