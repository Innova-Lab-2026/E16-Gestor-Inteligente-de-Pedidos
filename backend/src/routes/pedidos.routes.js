import { Router } from "express";
import { validate } from "../middlewares/validator.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../middlewares/tenant.middleware.js";
import { PedidoController } from "../modules/pedidos/pedido.controller.js";
import { createPedidoManualSchema } from "../modules/pedidos/dtos/create-pedido-manual.dto.js";
import {
  changeOrderStatusSchema,
  changePaymentStatusSchema,
  pedidoIdParamSchema,
  listPedidosQuerySchema,
} from "../modules/pedidos/dtos/change-order-status.dto.js";
import { z } from "zod";

const router = Router();
const controller = new PedidoController();

const idParams = validate({ params: pedidoIdParamSchema });

router.use(authMiddleware, tenantMiddleware());

router.get("/", validate({ query: listPedidosQuerySchema }), controller.list);
router.post("/", validate({ body: createPedidoManualSchema }), controller.createManual);

router.get("/:id", idParams, controller.getById);
router.patch(
  "/:id/estado",
  idParams,
  validate({ body: changeOrderStatusSchema }),
  controller.changeStatus
);
router.patch(
  "/:id/cobro",
  idParams,
  validate({ body: changePaymentStatusSchema }),
  controller.changePaymentStatus
);
router.patch(
  "/:id/revision",
  idParams,
  validate({
    body: z.object({
      requiereRevision: z.boolean(),
      observaciones: z.string().max(2000).optional(),
    }),
  }),
  controller.setRevision
);
router.get("/:id/movimientos", idParams, controller.listMovimientos);
router.get("/:id/eventos", idParams, controller.listEventos);

export default router;