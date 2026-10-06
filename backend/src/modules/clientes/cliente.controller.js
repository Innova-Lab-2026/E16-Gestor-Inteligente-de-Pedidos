import { ClienteService } from "./cliente.service.js";

/** Controller de clientes. */
export class ClienteController {
  constructor({ clienteServiceFactory } = {}) {
    this.serviceFactory =
      clienteServiceFactory || ((token) => new ClienteService({ token }));
  }

  #service(req) {
    return this.serviceFactory(req.userToken);
  }

  /** GET /api/clientes */
  list = async (req, res) => {
    const result = await this.#service(req).list(req.tenant.id);
    return res.status(200).json(result);
  };

  /** POST /api/clientes */
  create = async (req, res) => {
    const result = await this.#service(req).create(req.tenant.id, req.validated.body);
    return res.status(201).json(result);
  };

  /** GET /api/clientes/:id */
  getById = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).getById(req.tenant.id, id);
    return res.status(200).json(result);
  };

  /** PATCH /api/clientes/:id */
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

export default ClienteController;