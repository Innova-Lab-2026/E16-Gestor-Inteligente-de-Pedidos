import { createSupabaseClient, createSecretClient } from "../../config/database.js";

/**
 * Acceso a `movimientos_stock`: bitácora de auditoría del inventario.
 * Nunca se modifica ni se borra un movimiento.
 */
export class MovimientoStockDao {
  constructor(token) {
    this.token = token;
  }

  #client() {
    // Unico lugar del backend que usa la clave secreta: un webhook llega
    // de Telegram/Meta, sin JWT, asi que RLS no tiene identidad que
    // evaluar. El emprendimiento sale del canal registrado
    // (canales.identificador_externo), nunca de un dato del request; los
    // DAOs filtran siempre por ese id. Todo otro flujo llega con token.
    return this.token
      ? createSupabaseClient(this.token)
      : createSecretClient();
  }

  async create({
    emprendimientoId,
    productoId,
    varianteId = null,
    pedidoId = null,
    tipo,
    cantidad,
    motivo = null,
  }) {
    const { data, error } = await this.#client()
      .from("movimientos_stock")
      .insert({
        emprendimiento_id: emprendimientoId,
        producto_id: productoId,
        variante_id: varianteId,
        pedido_id: pedidoId,
        tipo,
        cantidad,
        motivo,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Inserta varios movimientos (usado tras una reserva de pedido). */
  async createMany(movimientos) {
    if (!movimientos.length) return [];
    const { data, error } = await this.#client()
      .from("movimientos_stock")
      .insert(movimientos)
      .select();
    if (error) throw error;
    return data || [];
  }

  async listByEmprendimiento(emprendimientoId, { limite = 100 } = {}) {
    const { data, error } = await this.#client()
      .from("movimientos_stock")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data || [];
  }

  async listByPedido(pedidoId) {
    const { data, error } = await this.#client()
      .from("movimientos_stock")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /** Productos por debajo del stock mínimo. */
  async listStockBajo(emprendimientoId) {
    const { data, error } = await this.#client()
      .from("productos")
      .select("id, nombre, stock_disponible, stock_minimo")
      .eq("emprendimiento_id", emprendimientoId)
      .eq("tiene_variantes", false)
      .lte("stock_disponible", 0);
    if (error) throw error;
    return data || [];
  }
}

export default MovimientoStockDao;