import { PedidoService } from "./pedido.service.js";

/** Controller de pedidos. */
export class PedidoController {
  constructor({ pedidoServiceFactory } = {}) {
    this.serviceFactory =
      pedidoServiceFactory || ((token) => new PedidoService({ token }));
  }

  #service(req) {
    return this.serviceFactory(req.userToken);
  }

  /** GET /api/pedidos */
  list = async (req, res) => {
    const result = await this.#service(req).list(req.tenant.id, req.validated.query);
    return res.status(200).json(result);
  };

  /** POST /api/pedidos (origen_tipo = MANUAL, canal_id = NULL) */
  createManual = async (req, res) => {
    const pedido = await this.#service(req).createManual({
      emprendimientoId: req.tenant.id,
      dto: req.validated.body,
    });
    return res.status(201).json(pedido);
  };

  /** GET /api/pedidos/:id */
  getById = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).getById(req.tenant.id, id);
    return res.status(200).json(result);
  };

  /** PATCH /api/pedidos/:id/estado */
  changeStatus = async (req, res) => {
    const { id } = req.validated.params;
    const { estado } = req.validated.body;
    const result = await this.#service(req).changeStatus({
      emprendimientoId: req.tenant.id,
      id,
      estado,
    });
    return res.status(200).json(result);
  };

  /** PATCH /api/pedidos/:id/cobro */
  changePaymentStatus = async (req, res) => {
    const { id } = req.validated.params;
    const { estadoCobro } = req.validated.body;
    const result = await this.#service(req).changePaymentStatus({
      emprendimientoId: req.tenant.id,
      id,
      estadoCobro,
    });
    return res.status(200).json(result);
  };

  /** PATCH /api/pedidos/:id/revision */
  setRevision = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).setRevision({
      emprendimientoId: req.tenant.id,
      id,
      requiereRevision: req.validated.body.requiereRevision,
      observaciones: req.validated.body.observaciones,
    });
    return res.status(200).json(result);
  };

  /** GET /api/pedidos/:id/movimientos */
  listMovimientos = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).movimientosDe(req.tenant.id, id);
    return res.status(200).json(result);
  };

  /** GET /api/pedidos/:id/eventos */
  listEventos = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).eventosDe(req.tenant.id, id);
    return res.status(200).json(result);
  };
}

export default PedidoController;