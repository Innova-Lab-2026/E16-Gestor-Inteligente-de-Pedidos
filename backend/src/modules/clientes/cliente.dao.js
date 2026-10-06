import { createSupabaseClient, createSecretClient } from "../../config/database.js";

/**
 * Acceso a la tabla `clientes`.
 * Todos los métodos exigen `emprendimientoId`: el aislamiento es
 * responsabilidad del DAO, no del controller.
 */
export class ClienteDao {
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

  async create({ emprendimientoId, nombre, telefono, direccion, observaciones }) {
    const { data, error } = await this.#client()
      .from("clientes")
      .insert({
        emprendimiento_id: emprendimientoId,
        nombre,
        telefono: telefono ?? null,
        direccion: direccion ?? null,
        observaciones: observaciones ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listByEmprendimiento(emprendimientoId) {
    const { data, error } = await this.#client()
      .from("clientes")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async findById(emprendimientoId, id) {
    const { data, error } = await this.#client()
      .from("clientes")
      .select("*")
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Búsqueda por teléfono. Se usa al resolver el cliente de un pedido
   * que llega por canal externo.
   */
  async findByPhone(emprendimientoId, telefono) {
    if (!telefono) return null;
    const { data, error } = await this.#client()
      .from("clientes")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .eq("telefono", telefono)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async update(emprendimientoId, id, cambios) {
    const { data, error } = await this.#client()
      .from("clientes")
      .update(cambios)
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export default ClienteDao;