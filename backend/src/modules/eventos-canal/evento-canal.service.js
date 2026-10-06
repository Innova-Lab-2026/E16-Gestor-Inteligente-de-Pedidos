import { PROCESSING_STATUS } from "../../constants/processing-status.enum.js";
import { EventoCanalDao } from "./evento-canal.dao.js";
import { CanalService } from "../canales/canal.service.js";
import { PedidoService } from "../pedidos/pedido.service.js";
import { ProductoService } from "../productos/producto.service.js";
import { VarianteService } from "../variantes/variante.service.js";
import { ClienteService } from "../clientes/cliente.service.js";
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

  return String(texto)
    .split(/[\n;,]+/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      // "2 remeras negras talle M" -> cantidad 2, resto "remeras negras talle M"
      const conCantidad = /^(\d{1,3})\s*(?:x\s*)?(.+)$/i.exec(linea);
      const cantidad = conCantidad ? Number(conCantidad[1]) : null;
      const descripcion = (conCantidad ? conCantidad[2] : linea).trim();

      // Se separa un eventual talle/color al final: "remera talle M".
      const conVariante =
        /(.+?)\s+(talle|color)\s+([\wÁÉÍÓÚáéíóúñ]+)\s*$/i.exec(descripcion);

      if (conVariante) {
        return {
          cantidad,
          descripcion: conVariante[1].trim(),
          variante: `${conVariante[2]} ${conVariante[3]}`.trim(),
        };
      }

      return { cantidad, descripcion, variante: null };
    })
    .filter((item) => item.descripcion.length > 0);
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
  } = {}) {
    this.canalService = canalService || new CanalService();
    this.eventoCanalDao =
      eventoCanalDao || new EventoCanalDao();
    this.pedidoService = pedidoService || new PedidoService();
    this.productoService = productoService || new ProductoService();
    this.varianteService = varianteService || new VarianteService();
    this.clienteService = clienteService || new ClienteService();
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
      estadoProcesamiento: PROCESSING_STATUS.REVISION_REQUERIDA,
    });

    try {
      const pedido = await this.#generarPedido(canal, evento);

      const estado = pedido.requiere_revision
        ? PROCESSING_STATUS.REVISION_REQUERIDA
        : PROCESSING_STATUS.PROCESADO;

      const actualizado = await this.eventoCanalDao.actualizarEstado(
        registrado.id,
        estado,
        pedido.id
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
   * @param {object} canal
   * @param {import('../../adapters/channel-event.js').NormalizedChannelEvent} evento
   */
  async #generarPedido(canal, evento) {
    const emprendimientoId = canal.emprendimiento_id;
    const motivos = [];
    const items = [];

    for (const interpretado of interpretarTextoPedido(evento.text)) {
      const cantidad = interpretado.cantidad ?? 1;

      const { producto, requiereRevision, motivo } =
        await this.productoService.resolveFromChannel(emprendimientoId, {
          nombre: interpretado.descripcion,
        });

      if (!producto) {
        motivos.push(motivo);
        continue;
      }

      const resolved = await this.varianteService.resolveFromChannel(
        producto,
        interpretado.variante
      );

      if (resolved.requiereRevision) {
        motivos.push(resolved.motivo);
        continue;
      }

      items.push({
        productoId: producto.id,
        varianteId: resolved.variante?.id ?? null,
        cantidad,
      });
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

    return this.pedidoService.createFromChannel({
      emprendimientoId,
      canalId: canal.id,
      dto: {
        clienteId,
        requiereRevision: motivos.length > 0 || items.length === 0,
        motivoRevision: motivos.join("; "),
        items,
        // Nunca se reserva stock desde un mensaje ambiguo: primero lo
        // revisa el emprendimiento antes de descontar.
        reservarStock: false,
        observaciones: evento.text?.slice(0, 2000) ?? null,
      },
    });
  }
}

export default EventoCanalService;
