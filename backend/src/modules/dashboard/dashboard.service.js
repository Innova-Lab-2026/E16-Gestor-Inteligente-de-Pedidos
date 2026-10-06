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
   * @param {{ desde?: string, hasta?: string }} [rango]
   */
  async resumen(emprendimientoId, rango = {}) {
    const [pedidos, revisar, ultimos] = await Promise.all([
      this.dashboardDao.pedidosPorEstado(emprendimientoId, rango),
      this.dashboardDao.countPedidosRequiriendoRevision(emprendimientoId),
      this.dashboardDao.ultimosPedidos(emprendimientoId),
    ]);

    const porEstado = {};
    for (const estado of Object.values(ORDER_STATUS)) {
      porEstado[estado] = 0;
    }

    let facturado = 0;
    let pendienteCobro = 0;
    let cantidad = 0;

    for (const pedido of pedidos) {
      porEstado[pedido.estado] = (porEstado[pedido.estado] ?? 0) + 1;
      cantidad += 1;
      const total = Number(pedido.total ?? 0);
      if (pedido.estado_cobro === "PAGADO") facturado += total;
      else pendienteCobro += total;
    }

    return {
      cantidadPedidos: cantidad,
      porEstado,
      facturado: Number(facturado.toFixed(2)),
      pendienteCobro: Number(pendienteCobro.toFixed(2)),
      pedidosRequiriendoRevision: revisar,
      ultimosPedidos: ultimos,
    };
  }
}

export default DashboardService;