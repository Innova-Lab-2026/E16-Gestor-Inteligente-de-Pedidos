import { createSupabaseClient, createSecretClient } from "../../config/database.js";
import { PROCESSING_STATUS } from "../../constants/processing-status.enum.js";

/**
 * Acceso a `eventos_mensajeria`.
 *
 * La unicidad de (canal_id, mensajeria_message_id) garantiza la
 * idempotencia: un evento repetido no vuelve a generar un pedido ni a
 * modificar el stock.
 */
export class EventoCanalDao {
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
    canalId,
    mensajeriaMessageId,
    payloadRaw,
    estadoProcesamiento,
    pedidoId = null,
  }) {
    const { data, error } = await this.#client()
      .from("eventos_mensajeria")
      .insert({
        canal_id: canalId,
        mensajeria_message_id: mensajeriaMessageId,
        payload_raw: payloadRaw ?? null,
        estado_procesamiento: estadoProcesamiento,
        pedido_id: pedidoId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Busca un evento previo por la clave de idempotencia.
   * @returns {Promise<object|null>}
   */
  async findByExternalId(canalId, mensajeriaMessageId) {
    const { data, error } = await this.#client()
      .from("eventos_mensajeria")
      .select("*")
      .eq("canal_id", canalId)
      .eq("mensajeria_message_id", mensajeriaMessageId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async actualizarEstado(id, estadoProcesamiento, pedidoId) {
    const { data, error } = await this.#client()
      .from("eventos_mensajeria")
      .update({
        estado_procesamiento: estadoProcesamiento,
        ...(pedidoId ? { pedido_id: pedidoId } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listByCanal(canalId, { limite = 50 } = {}) {
    const { data, error } = await this.#client()
      .from("eventos_mensajeria")
      .select("*")
      .eq("canal_id", canalId)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (error) throw error;
    return data || [];
  }

  async countByEstado(canalId) {
    const { data, error } = await this.#client()
      .from("eventos_mensajeria")
      .select("estado_procesamiento")
      .eq("canal_id", canalId);

    if (error) throw error;

    return (data || []).reduce((acc, row) => {
      acc[row.estado_procesamiento] = (acc[row.estado_procesamiento] ?? 0) + 1;
      return acc;
    }, { [PROCESSING_STATUS.PROCESADO]: 0, [PROCESSING_STATUS.ERROR]: 0, [PROCESSING_STATUS.REVISION_REQUERIDA]: 0 });
  }
}

export default EventoCanalDao;