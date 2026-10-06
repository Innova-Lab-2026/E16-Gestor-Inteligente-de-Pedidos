import { createSupabaseClient, createSecretClient } from "../../config/database.js";
import { NotFoundError } from "../../errors/not-found.error.js";

/**
 * Acceso a la tabla `variantes`.
 *
 * Cada variante administra su propio stock. No lleva
 * `emprendimiento_id`: el aislamiento se hereda del producto padre.
 */
export class VarianteDao {
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

  async create({ productoId, nombre, stockDisponible = 0, stockMinimo = 0, activo = true }) {
    const { data, error } = await this.#client()
      .from("variantes")
      .insert({
        producto_id: productoId,
        nombre,
        stock_disponible: stockDisponible,
        stock_minimo: stockMinimo,
        activo,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listByProducto(productoId) {
    const { data, error } = await this.#client()
      .from("variantes")
      .select("*")
      .eq("producto_id", productoId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async findById(id) {
    const { data, error } = await this.#client()
      .from("variantes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByIdOrFail(id) {
    const variante = await this.findById(id);
    if (!variante) throw new NotFoundError(`Variante ${id} no encontrada`);
    return variante;
  }

  /** Busca la variante cuyo nombre coincida (talle/color). */
  async findByNombre(productoId, nombre) {
    const { data, error } = await this.#client()
      .from("variantes")
      .select("*")
      .eq("producto_id", productoId)
      .ilike("nombre", `%${nombre}%`)
      .limit(2);
    if (error) throw error;
    return data || [];
  }

  async update(id, cambios) {
    const { data, error } = await this.#client()
      .from("variantes")
      .update(cambios)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Descuento/aumento atómico del stock. La condición `gte` impide
   * dejar el stock en negativo ante concurrencia.
   * @returns {Promise<object|null>} la variante actualizada, o null si no había stock
   */
  async adjustStock(id, delta, { stockMinimo } = {}) {
    // Se resuelve con una RPC atómica declarada en la migración:
    // ajustar_stock_variante. Sin esa RPC no hay garantía de atomicidad.
    // ni de no dejar el stock en negativo ante concurrencia.
    const { data, error } = await this.#client().rpc("ajustar_stock_variante", {
      p_variante_id: id,
      p_delta: delta,
      p_stock_minimo: stockMinimo ?? null,
    });
    if (error) throw error;
    return data;
  }
}

export default VarianteDao;
