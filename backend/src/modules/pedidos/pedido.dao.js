import { createSupabaseClient, createSecretClient } from "../../config/database.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";
import { ORDER_STATUS_TRANSITIONS } from "../../constants/order-status.enum.js";
import { STOCK_MOVEMENT_TYPE } from "../../constants/processing-status.enum.js";

/**
 * Acceso a `pedidos` e `items_pedido`.
 *
 * `precio_unitario` se congela al crear el item: los cambios de precio
 * del catálogo no alteran los pedidos ya registrados.
 */
export class PedidoDao {
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

  /**
   * @param {object} pedido cabecera ya mapeada a snake_case
   * @param {Array} items items con precio_unitario ya resuelto
   */
  async createConItems(pedido, items) {
    const client = this.#client();

    const { data: pedidoRow, error: pedidoError } = await client
      .from("pedidos")
      .insert(pedido)
      .select()
      .single();

    if (pedidoError) throw pedidoError;

    if (!items.length) return pedidoRow;

    const { data: itemsRows, error: itemsError } = await client
      .from("items_pedido")
      .insert(
        items.map((item) => ({
          pedido_id: pedidoRow.id,
          producto_id: item.productoId,
          variante_id: item.varianteId ?? null,
          cantidad: item.cantidad,
          precio_unitario: item.precioUnitario,
          subtotal: item.subtotal,
        }))
      )
      .select();

    if (itemsError) throw itemsError;

    return { ...pedidoRow, items: itemsRows };
  }

  async findById(emprendimientoId, id, { conItems = true } = {}) {
    const columnas = conItems
      ? "*, items_pedido(*, productos(nombre), variantes(nombre)), clientes(nombre)"
      : "*";

    const { data, error } = await this.#client()
      .from("pedidos")
      .select(columnas)
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    if (conItems && data.items_pedido) {
      const { items_pedido, clientes, ...resto } = data;
      return {
        ...resto,
        items: items_pedido.map((item) => ({
          ...item,
          producto: item.productos ?? null,
          variante: item.variantes ?? null,
        })),
        cliente: clientes ?? null,
      };
    }

    const { items_pedido, clientes, ...resto } = data;
    return { ...resto, cliente: clientes ?? null };
  }

  async findByIdOrFail(emprendimientoId, id, opciones) {
    const pedido = await this.findById(emprendimientoId, id, opciones);
    if (!pedido) throw new NotFoundError(`Pedido ${id} no encontrado`);
    return pedido;
  }

  async list(emprendimientoId, { estado, requiereRevision, limite = 50, offset = 0 } = {}) {
    let query = this.#client()
      .from("pedidos")
      .select("*, clientes(nombre)")
      .eq("emprendimiento_id", emprendimientoId);

    if (estado) query = query.eq("estado", estado);
    if (requiereRevision !== undefined) {
      query = query.eq("requiere_revision", requiereRevision);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limite - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Cambia el estado validando la transición contra la máquina de estados.
   * @returns {Promise<object>} el pedido actualizado
   */
  async updateEstado(emprendimientoId, id, nuevoEstado) {
    const pedido = await this.findById(emprendimientoId, id, { conItems: false });
    if (!pedido) throw new NotFoundError(`Pedido ${id} no encontrado`);

    if (pedido.estado === nuevoEstado) return pedido;

    const permitidos = ORDER_STATUS_TRANSITIONS[pedido.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new BadRequestError(
        `Transición inválida: ${pedido.estado} -> ${nuevoEstado}. Permitido: ${
          permitidos.length ? permitidos.join(", ") : "ninguno (estado terminal)"
        }`
      );
    }

    const { data, error } = await this.#client()
      .from("pedidos")
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateEstadoCobro(emprendimientoId, id, estadoCobro) {
    const { data, error } = await this.#client()
      .from("pedidos")
      .update({ estado_cobro: estadoCobro, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateRevision(emprendimientoId, id, { requiereRevision, observaciones }) {
    const { data, error } = await this.#client()
      .from("pedidos")
      .update({
        requiere_revision: requiereRevision,
        ...(observaciones ? { observaciones } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("emprendimiento_id", emprendimientoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async itemsDe(pedidoId) {
    const { data, error } = await this.#client()
      .from("items_pedido")
      .select("*")
      .eq("pedido_id", pedidoId);
    if (error) throw error;
    return data || [];
  }

  /**
   * Estado del stock de un pedido, para no reservar ni restituir dos veces.
   * @param {string} pedidoId
   */
  async estadoStock(pedidoId) {
    const { data, error } = await this.#client()
      .from("movimientos_stock")
      .select("id, tipo")
      .eq("pedido_id", pedidoId);
    if (error) throw error;

    const tipos = (data || []).map((row) => row.tipo);
    return {
      reservado: tipos.includes(STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO),
      restituido: tipos.includes(STOCK_MOVEMENT_TYPE.RESTITUCION_CANCELACION),
    };
  }

  async eventosDe(pedidoId) {
    const { data, error } = await this.#client()
      .from("eventos_mensajeria")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }
}

export default PedidoDao;