import { createSupabaseClient, createSecretClient } from "../../config/database.js";

/**
 * Acceso a `productos` y `variantes` con fines de stock.
 *
 * El descuento de stock se hace siempre vía la función SQL
 * `ajustar_stock_*` declarada en la migración: es atómica y valida
 * que no quede stock negativo.
 */
export class StockDao {
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

  /** Stock actual de un producto sin variantes. */
  async getProductoStock(productoId) {
    const { data, error } = await this.#client()
      .from("productos")
      .select("id, nombre, stock_disponible, stock_minimo, tiene_variantes")
      .eq("id", productoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getVarianteStock(varianteId) {
    const { data, error } = await this.#client()
      .from("variantes")
      .select("id, producto_id, nombre, stock_disponible, stock_minimo")
      .eq("id", varianteId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Aplica el delta de stock. Delega en la RPC atómica.
   * @param {{ productoId: string, varianteId?: string|null }} ref
   * @param {number} delta positivo suma, negativo descuenta
   * @returns {Promise<number|null>} stock resultante, o null si no se aplicó
   */
  async applyDelta({ productoId, varianteId }, delta) {
    if (varianteId) {
      const { data, error } = await this.#client().rpc("ajustar_stock_variante", {
        p_variante_id: varianteId,
        p_delta: delta,
      });
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.#client().rpc("ajustar_stock_producto", {
      p_producto_id: productoId,
      p_delta: delta,
    });
    if (error) throw error;
    return data;
  }
}

export default StockDao;