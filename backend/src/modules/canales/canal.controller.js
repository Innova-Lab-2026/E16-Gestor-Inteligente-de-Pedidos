import { CanalService } from "./canal.service.js";
import { EventoCanalDao } from "../eventos-canal/evento-canal.dao.js";

/** Controller de canales. */
export class CanalController {
  constructor({ canalServiceFactory, eventoDaoFactory } = {}) {
    this.serviceFactory =
      canalServiceFactory || ((token) => new CanalService({ token }));
    this.eventoDaoFactory =
      eventoDaoFactory || ((token) => new EventoCanalDao(token));
  }

  #service(req) {
    return this.serviceFactory(req.userToken);
  }

  /** GET /api/canales */
  list = async (req, res) => {
    const result = await this.#service(req).list(req.tenant.id);
    return res.status(200).json(result);
  };

  /** POST /api/canales */
  create = async (req, res) => {
    const result = await this.#service(req).create(req.tenant.id, req.validated.body);
    return res.status(201).json(result);
  };

  /** GET /api/canales/:id */
  getById = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).getById(req.tenant.id, id);
    return res.status(200).json(result);
  };

  /** PATCH /api/canales/:id */
  update = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).update(
      req.tenant.id,
      id,
      req.validated.body
    );
    return res.status(200).json(result);
  };

  /** POST /api/canales/:id/activar | /desactivar */
  toggle = (activo) => async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).toggleActivo(req.tenant.id, id, activo);
    return res.status(200).json(result);
  };

  /** GET /api/canales/:id/eventos */
  listEventos = async (req, res) => {
    const { id } = req.validated.params;
    const dao = this.eventoDaoFactory(req.userToken);
    const result = await dao.listByCanal(id);
    return res.status(200).json(result);
  };
}

export default CanalController;