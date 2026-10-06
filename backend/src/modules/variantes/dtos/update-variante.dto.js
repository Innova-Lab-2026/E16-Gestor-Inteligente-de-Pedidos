import { createVarianteSchema, toVarianteRow } from "./create-variante.dto.js";

export { createVarianteSchema, toVarianteRow };

export const updateVarianteSchema = createVarianteSchema
  .omit({ stockDisponible: true })
  .partial()
  .extend({ stockDisponible: createVarianteSchema.shape.stockDisponible.optional() });

export default updateVarianteSchema;