// modules/productos/producto.dao.js
import {
  createSupabaseClient,
  createSecretClient,
} from "../../config/database.js";

export class ProductoDao {
  constructor(token) {
    this.token = token;
  }

  #client() {
    return this.token ? createSupabaseClient(this.token) : createSecretClient();
  }

  async create(data) {
    const payload = {
      emprendimiento_id: data.emprendimientoId,
      nombre: data.nombre,
      descripcion: data.descripcion,
      precio: data.precio,
      activo: data.activo,
      tiene_variantes: data.tiene_variantes,
      stock_disponible: data.stock_disponible,
      stock_minimo: data.stock_minimo,
      identificador_externo: data.identificador_externo,
      sku_o_identificador: data.sku_o_identificador,
    };

    const { data: result, error } = await this.#client()
      .from("productos")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return result;
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
    // cambios vienen en snake_case desde el Controller/Service
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
