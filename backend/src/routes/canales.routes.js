import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validator.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../middlewares/tenant.middleware.js";
import { CanalController } from "../modules/canales/canal.controller.js";
import { createCanalSchema } from "../modules/canales/dtos/create-canal.dto.js";
import { updateCanalSchema } from "../modules/canales/dtos/update-canal.dto.js";

const router = Router();
const controller = new CanalController();

const idParams = validate({ params: z.object({ id: z.string().uuid() }) });

router.use(authMiddleware, tenantMiddleware());

router.get("/", controller.list);
router.post("/", validate({ body: createCanalSchema }), controller.create);
router.get("/:id", idParams, controller.getById);
router.patch(
  "/:id",
  idParams,
  validate({ body: updateCanalSchema }),
  controller.update
);
router.post("/:id/activar", idParams, controller.toggle(true));
router.post("/:id/desactivar", idParams, controller.toggle(false));
router.get("/:id/eventos", idParams, controller.listEventos);

export default router;