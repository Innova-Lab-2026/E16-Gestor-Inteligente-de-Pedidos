import { PROCESSING_STATUS } from "../../constants/processing-status.enum.js";
import { EventoCanalDao } from "./evento-canal.dao.js";
import { CanalService } from "../canales/canal.service.js";
import { PedidoService } from "../pedidos/pedido.service.js";
import { ProductoService } from "../productos/producto.service.js";
import { VarianteService } from "../variantes/variante.service.js";
import { ClienteService } from "../clientes/cliente.service.js";
import { InterpretadorService } from "../interpretacion/interpretador.service.js";
import { INTENCION_MENSAJE } from "../interpretacion/intencion.enum.js";
import { logger } from "../../utils/logger.js";

/**
 * Interpretación mínima de un mensaje de texto en items de pedido.
 *
 * Es deliberadamente conservadora: sólo reconoce "cantidad + descripción"
 * y devuelve candidatos sin decidir. Si algo no es concluyente, el
 * pedido se crea con `requiere_revision = true` para que el emprendedor lo
 * complete. Un parsing más sofisticado puede reemplazarse sin tocar el
 * resto del flujo.
 *
 * @param {string} texto
 * @returns {Array<{ cantidad: number|null, descripcion: string, variante: string|null }>}
 */
export const interpretarTextoPedido = (texto) => {
  if (!texto) return [];
  const svc = new InterpretadorService();
  return svc
    .extraerItems(texto)
    .map((it) => ({
      cantidad: it.cantidad,
      descripcion: it.producto_mencionado,
      variante: it.variante_mencionada,
      unidad: it.unidad,
    }));
};

/**
 * Módulo de eventos de canal.
 *
 * Ordena las tres garantías del canal:
 *   1. identificar el canal (y con él, el emprendimiento),
 *   2. garantizar idempotencia por (canal_id, external_message_id),
 *   3. delegar el pedido a PedidoService.
 *
 * No crea pedidos por su cuenta ni conoce proveedores.
 */
export class EventoCanalService {
  /**
   * @param {object} [deps]
   */
  constructor({
    canalService,
    eventoCanalDao,
    pedidoService,
    productoService,
    varianteService,
    clienteService,
    interpretadorService,
  } = {}) {
    this.canalService = canalService || new CanalService();
    this.eventoCanalDao =
      eventoCanalDao || new EventoCanalDao();
    this.pedidoService = pedidoService || new PedidoService();
    this.productoService = productoService || new ProductoService();
    this.varianteService = varianteService || new VarianteService();
    this.clienteService = clienteService || new ClienteService();
    this.interpretadorService = interpretadorService || new InterpretadorService();
  }

  /**
   * Procesa un evento ya normalizado por un adapter.
   * @param {import('../../adapters/channel-event.js').NormalizedChannelEvent} evento
   * @returns {Promise<{ duplicado: boolean, evento: object, pedido?: object }>}
   */
  async process(evento) {
    // 1. Identificar el canal -> emprendimiento (regla del tenant).
    const canal = await this.canalService.resolverPorEvento(evento);

    // 2. Idempotencia: si el evento ya existe, no se reprocesa.
    const previo = await this.eventoCanalDao.findByExternalId(
      canal.id,
      evento.externalMessageId
    );

    if (previo) {
      logger.info(
        `[EventosCanal] Evento duplicado ignorado: ${canal.tipo}/${evento.externalMessageId}`
      );
      return { duplicado: true, evento: previo, pedidoId: previo.pedido_id };
    }

    // 3. Registrar el evento crudo para auditoría y diagnóstico.
    const registrado = await this.eventoCanalDao.create({
      canalId: canal.id,
      mensajeriaMessageId: evento.externalMessageId,
      payloadRaw: evento.rawPayload,
      estadoProcesamiento: PROCESSING_STATUS.PROCESADO,
    });

    try {
      const interpretacion = this.interpretadorService.interpretar({ text: evento.text });

      // Sin intención de compra: no crear pedido.
      if (interpretacion.intencion !== INTENCION_MENSAJE.PEDIDO) {
        const actualizado = await this.eventoCanalDao.actualizarEstado(
          registrado.id,
          PROCESSING_STATUS.PROCESADO
        );
        return { duplicado: false, evento: actualizado, pedido: null };
      }

      // Intención de compra: resolver contra catálogo.
      const { pedido, estado } = await this.#generarPedido(canal, evento, interpretacion);

      const actualizado = await this.eventoCanalDao.actualizarEstado(
        registrado.id,
        estado,
        pedido?.id
      );

      return { duplicado: false, evento: actualizado, pedido };
    } catch (error) {
      logger.error(
        `[EventosCanal] Error procesando ${canal.tipo}/${evento.externalMessageId}`,
        error.message
      );

      await this.eventoCanalDao.actualizarEstado(
        registrado.id,
        PROCESSING_STATUS.ERROR
      );

      throw error;
    }
  }

  /**
   * Interpreta el mensaje, resuelve cliente/items y delega la creación.
   * No crea pedidos vacíos.
   * @param {object} canal
   * @param {import('../../adapters/channel-event.js').NormalizedChannelEvent} evento
   * @param {object} interpretacion
   */
  async #generarPedido(canal, evento, interpretacion) {
    const emprendimientoId = canal.emprendimiento_id;
    const motivos = [];
    const items = [];

    for (const interpretado of interpretacion.items) {
      const cantidad = interpretado.cantidad; // puede ser null; no asumir 1

      const { producto, requiereRevision: prodRevision, motivo: prodMotivo } =
        await this.productoService.resolveFromChannel(emprendimientoId, {
          nombre: interpretado.producto_mencionado,
        });

      if (!producto) {
        motivos.push(prodMotivo);
        continue;
      }

      const resolved = await this.varianteService.resolveFromChannel(
        producto,
        interpretado.variante_mencionada
      );

      if (resolved.requiereRevision) {
        motivos.push(resolved.motivo);
      }

      // Conservar item si producto identificado, aunque variante no se resuelva.
      // No asignar variante sustituta. Si falta cantidad, no crear item inválido.
      if (cantidad !== null) {
        items.push({
          productoId: producto.id,
          varianteId: resolved.variante?.id ?? null,
          cantidad,
        });
      } else {
        motivos.push(`cantidad faltante para ${producto.nombre}`);
      }
    }

    // No crear pedido vacío.
    if (items.length === 0) {
      const estado = motivos.length > 0
        ? PROCESSING_STATUS.REVISION_REQUERIDA
        : PROCESSING_STATUS.PROCESADO;
      if (motivos.length) {
        logger.warn(`[EventosCanal] Sin items resueltos: ${motivos.join("; ")}`);
      }
      return { pedido: null, estado };
    }

    let clienteId = null;
    try {
      const cliente = await this.clienteService.findOrCreateFromChannel(emprendimientoId, {
        nombre:
          evento.externalContactName ||
          evento.externalContactId ||
          "Cliente sin identificar",
        telefono: evento.externalContactId,
      });
      clienteId = cliente.id;
    } catch (error) {
      motivos.push(error.message);
    }

    if (motivos.length) {
      logger.warn(`[EventosCanal] Pedido para revisión: ${motivos.join("; ")}`);
    }

    const requiereRevision = motivos.length > 0;
    const pedido = await this.pedidoService.createFromChannel({
      emprendimientoId,
      canalId: canal.id,
      dto: {
        clienteId,
        requiereRevision,
        motivoRevision: motivos.join("; "),
        items,
        reservarStock: false,
        observaciones: evento.text?.slice(0, 2000) ?? null,
      },
    });

    return {
      pedido,
      estado: requiereRevision
        ? PROCESSING_STATUS.REVISION_REQUERIDA
        : PROCESSING_STATUS.PROCESADO,
    };
  }
}

export default EventoCanalService;
