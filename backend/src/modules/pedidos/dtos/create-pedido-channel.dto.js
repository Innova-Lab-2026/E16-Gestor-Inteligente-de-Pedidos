import { z } from "zod";
import { createPedidoChannelSchema } from "./create-pedido-manual.dto.js";

export { createPedidoChannelSchema };

/**
 * Un pedido de canal puede llegar sin items identificados: en ese caso
 * se crea igual, con requiere_revision = true, para que el emprendedor lo
 * complete desde el panel.
 */
export const createPedidoChannelRowSchema = createPedidoChannelSchema.extend({
  items: createPedidoChannelSchema.shape.items.default([]),
});

export default createPedidoChannelSchema;