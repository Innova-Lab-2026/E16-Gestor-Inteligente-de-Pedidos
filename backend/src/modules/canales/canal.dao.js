import { createSupabaseClient, createSecretClient } from "../../config/database.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { CHANNEL_TYPE, isChannelType } from "../../constants/channel-type.enum.js";

/**
 * Acceso a `canales`.
 *
 * Un canal es la conexión de un emprendimiento con una fuente externa.
 * Es el puente entre "llegó un evento de Telegram" y "esto pertenece al
 * emprendimiento X". No conoce pedidos ni clientes.
 */
export class CanalDao {
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

  async create({ emprendimientoId, tipo, identificadorExterno, nombre, config, activo = true }) {
    if (!isChannelType(tipo)) {
      throw new Error(`Tipo de canal inválido: ${tipo}`);
    }

    const { data, error } = await this.#client()
      .from("canales")
      .insert({
        emprendimiento_id: emprendimientoId,
        tipo,
        identificador_externo: identificadorExterno,
        nombre: nombre ?? null,
        config: config ?? null,
        activo,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listByEmprendimiento(emprendimientoId) {
    const { data, error } = await this.#client()
      .from("canales")
      .select("*")
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async findById(emprendimientoId, id) {
    const { data, error } = await this.#client()
      .from("canales")
      .select("*")
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByIdOrFail(emprendimientoId, id) {
    const canal = await this.findById(emprendimientoId, id);
    if (!canal) throw new NotFoundError(`Canal ${id} no encontrado`);
    return canal;
  }

  /**
   * Resolución del tenant a partir del evento externo.
   * Es el punto clave del aislamiento: `canales.identificador_externo`
   * mapea el id del canal externo al emprendimiento dueño.
   *
   * @param {string} tipo
   * @param {string} identificadorExterno
   * @returns {Promise<object|null>}
   */
  async findByExternal(tipo, identificadorExterno) {
    if (!identificadorExterno) return null;

    const { data, error } = await this.#client()
      .from("canales")
      .select("*")
      .eq("tipo", tipo)
      .eq("identificador_externo", identificadorExterno)
      .eq("activo", true)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async update(emprendimientoId, id, cambios) {
    const { data, error } = await this.#client()
      .from("canales")
      .update(cambios)
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async setActivo(emprendimientoId, id, activo) {
    return this.update(emprendimientoId, id, { activo });
  }
}

export { CHANNEL_TYPE };
export default CanalDao;