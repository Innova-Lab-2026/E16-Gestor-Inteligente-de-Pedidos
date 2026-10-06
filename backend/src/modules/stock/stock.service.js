import { BadRequestError } from "../../errors/bad-request.error.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import {
  STOCK_MOVEMENT_TYPE,
  STOCK_MOVEMENT_SIGN,
} from "../../constants/processing-status.enum.js";
import { StockDao } from "./stock.dao.js";
import { MovimientoStockDao } from "./movimiento-stock.dao.js";

/**
 * Servicio de stock.
 *
 * Responsabilidad de negocio independiente del origen del pedido: para
 * stock, un pedido de Telegram y uno manual son exactamente lo mismo.
 */
export class StockService {
  /**
   * @param {{ stockDao?: StockDao, movimientoStockDao?: MovimientoStockDao, token?: string }} [deps]
   */
  constructor({ stockDao, movimientoStockDao, token } = {}) {
    this.stockDao = stockDao || new StockDao(token);
    this.movimientoStockDao =
      movimientoStockDao || new MovimientoStockDao(token);
  }

  /**
   * Normaliza el signo de la cantidad según el tipo de movimiento.
   * CORRECCION_MANUAL respeta el signo enviado.
   * @param {string} tipo
   * @param {number} cantidad magnitud (el signo lo define el tipo)
   */
  static signedQuantity(tipo, cantidad) {
    if (tipo === STOCK_MOVEMENT_TYPE.CORRECCION_MANUAL) return cantidad;
    return STOCK_MOVEMENT_SIGN[tipo] * cantidad;
  }

  /**
   * Valida disponibilidad sin descontar.
   * @param {{ productoId: string, varianteId?: string|null, cantidad: number }} ref
   */
  async checkAvailability({ productoId, varianteId = null, cantidad }) {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestError("La cantidad debe ser un entero mayor a 0");
    }

    const actual = varianteId
      ? await this.stockDao.getVarianteStock(varianteId)
      : await this.stockDao.getProductoStock(productoId);

    if (!actual) {
      throw new NotFoundError(
        varianteId
          ? `Variante ${varianteId} no encontrada`
          : `Producto ${productoId} no encontrado`
      );
    }

    return {
      suficiente: (actual.stock_disponible ?? 0) >= cantidad,
      disponible: actual.stock_disponible ?? 0,
      minimo: actual.stock_minimo ?? 0,
      referencia: actual,
    };
  }

  /**
   * Aplica un movimiento de stock y deja constancia en `movimientos_stock`.
   *
   * @param {object} params
   * @param {string} params.emprendimientoId
   * @param {string} params.productoId
   * @param {string|null} [params.varianteId]
   * @param {string|null} [params.pedidoId]
   * @param {string} params.tipo uno de STOCK_MOVEMENT_TYPE
   * @param {number} params.cantidad magnitud (el signo lo define el tipo)
   * @param {string} [params.motivo]
   * @returns {Promise<{ stockResultante: number, movimiento: object }>}
   */
  async move({
    emprendimientoId,
    productoId,
    varianteId = null,
    pedidoId = null,
    tipo,
    cantidad,
    motivo = null,
  }) {
    if (!Object.values(STOCK_MOVEMENT_TYPE).includes(tipo)) {
      throw new BadRequestError(`Tipo de movimiento inválido: ${tipo}`);
    }

    const delta = StockService.signedQuantity(tipo, cantidad);
    if (delta === 0) {
      throw new BadRequestError("La cantidad del movimiento no puede ser 0");
    }

    const stockResultante = await this.stockDao.applyDelta(
      { productoId, varianteId },
      delta
    );

    // La RPC devuelve NULL cuando no había stock suficiente: en ese caso
    // no se registra movimiento, para no dejar la bitácora inconsistente.
    if (stockResultante === null || stockResultante === undefined) {
      throw new BadRequestError(
        `Stock insuficiente para el producto ${productoId}` +
          (varianteId ? ` (variante ${varianteId})` : "") +
          `: se requieren ${Math.abs(delta)} unidades`
      );
    }

    const movimiento = await this.movimientoStockDao.create({
      emprendimiento_id: emprendimientoId,
      producto_id: productoId,
      variante_id: varianteId,
      pedido_id: pedidoId,
      tipo,
      cantidad: delta,
      motivo,
    });

    return { stockResultante, movimiento };
  }

  /**
   * Reserva stock por los items de un pedido y registra los movimientos.
   * Debe invocarse dentro de la misma transacción que crea el pedido.
   * @param {{ emprendimientoId: string, pedidoId: string, items: Array, motivo?: string }} params
   */
  async reservarPedido({ emprendimientoId, pedidoId, items, motivo }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("El pedido no tiene items para reservar");
    }

    const movimientos = [];
    for (const item of items) {
      const { movimiento } = await this.move({
        emprendimientoId,
        productoId: item.productoId,
        varianteId: item.varianteId ?? null,
        pedidoId,
        tipo: STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO,
        cantidad: item.cantidad,
        motivo: motivo ?? `Reserva del pedido ${pedidoId}`,
      });
      movimientos.push(movimiento);
    }

    return movimientos;
  }

  /**
   * Devuelve el stock de un pedido cancelado. Un pedido sólo se
   * restituye una vez: la idempotencia la controla PedidoService
   * verificando que no existan movimientos previos de restitución.
   */
  async restituirPedido({ emprendimientoId, pedidoId, items, motivo }) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const movimientos = [];
    for (const item of items) {
      const { movimiento } = await this.move({
        emprendimientoId,
        productoId: item.productoId,
        varianteId: item.varianteId ?? null,
        pedidoId,
        tipo: STOCK_MOVEMENT_TYPE.RESTITUCION_CANCELACION,
        cantidad: item.cantidad,
        motivo: motivo ?? `Restitución del pedido ${pedidoId}`,
      });
      movimientos.push(movimiento);
    }

    return movimientos;
  }

  /** Reposición, producción, pérdida o corrección manual. */
  async ajustarManual({
    emprendimientoId,
    productoId,
    varianteId = null,
    tipo,
    cantidad,
    motivo,
  }) {
    if (tipo === STOCK_MOVEMENT_TYPE.CORRECCION_MANUAL && !cantidad) {
      throw new BadRequestError(
        "Una corrección manual requiere la cantidad con signo a aplicar"
      );
    }

    return this.move({
      emprendimientoId,
      productoId,
      varianteId,
      tipo,
      cantidad,
      motivo,
    });
  }

  async movimientosDePedido(pedidoId) {
    return this.movimientoStockDao.listByPedido(pedidoId);
  }

  async ultimosMovimientos(emprendimientoId, limite = 100) {
    return this.movimientoStockDao.listByEmprendimiento(
      emprendimientoId,
      { limite }
    );
  }
}

export default StockService;
