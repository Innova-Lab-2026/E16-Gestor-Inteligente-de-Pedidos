import { createSupabaseClient } from "../../config/database.js";
import { ORDER_STATUS } from "../../constants/order-status.enum.js";

/**
 * Agregaciones para el panel del emprendedor.
 * Sólo lectura; no contiene reglas de negocio.
 */
export class DashboardDao {
  constructor(token) {
    this.token = token;
  }

  // Sin fallback a la clave secreta: el dashboard agrega datos de tenant
  // y todo su camino tiene que pasar por RLS. Va siempre detras de
  // authMiddleware + tenantMiddleware, asi que el token nunca falta; si
  // faltara, es correcto que la llamada falle.
  #client() {
    return createSupabaseClient(this.token);
  }

  async pedidosPorEstado(emprendimientoId, { desde, hasta } = {}) {
    let query = this.#client()
      .from("pedidos")
      .select("estado, total, estado_cobro, created_at")
      .eq("emprendimiento_id", emprendimientoId)
      .neq("estado", ORDER_STATUS.CANCELADO);

    if (desde) query = query.gte("created_at", desde);
    if (hasta) query = query.lte("created_at", hasta);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async countPedidosRequiriendoRevision(emprendimientoId) {
    const { count, error } = await this.#client()
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("emprendimiento_id", emprendimientoId)
      .eq("requiere_revision", true);
    if (error) throw error;
    return count ?? 0;
  }

  async ultimosPedidos(emprendimientoId, limite = 10) {
    const { data, error } = await this.#client()
      .from("pedidos")
      .select("id, estado, estado_cobro, total, created_at, clientes(nombre)")
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data || [];
  }
}

export default DashboardDao;