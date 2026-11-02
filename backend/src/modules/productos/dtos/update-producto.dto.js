import { z } from "zod";
import { createProductoSchema } from "./create-producto.dto.js";

export { createProductoSchema };

export const updateProductoSchema = createProductoSchema
  .omit({ tiene_variantes: true })
  .partial()
  .extend({ activo: z.boolean().optional() });

export default updateProductoSchema;