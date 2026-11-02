import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validator.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tenantMiddleware } from "../middlewares/tenant.middleware.js";
import {
  ProductoController,
  VarianteController,
  StockController,
} from "../modules/productos/producto.controller.js";
import { createProductoSchema } from "../modules/productos/dtos/create-producto.dto.js";
import { updateProductoSchema } from "../modules/productos/dtos/update-producto.dto.js";
import { createVarianteSchema } from "../modules/variantes/dtos/create-variante.dto.js";
import { updateVarianteSchema } from "../modules/variantes/dtos/update-variante.dto.js";
import { STOCK_MOVEMENT_TYPE } from "../constants/processing-status.enum.js";

// --- Controllers ---
const productosController = new ProductoController();
const variantesController = new VarianteController();
const stockController = new StockController();

// --- Helper para UUIDs en params ---
const uuidParam = (name) =>
  validate({ params: z.object({ [name]: z.string().uuid() }) });

// =====================================================================
// SCHEMAS DE VALIDACIÓN (SNAKE_CASE)
// =====================================================================

/** Schema para crear movimiento de stock manual */
const crearMovimientoStockSchema = z.object({
  producto_id: z.string().uuid(),
  variante_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(
    Object.values(STOCK_MOVEMENT_TYPE).filter(
      (t) => t !== STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO,
    ),
    { errorMap: () => ({ message: "Tipo de movimiento inválido" }) },
  ),
  cantidad: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, {
      message: "La cantidad no puede ser 0",
    }),
  motivo: z.string().max(2000).optional(),
});

// =====================================================================
// ROUTER PRINCIPAL: PRODUCTOS Y VARIANTES ANIDADAS
// =====================================================================
const router = Router();

// Aplicamos middlewares globales al router principal
router.use(authMiddleware, tenantMiddleware());

// --- Productos ---
router.get("/", productosController.list);
router.post(
  "/",
  validate({ body: createProductoSchema }),
  productosController.create,
);
router.get("/:id", uuidParam("id"), productosController.getById);
router.patch(
  "/:id",
  uuidParam("id"),
  validate({ body: updateProductoSchema }),
  productosController.update,
);

// --- Variantes anidadas bajo el producto ---
router.get(
  "/:productoId/variantes",
  uuidParam("productoId"),
  variantesController.list,
);
router.post(
  "/:productoId/variantes",
  uuidParam("productoId"),
  validate({ body: createVarianteSchema }),
  variantesController.create,
);

export default router;

// --- Stock Router ---
const stockRouter = Router();
stockRouter.use(authMiddleware, tenantMiddleware());

stockRouter.get("/movimientos", stockController.listMovimientos);
stockRouter.post(
  "/movimientos",
  validate({ body: crearMovimientoStockSchema }),
  stockController.createMovimiento,
);

// --- Variantes Router Global (para PATCH directo por ID) ---
const variantesRouter = Router();
variantesRouter.use(authMiddleware, tenantMiddleware());

variantesRouter.patch(
  "/:id",
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateVarianteSchema,
  }),
  variantesController.update,
);

export { stockRouter, variantesRouter };
