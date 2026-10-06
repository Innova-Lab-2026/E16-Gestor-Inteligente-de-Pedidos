import { ORDER_STATUS_TRANSITIONS } from "../../src/constants/order-status.enum.js";

/** StockDao en memoria: aplica deltas y no permite stock negativo. */
export class FakeStockDao {
  /** @param {Record<string, {producto?: number, variante?: number}>} stock */
  constructor(stock = {}) {
    this.stock = JSON.parse(JSON.stringify(stock));
    this.aplicados = [];
  }

  async getProductoStock(productoId) {
    const row = this.stock[productoId];
    if (!row) return null;
    return { id: productoId, stock_disponible: row.producto, stock_minimo: 0 };
  }

  async getVarianteStock(varianteId) {
    const row = this.stock[varianteId];
    if (!row) return null;
    return { id: varianteId, stock_disponible: row.variante, stock_minimo: 0 };
  }

  async applyDelta({ productoId, varianteId }, delta) {
    const key = varianteId || productoId;
    const campo = varianteId ? "variante" : "producto";
    const actual = this.stock[key]?.[campo];

    if (actual === undefined) return null;
    if (actual + delta < 0) return null;

    this.stock[key][campo] = actual + delta;
    this.aplicados.push({ key, campo, delta, resultante: actual + delta });
    return actual + delta;
  }
}

/** MovimientoStockDao en memoria. */
export class FakeMovimientoDao {
  constructor() {
    this.movimientos = [];
  }

  async create(movimiento) {
    const row = { id: `mov-${this.movimientos.length + 1}`, ...movimiento };
    this.movimientos.push(row);
    return row;
  }

  async listByPedido(pedidoId) {
    return this.movimientos.filter((m) => m.pedido_id === pedidoId);
  }

  async listByEmprendimiento(emprendimientoId, { limite = 100 } = {}) {
    return this.movimientos
      .filter((m) => m.emprendimiento_id === emprendimientoId)
      .slice(0, limite);
  }
}

/**
 * PedidoDao en memoria.
 * Delega el estado de stock en el FakeMovimientoDao inyectado,
 * para que las reglas de idempotencia de la restitución se prueben reales.
 */
export class FakePedidoDao {
  constructor({ movimientoDao } = {}) {
    this.pedidos = [];
    this.items = [];
    this.secuencia = 0;
    this.movimientoDao = movimientoDao;
  }

  async createConItems(cabecera, items) {
    this.secuencia += 1;
    const pedido = { id: `pedido-${this.secuencia}`, ...cabecera };
    this.pedidos.push(pedido);

    for (const item of items) {
      this.items.push({
        id: `item-${this.items.length + 1}`,
        pedido_id: pedido.id,
        producto_id: item.productoId,
        variante_id: item.varianteId ?? null,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.subtotal,
      });
    }

    return pedido;
  }

  async findById(emprendimientoId, id, opciones = {}) {
    const pedido = this.pedidos.find(
      (p) => p.id === id && p.emprendimiento_id === emprendimientoId
    );
    if (!pedido) return null;
    if (opciones.conItems === false) return pedido;
    return { ...pedido, items: this.items.filter((i) => i.pedido_id === id) };
  }

  /**
   * Espejo de PedidoDao.updateEstado: valida la transición contra
   * la misma máquina de estados que usa el DAO real.
   */
  async updateEstado(emprendimientoId, id, nuevoEstado) {
    const pedido = await this.findByIdOrFail(emprendimientoId, id, {
      conItems: false,
    });

    if (pedido.estado === nuevoEstado) return pedido;

    const permitidos = ORDER_STATUS_TRANSITIONS[pedido.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      const { BadRequestError } = await import(
        "../../src/errors/bad-request.error.js"
      );
      throw new BadRequestError(
        `Transicion invalida: ${pedido.estado} -> ${nuevoEstado}`
      );
    }

    pedido.estado = nuevoEstado;
    return pedido;
  }

  async updateEstadoCobro(emprendimientoId, id, estadoCobro) {
    const pedido = await this.findByIdOrFail(emprendimientoId, id, {
      conItems: false,
    });
    pedido.estado_cobro = estadoCobro;
    return pedido;
  }

  async findByIdOrFail(emprendimientoId, id, opciones) {
    const found = await this.findById(emprendimientoId, id, opciones);
    if (!found) {
      const { NotFoundError } = await import(
        "../../src/errors/not-found.error.js"
      );
      throw new NotFoundError(`Pedido ${id} no encontrado`);
    }
    return found;
  }

  async itemsDe(pedidoId) {
    return this.items.filter((i) => i.pedido_id === pedidoId);
  }

  async estadoStock(pedidoId) {
    const movimientos = await this.movimientoDao.listByPedido(pedidoId);
    return {
      reservado: movimientos.some((m) => m.tipo === "RESERVA_PEDIDO"),
      restituido: movimientos.some((m) => m.tipo === "RESTITUCION_CANCELACION"),
    };
  }
}


/** CanalService stub con un unico canal registrado. */
export const buildCanalServiceStub = (canal) => ({
  async resolverPorEvento(evento) {
    if (!canal) {
      const { NotFoundError } = await import(
        "../../src/errors/not-found.error.js"
      );
      throw new NotFoundError(
        `No hay ningun canal ${evento.channelType} con identificador "${evento.externalChannelId}"`
      );
    }
    return canal;
  },
});

/**
 * EventoCanalDao en memoria.
 * Mapea a snake_case igual que el DAO real, para que la clave de
 * idempotencia (canal_id + mensajeria_message_id) se comporte igual.
 */
export class FakeEventoDao {
  constructor() {
    this.eventos = [];
  }

  async create(datos) {
    const row = {
      id: `evento-${this.eventos.length + 1}`,
      canal_id: datos.canalId,
      mensajeria_message_id: datos.mensajeriaMessageId,
      payload_raw: datos.payloadRaw,
      estado_procesamiento: datos.estadoProcesamiento,
      pedido_id: null,
    };
    this.eventos.push(row);
    return row;
  }

  async findByExternalId(canalId, mensajeriaMessageId) {
    return (
      this.eventos.find(
        (e) =>
          e.canal_id === canalId &&
          e.mensajeria_message_id === mensajeriaMessageId
      ) ?? null
    );
  }

  async actualizarEstado(id, estado, pedidoId) {
    const row = this.eventos.find((e) => e.id === id);
    row.estado_procesamiento = estado;
    if (pedidoId) row.pedido_id = pedidoId;
    return row;
  }
}
