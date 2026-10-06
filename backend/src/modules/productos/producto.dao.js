import { createSupabaseClient, createSecretClient } from "../../config/database.js";

/**
 * Acceso a la tabla `productos`.
 */
export class ProductoDao {
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
    nombre,
    descripcion,
    precio,
    tieneVariantes,
    stockDisponible,
    stockMinimo,
    identificadorExterno,
  }) {
    const payload = {
      emprendimiento_id: emprendimientoId,
      nombre,
      descripcion: descripcion ?? null,
      precio,
      tiene_variantes: Boolean(tieneVariantes),
      // Con variantes el stock vive en cada variante, no en el producto.
      stock_disponible: tieneVariantes ? null : (stockDisponible ?? 0),
      stock_minimo: stockMinimo ?? 0,
      identificador_externo: identificadorExterno ?? null,
    };

    const { data, error } = await this.#client()
      .from("productos")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listByEmprendimiento(emprendimientoId, { soloActivos = true } = {}) {
    let query = this.#client()
      .from("productos")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId);

    if (soloActivos) query = query.eq("activo", true);

    const { data, error } = await query.order("nombre", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async findById(emprendimientoId, id) {
    const { data, error } = await this.#client()
      .from("productos")
      .select("*")
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Búsqueda por identificador externo (canales). No es obligatorio. */
  async findByIdentificadorExterno(emprendimientoId, identificador) {
    if (!identificador) return null;
    const { data, error } = await this.#client()
      .from("productos")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .eq("identificador_externo", identificador)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Búsqueda tolerante por nombre, usada al interpretar un mensaje. */
  async searchByName(emprendimientoId, texto, limite = 5) {
    const { data, error } = await this.#client()
      .from("productos")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .eq("activo", true)
      .ilike("nombre", `%${texto}%`)
      .limit(limite);
    if (error) throw error;
    return data || [];
  }

  async update(emprendimientoId, id, cambios) {
    const { data, error } = await this.#client()
      .from("productos")
      .update(cambios)
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export default ProductoDao;