import { ORDER_STATUS } from "../../constants/order-status.enum.js";
import { DashboardDao } from "./dashboard.dao.js";

/**
 * Indicadores del panel. Agrega; no decide nada del dominio.
 */
export class DashboardService {
  constructor({ dashboardDao, token } = {}) {
    this.dashboardDao = dashboardDao || new DashboardDao(token);
  }

  /**
   * @param {string} emprendimientoId
   * @param {{ desde?: string, hasta?: string, fechaDespacho?: string }} [rango]
   */
  async resumen(emprendimientoId, rango = {}) {
    const [pedidos, revisar, ultimos, productos] = await Promise.all([
      this.dashboardDao.pedidosPorEstado(emprendimientoId, rango),
      this.dashboardDao.countPedidosRequiriendoRevision(emprendimientoId, rango),
      this.dashboardDao.ultimosPedidos(emprendimientoId, 10, rango),
      this.dashboardDao.productosParaStock(emprendimientoId),
    ]);

    const porEstado = {};
    for (const estado of Object.values(ORDER_STATUS)) {
      porEstado[estado] = 0;
    }

    let facturado = 0;
    let pendienteCobro = 0;
    let cantidad = 0;
    let unidadesVendidas = 0;
    const ventasPorProducto = new Map();

    for (const pedido of pedidos) {
      porEstado[pedido.estado] = (porEstado[pedido.estado] ?? 0) + 1;
      if (pedido.estado === ORDER_STATUS.CANCELADO) continue;

      cantidad += 1;
      const total = Number(pedido.total ?? 0);
      if (pedido.estado_cobro === "PAGADO") facturado += total;
      else pendienteCobro += total;

      for (const item of pedido.items_pedido ?? []) {
        const productoId = item.producto_id;
        const cantidadItem = Number(item.cantidad ?? 0);
        if (!productoId || !Number.isFinite(cantidadItem) || cantidadItem <= 0) {
          continue;
        }

        unidadesVendidas += cantidadItem;
        const producto = Array.isArray(item.productos)
          ? item.productos[0]
          : item.productos;
        const venta = ventasPorProducto.get(productoId) ?? {
          productoId,
          nombre: producto?.nombre ?? "Producto",
          unidadesVendidas: 0,
          totalVendido: 0,
        };
        venta.unidadesVendidas += cantidadItem;
        const subtotal = Number(item.subtotal ?? 0);
        if (Number.isFinite(subtotal)) venta.totalVendido += subtotal;
        ventasPorProducto.set(productoId, venta);
      }
    }

    const productosBajoStockDetalle = [];
    for (const producto of productos) {
      if (!producto.activo) continue;

      if (producto.tiene_variantes) {
        for (const variante of producto.variantes ?? []) {
          const stockMinimo = variante.stock_minimo ?? producto.stock_minimo ?? 0;
          if (
            !variante.activo ||
            (variante.stock_disponible ?? 0) > stockMinimo
          ) {
            continue;
          }

          productosBajoStockDetalle.push({
            productoId: producto.id,
            varianteId: variante.id,
            nombre: `${producto.nombre ?? "Producto"} — ${variante.nombre ?? "Variante"}`,
            stockDisponible: variante.stock_disponible ?? 0,
          });
        }
      } else if (
        (producto.stock_disponible ?? 0) <= (producto.stock_minimo ?? 0)
      ) {
        productosBajoStockDetalle.push({
          productoId: producto.id,
          varianteId: null,
          nombre: producto.nombre ?? "Producto",
          stockDisponible: producto.stock_disponible ?? 0,
        });
      }
    }
    const productosBajoStock = productosBajoStockDetalle.length;

    const productosMasVendidos = [...ventasPorProducto.values()].sort(
      (a, b) =>
        b.unidadesVendidas - a.unidadesVendidas ||
        a.nombre.localeCompare(b.nombre, "es"),
    ).map((producto) => ({
      ...producto,
      totalVendido: Number(producto.totalVendido.toFixed(2)),
    }));

    return {
      cantidadPedidos: cantidad,
      porEstado,
      facturado: Number(facturado.toFixed(2)),
      pendienteCobro: Number(pendienteCobro.toFixed(2)),
      pedidosRequiriendoRevision: revisar,
      ultimosPedidos: ultimos,
      productosMasVendidos,
      unidadesVendidas,
      productosBajoStock,
      productosBajoStockDetalle,
    };
  }
}

export default DashboardService;