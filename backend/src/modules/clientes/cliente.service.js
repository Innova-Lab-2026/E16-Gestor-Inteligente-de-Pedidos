import { NotFoundError } from "../../errors/not-found.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";
import { ClienteDao } from "./cliente.dao.js";

/**
 * Reglas de negocio de clientes.
 * Un cliente pertenece a un único emprendimiento y nunca tiene cuenta
 * en la aplicación.
 */
export class ClienteService {
  constructor({ clienteDao, token } = {}) {
    this.clienteDao = clienteDao || new ClienteDao(token);
  }

  async create(emprendimientoId, datos) {
    return this.clienteDao.create({ emprendimientoId, ...datos });
  }

  async list(emprendimientoId) {
    return this.clienteDao.listByEmprendimiento(emprendimientoId);
  }

  async getById(emprendimientoId, id) {
    const cliente = await this.clienteDao.findById(emprendimientoId, id);
    if (!cliente) throw new NotFoundError(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(emprendimientoId, id, cambios) {
    await this.getById(emprendimientoId, id);
    return this.clienteDao.update(emprendimientoId, id, cambios);
  }

  /**
   * Resuelve (o crea) el cliente asociado a un pedido de canal externo.
   * @param {string} emprendimientoId
   * @param {{ nombre: string, telefono?: string|null, direccion?: string|null }} datos
   */
  async findOrCreateFromChannel(emprendimientoId, datos) {
    if (!datos?.nombre) {
      throw new BadRequestError(
        "No se puede identificar al cliente del pedido: falta el nombre"
      );
    }

    const existente = await this.clienteDao.findByPhone(
      emprendimientoId,
      datos.telefono
    );

    if (existente) {
      return existente;
    }

    return this.clienteDao.create({
      emprendimientoId,
      nombre: datos.nombre,
      telefono: datos.telefono ?? null,
      direccion: datos.direccion ?? null,
    });
  }
}

export default ClienteService;
