import { NotFoundError } from "../../errors/not-found.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";
import { CHANNEL_TYPE, isChannelType } from "../../constants/channel-type.enum.js";
import { channelAdapterFactory } from "../../adapters/channel-adapter.factory.js";
import { CanalDao } from "./canal.dao.js";

/**
 * Reglas del módulo de canales.
 *
 * Responsabilidad única: resolver "canal externo -> emprendimiento" y
 * administrar las conexiones. No sabe nada de pedidos.
 */
export class CanalService {
  /**
   * @param {{ canalDao?: CanalDao, adapterFactory?: import('../../adapters/channel-adapter.factory.js').ChannelAdapterFactory, token?: string }} [deps]
   */
  constructor({ canalDao, adapterFactory, token } = {}) {
    this.canalDao = canalDao || new CanalDao(token);
    this.adapterFactory = adapterFactory || channelAdapterFactory;
  }

  async create(emprendimientoId, dto) {
    if (!isChannelType(dto.tipo)) {
      throw new BadRequestError(
        `Tipo de canal inválido: ${dto.tipo}. Permitidos: ${Object.values(
          CHANNEL_TYPE
        ).join(", ")}`
      );
    }

    // No se puede dar de alta un canal si no hay adapter para ese tipo:
    // garantiza que todo canal registrado tiene un consumidor real.
    if (!this.adapterFactory.supports(dto.tipo)) {
      throw new BadRequestError(
        `No hay adapter implementado para el canal ${dto.tipo}`
      );
    }

    return this.canalDao.create({ emprendimientoId, ...dto });
  }

  async list(emprendimientoId) {
    return this.canalDao.listByEmprendimiento(emprendimientoId);
  }

  async getById(emprendimientoId, id) {
    return this.canalDao.findByIdOrFail(emprendimientoId, id);
  }

  async update(emprendimientoId, id, cambios) {
    await this.getById(emprendimientoId, id);
    return this.canalDao.update(emprendimientoId, id, cambios);
  }

  async toggleActivo(emprendimientoId, id, activo) {
    await this.getById(emprendimientoId, id);
    return this.canalDao.setActivo(emprendimientoId, id, activo);
  }

  /**
   * Resuelve el tenant desde un evento normalizado.
   * @param {import('../../adapters/channel-event.js').NormalizedChannelEvent} evento
   * @returns {Promise<object>} la fila de `canales` con su emprendimiento_id
   * @throws {NotFoundError} si el canal externo no está registrado
   */
  async resolverPorEvento(evento) {
    const canal = await this.canalDao.findByExternal(
      evento.channelType,
      evento.externalChannelId
    );

    if (!canal) {
      throw new NotFoundError(
        `No hay ningún canal ${evento.channelType} activo con identificador externo "${evento.externalChannelId}". ` +
          "Registralo desde el panel antes de recibir eventos de esta fuente."
      );
    }

    return canal;
  }

  /** Verificación de que un canal tiene un adapter operativo. */
  verificarIntegracion(tipo) {
    if (!this.adapterFactory.supports(tipo)) {
      throw new NotFoundError(`No hay adapter registrado para ${tipo}`);
    }
    return { tipo, adapter: this.adapterFactory.get(tipo).constructor.name };
  }
}

export default CanalService;