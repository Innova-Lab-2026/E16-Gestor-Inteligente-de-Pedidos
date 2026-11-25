import { createSupabaseClient } from "../../config/database.js";

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

  async pedidosPorEstado(
    emprendimientoId,
    { desde, hasta, fechaDespacho } = {},
  ) {
    let query = this.#client()
      .from("pedidos")
      .select(
        "estado, total, estado_cobro, created_at, items_pedido(cantidad, producto_id, subtotal, productos(nombre))",
      )
      .eq("emprendimiento_id", emprendimientoId);

    if (fechaDespacho) {
      query = query.eq("fecha_prevista_entrega", fechaDespacho);
    } else {
      if (desde) query = query.gte("created_at", desde);
      if (hasta) query = query.lte("created_at", hasta);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async productosParaStock(emprendimientoId) {
    const { data, error } = await this.#client()
      .from("productos")
      .select(
        "activo, tiene_variantes, stock_disponible, stock_minimo, variantes(activo, stock_disponible, stock_minimo)",
      )
      .eq("emprendimiento_id", emprendimientoId)
      .eq("activo", true);
    if (error) throw error;
    return data || [];
  }

  async countPedidosRequiriendoRevision(
    emprendimientoId,
    { fechaDespacho } = {},
  ) {
    let query = this.#client()
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("emprendimiento_id", emprendimientoId)
      .eq("requiere_revision", true);
    if (fechaDespacho) {
      query = query.eq("fecha_prevista_entrega", fechaDespacho);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async ultimosPedidos(emprendimientoId, limite = 10, { fechaDespacho } = {}) {
    let query = this.#client()
      .from("pedidos")
      .select("id, estado, estado_cobro, total, created_at, clientes(nombre)")
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: false });
    if (fechaDespacho) {
      query = query.eq("fecha_prevista_entrega", fechaDespacho);
    }

    const { data, error } = await query.limit(limite);
    if (error) throw error;
    return data || [];
  }
}

export default DashboardDao;