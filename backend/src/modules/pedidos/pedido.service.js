import { BadRequestError } from "../../errors/bad-request.error.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { ORDER_STATUS } from "../../constants/order-status.enum.js";
import { ORDER_ORIGIN as ORIGIN } from "../../constants/order-origin.enum.js";
import { PedidoDao } from "./pedido.dao.js";
import { ProductoService } from "../productos/producto.service.js";
import { VarianteService } from "../variantes/variante.service.js";
import { ClienteService } from "../clientes/cliente.service.js";
import { StockService } from "../stock/stock.service.js";
import { toPedidoResponse } from "./dtos/order-response.dto.js";

/**
 * Núcleo del dominio de pedidos.
 *
 * createManual() y createFromChannel() terminan creando la misma
 * entidad Pedido; lo único que cambia es cómo se obtiene la
 * información inicial. Ninguno de los dos menciona un proveedor.
 */
export class PedidoService {
  /**
   * @param {object} [deps]
   */
  constructor({
    pedidoDao,
    productoService,
    varianteService,
    clienteService,
    stockService,
    token,
  } = {}) {
    this.pedidoDao = pedidoDao || new PedidoDao(token);
    this.productoService = productoService || new ProductoService({ token });
    this.varianteService = varianteService || new VarianteService({ token });
    this.clienteService = clienteService || new ClienteService({ token });
    this.stockService = stockService || new StockService({ token });
  }

  /**
   * Resuelve los precios unitarios congelándolos y calcula subtotales.
   * @param {string} emprendimientoId
   * @param {Array} items
   * @returns {Promise<{ items: Array, subtotal: number, total: number }>}
   */
  async calcularItems(emprendimientoId, items) {
    const resueltos = [];

    for (const item of items) {
      const producto = await this.productoService.getById(
        emprendimientoId,
        item.productoId
      );

      let variante = null;
      if (item.varianteId) {
        variante = await this.varianteService.getById(item.varianteId);
        if (variante.producto_id !== producto.id) {
          throw new BadRequestError(
            `La variante ${variante.id} no pertenece al producto ${producto.nombre}`
          );
        }
      } else if (producto.tiene_variantes) {
        throw new BadRequestError(
          `El producto "${producto.nombre}" tiene variantes: indicá 'varianteId'`
        );
      }

      const precioUnitario = item.precioUnitario ?? Number(producto.precio);
      const subtotal = Number(
        (precioUnitario * item.cantidad).toFixed(2)
      );

      resueltos.push({
        productoId: producto.id,
        varianteId: variante?.id ?? null,
        cantidad: item.cantidad,
        precioUnitario,
        subtotal,
      });
    }

    const subtotal = Number(
      resueltos.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
    );

    return { items: resueltos, subtotal, total: subtotal };
  }

  /**
   * Núcleo de creación compartido por ambos orígenes.
   * @param {object} params
   * @param {string} params.emprendimientoId
   * @param {'MANUAL'|'CANAL'} params.origen
   * @param {string|null} params.canalId
   * @param {object} params.dto
   */
  async #crear({ emprendimientoId, origen, canalId, dto }) {
    // Regla del dominio: un pedido MANUAL nunca tiene canal.
    if (origen === ORIGIN.MANUAL && canalId) {
      throw new BadRequestError(
        "Un pedido manual no puede tener canal_id (debe ser NULL)"
      );
    }
    if (origen === ORIGIN.CANAL && !canalId) {
      throw new BadRequestError("Un pedido de canal exige canal_id");
    }

    let clienteId = dto.clienteId ?? null;
    if (clienteId) {
      // Verifica pertenencia al tenant antes de associar.
      await this.clienteService.getById(emprendimientoId, clienteId);
    }

    // Un pedido que requiere revisión puede no tener items identificados.
    const itemsEntrantes = Array.isArray(dto.items) ? dto.items : [];
    const requiereRevision = Boolean(dto.requiereRevision);

    if (itemsEntrantes.length === 0 && !requiereRevision) {
      throw new BadRequestError("El pedido debe tener al menos un item");
    }

    const { items, subtotal, total } = itemsEntrantes.length
      ? await this.calcularItems(emprendimientoId, itemsEntrantes)
      : { items: [], subtotal: 0, total: 0 };

    const cabecera = {
      emprendimiento_id: emprendimientoId,
      cliente_id: clienteId,
      origen_tipo: origen,
      canal_id: origen === ORIGIN.CANAL ? canalId : null,
      estado: ORDER_STATUS.RECIBIDO,
      estado_cobro: dto.estadoCobro,
      modalidad_entrega: dto.modalidadEntrega ?? null,
      fecha_prevista_entrega: dto.fechaPrevistaEntrega ?? null,
      subtotal,
      total,
      observaciones: requiereRevision
        ? [dto.observaciones, `REVISAR: ${dto.motivoRevision ?? "sin detalle"}`]
            .filter(Boolean)
            .join(" | ")
        : dto.observaciones ?? null,
      requiere_revision: requiereRevision,
    };

    // La cabecera y sus items se escriben juntos; la reserva de stock
    // se ejecuta inmediatamente después y forma parte de la misma
    // unidad lógica de negocio (ver db/migrations para el RPC transaccional).
    const pedido = await this.pedidoDao.createConItems(cabecera, items);

    if (dto.reservarStock && items.length) {
      await this.stockService.reservarPedido({
        emprendimientoId,
        pedidoId: pedido.id,
        items,
      });
    }

    return pedido;
  }

  /**
   * Pedido creado a mano por el相关内容. Se reserva stock por defecto.
   * @param {{ emprendimientoId: string, dto: object }} params
   */
  async createManual({ emprendimientoId, dto }) {
    return this.#crear({
      emprendimientoId,
      origen: ORIGIN.MANUAL,
      canalId: null,
      dto,
    });
  }

  /**
   * Pedido generado desde un evento de canal ya normalizado.
   * El módulo de canales y el adapter no participan de esta decisión.
   * @param {{ emprendimientoId: string, canalId: string, dto: object }} params
   */
  async createFromChannel({ emprendimientoId, canalId, dto }) {
    return this.#crear({
      emprendimientoId,
      origen: ORIGIN.CANAL,
      canalId,
      dto,
    });
  }

  async list(emprendimientoId, filtros) {
    return this.pedidoDao.list(emprendimientoId, filtros);
  }

  async getById(emprendimientoId, id) {
    const pedido = await this.pedidoDao.findByIdOrFail(emprendimientoId, id);
    return toPedidoResponse(pedido);
  }

  /**
   * Cambia el estado del pedido. Cancelar devuelve el stock; el resto de
   * transiciones no toca inventario.
   * @param {{ emprendimientoId: string, id: string, estado: string }} params
   */
  async changeStatus({ emprendimientoId, id, estado }) {
    const pedido = await this.pedidoDao.findByIdOrFail(
      emprendimientoId,
      id
    );

    const actualizado = await this.pedidoDao.updateEstado(
      emprendimientoId,
      id,
      estado
    );

    if (estado === ORDER_STATUS.CANCELADO) {
      await this.#restituirSiCorresponde(emprendimientoId, pedido);
    }

    return actualizado;
  }

  async changePaymentStatus({ emprendimientoId, id, estadoCobro }) {
    await this.pedidoDao.findByIdOrFail(emprendimientoId, id, {
      conItems: false,
    });
    return this.pedidoDao.updateEstadoCobro(
      emprendimientoId,
      id,
      estadoCobro
    );
  }

  /** Marca el pedido como revisado o pendiente de revisión desde el panel. */
  async setRevision({ emprendimientoId, id, requiereRevision, observaciones }) {
    await this.pedidoDao.findByIdOrFail(emprendimientoId, id, {
      conItems: false,
    });
    return this.pedidoDao.updateRevision(emprendimientoId, id, {
      requiereRevision,
      observaciones,
    });
  }

  async movimientosDe(emprendimientoId, id) {
    await this.pedidoDao.findByIdOrFail(emprendimientoId, id, {
      conItems: false,
    });
    return this.stockService.movimientosDePedido(id);
  }

  async eventosDe(emprendimientoId, id) {
    await this.pedidoDao.findByIdOrFail(emprendimientoId, id, {
      conItems: false,
    });
    return this.pedidoDao.eventosDe(id);
  }

  /**
   * Devuelve el stock de un pedido cancelado exactamente una vez.
   * @param {string} emprendimientoId
   * @param {object} pedido
   */
  async #restituirSiCorresponde(emprendimientoId, pedido) {
    const { reservado, restituido } =
      await this.pedidoDao.estadoStock(pedido.id);

    if (!reservado || restituido) return [];

    const items = await this.pedidoDao.itemsDe(pedido.id);

    return this.stockService.restituirPedido({
      emprendimientoId,
      pedidoId: pedido.id,
      items: items.map((item) => ({
        productoId: item.producto_id,
        varianteId: item.variante_id,
        cantidad: item.cantidad,
      })),
      motivo: `Restitución por cancelación del pedido ${pedido.id}`,
    });
  }

}

export default PedidoService;
