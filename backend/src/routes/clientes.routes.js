import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validator.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../middlewares/tenant.middleware.js";
import { ClienteController } from "../modules/clientes/cliente.controller.js";
import {
  createClienteSchema,
  updateClienteSchema,
} from "../modules/clientes/dtos/create-cliente.dto.js";

const router = Router();
const controller = new ClienteController();

const idParams = validate({ params: z.object({ id: z.string().uuid() }) });

router.use(authMiddleware, tenantMiddleware());

router.get("/", controller.list);
router.post("/", validate({ body: createClienteSchema }), controller.create);
router.get("/:id", idParams, controller.getById);
router.patch(
  "/:id",
  idParams,
  validate({ body: updateClienteSchema }),
  controller.update,
);

export default router;
