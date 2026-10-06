import { z } from "zod";
import { createProductoSchema, toProductoRow } from "./create-producto.dto.js";

export { createProductoSchema };

export const updateProductoSchema = createProductoSchema
  .omit({ tieneVariantes: true })
  .partial()
  .extend({ activo: z.boolean().optional() });

export const toUpdateProductoRow = toProductoRow;

export default updateProductoSchema;