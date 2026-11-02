import { createVarianteSchema } from "./create-variante.dto.js";

export { createVarianteSchema };

export const updateVarianteSchema = createVarianteSchema
  .omit({ stock_disponible: true })
  .partial()
  .extend({ stock_disponible: createVarianteSchema.shape.stock_disponible.optional() });

export default updateVarianteSchema;