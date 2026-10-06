import { EmprendimientoService } from "./emprendimiento.service.js";
import { UsuarioDao } from "../usuarios/usuario.dao.js";

/**
 * Controller de emprendimientos (gestión del tenant).
 */
export class EmprendimientoController {
  constructor({ emprendimientoServiceFactory } = {}) {
    // Se inyecta un servicio por request en las rutas (con el JWT del
    // usuario); este constructor es sólo para el Composition Root.
    this.serviceFactory =
      emprendimientoServiceFactory ||
      ((token) => new EmprendimientoService({ token }));

  }
  #service(req) {
    return typeof this.serviceFactory === "function"
      ? this.serviceFactory(req.userToken)
      : this.serviceFactory;
  }

  /** GET /api/emprendimientos */
  listMine = async (req, res) => {
    const rows = await this.#service(req).listMine(req.user.id);
    return res.status(200).json(rows);
  };

  /** POST /api/emprendimientos */
  create = async (req, res) => {
    const { nombre } = req.validated.body;
    const creado = await this.#service(req).create({ nombre });
    return res.status(201).json(creado);
  };

  /** GET /api/emprendimientos/:id */
  getById = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).getById(id);
    return res.status(200).json(result);
  };

  /** PATCH /api/emprendimientos/:id */
  update = async (req, res) => {
    const { id } = req.validated.params;
    const result = await this.#service(req).rename(id, req.validated.body);
    return res.status(200).json(result);
  };
}

/** Perfil del usuario autenticado (módulo usuarios). */
export class UsuarioController {
  constructor({ usuarioDaoFactory } = {}) {
    this.daoFactory =
      usuarioDaoFactory || ((token) => new UsuarioDao(token));
  }

  #dao(req) {
    return typeof this.daoFactory === "function"
      ? this.daoFactory(req.userToken)
      : this.daoFactory;
  }

  /** GET /api/usuarios/me */
  me = async (req, res) => {
    const user = await this.#dao(req).findOwn(req.user.id);
    return res.status(200).json(user);
  };

  /** GET /api/usuarios/:id */
  getById = async (req, res) => {
    const { id } = req.validated.params;
    const user = await this.#dao(req).findOwn(id);
    return res.status(200).json(user);
  };
}

export default EmprendimientoController;
