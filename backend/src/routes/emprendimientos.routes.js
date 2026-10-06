import { Router } from "express";
import { validate } from "../middlewares/validator.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../middlewares/tenant.middleware.js";
import {
  EmprendimientoController,
  UsuarioController,
} from "../modules/emprendimientos/emprendimiento.controller.js";
import {
  createEmprendimientoSchema,
  updateEmprendimientoSchema,
  idParamSchema,
} from "../modules/emprendimientos/dtos/create-emprendimiento.dto.js";

const router = Router();

const undertakingsController = new EmprendimientoController();
const usuariosController = new UsuarioController();

const idParams = validate({ params: idParamSchema });

// Los emprendimientos del usuario autenticado.
router.get("/", authMiddleware, undertakingsController.listMine);
router.post(
  "/",
  authMiddleware,
  validate({ body: createEmprendimientoSchema }),
  undertakingsController.create
);

// Detalle: exige ser miembro del tenant (RLS + filtro explícito).
router.get(
  "/:id",
  authMiddleware,
  idParams,
  tenantMiddleware(),
  undertakingsController.getById
);
router.patch(
  "/:id",
  authMiddleware,
  idParams,
  validate({ body: updateEmprendimientoSchema }),
  tenantMiddleware(),
  undertakingsController.update
);

// Perfil del usuario autenticado.
router.get("/me/usuario", authMiddleware, usuariosController.me);
router.get(
  "/me/usuario/:id",
  authMiddleware,
  idParams,
  usuariosController.getById
);

export default router;