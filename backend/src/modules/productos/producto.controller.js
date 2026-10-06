import { ProductoService } from "./producto.service.js";
import { VarianteService } from "../variantes/variante.service.js";
import { StockService } from "../stock/stock.service.js";
import { STOCK_MOVEMENT_TYPE } from "../../constants/processing-status.enum.js";

/** Controller de productos y variantes. */
export class ProductoController {
  constructor({ productoServiceFactory } = {}) {
    this.serviceFactory =
      productoServiceFactory || ((token) => new ProductoService({ token }));
  }

  #service(req) {
    return this.serviceFactory(req.userToken);
  }

  /** GET /api/productos */
  list = async (req, res) => {
    const soloActivos = req.query.incluirInactivos !== "true";
    const result = await this.#service(req).list(req.tenant.id, { soloActivos });
    return res.status(200).json(result);
  };

  /** POST /api/productos */
  create = async (req, res) => {
    const result = await this.#service(req).create(req.tenant.id, req.validated.body);
    return res.status(201).json(result);
  };

  /** GET /api/productos/:id */
  getById = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).getById(req.tenant.id, id);
    return res.status(200).json(result);
  };

  /** PATCH /api/productos/:id */
  update = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).update(
      req.tenant.id,
      id,
      req.validated.body
    );
    return res.status(200).json(result);
  };
}

/** Controller de variantes. */
export class VarianteController {
  constructor({ varianteServiceFactory } = {}) {
    this.serviceFactory =
      varianteServiceFactory || ((token) => new VarianteService({ token }));
  }

  #service(req) {
    return this.serviceFactory(req.userToken);
  }

  /** GET /api/productos/:productoId/variantes */
  list = async (req, res) => {
    const { productoId } = req.validated.params;
    const result = await this.#service(req).list(req.tenant.id, productoId);
    return res.status(200).json(result);
  };

  /** POST /api/productos/:productoId/variantes */
  create = async (req, res) => {
    const { productoId } = req.validated.params;
    const result = await this.#service(req).create(
      req.tenant.id,
      productoId,
      req.validated.body
    );
    return res.status(201).json(result);
  };

  /** PATCH /api/variantes/:id */
  update = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).update(id, req.validated.body);
    return res.status(200).json(result);
  };
}

/** Controller de movimientos de stock. */
export class StockController {
  constructor({ stockServiceFactory } = {}) {
    this.serviceFactory =
      stockServiceFactory || ((token) => new StockService({ token }));
  }

  #service(req) {
    return this.serviceFactory(req.userToken);
  }

  /** GET /api/stock/movimientos */
  listMovimientos = async (req, res) => {
    const limite = Number(req.query.limite ?? 100);
    const result = await this.#service(req).ultimosMovimientos(req.tenant.id, limite);
    return res.status(200).json(result);
  };

  /** POST /api/stock/movimientos (reposición, producción, pérdida, corrección) */
  createMovimiento = async (req, res) => {
    const { productoId, varianteId = null, tipo, cantidad, motivo } =
      req.validated.body;

    const result = await this.#service(req).ajustarManual({
      emprendimientoId: req.tenant.id,
      productoId,
      varianteId,
      tipo,
      cantidad,
      motivo,
    });

    return res.status(201).json(result);
  };
}

export { STOCK_MOVEMENT_TYPE };
export default ProductoController;