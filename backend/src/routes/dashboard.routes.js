import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../middlewares/tenant.middleware.js";
import { DashboardController } from "../modules/dashboard/dashboard.controller.js";

const router = Router();
const controller = new DashboardController();

router.use(authMiddleware, tenantMiddleware());

router.get("/", controller.resumen);

export default router;