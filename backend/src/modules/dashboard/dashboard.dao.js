import { createSupabaseClient } from "../../config/database.js";

function dateInArgentina(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function and(filters) {
  return filters.length === 1 ? filters[0] : `and(${filters.join(",")})`;
}

export function buildPeriodoPedidosFilter({ desde, hasta } = {}) {
  if (!desde && !hasta) return null;

  const filtrosEntrega = [];
  const filtrosCreacion = ["fecha_prevista_entrega.is.null"];

  if (desde) {
    const inicio = new Date(desde).toISOString();
    filtrosEntrega.push(`fecha_prevista_entrega.gte.${dateInArgentina(inicio)}`);
    filtrosCreacion.push(`created_at.gte.${inicio}`);
  }
  if (hasta) {
    const fin = new Date(hasta).toISOString();
    filtrosEntrega.push(`fecha_prevista_entrega.lte.${dateInArgentina(fin)}`);
    filtrosCreacion.push(`created_at.lte.${fin}`);
  }

  return `${and(filtrosEntrega)},${and(filtrosCreacion)}`;
}

function aplicarFiltroPeriodo(query, rango = {}) {
  if (rango.fechaDespacho) {
    return query.eq("fecha_prevista_entrega", rango.fechaDespacho);
  }
  const filtroPeriodo = buildPeriodoPedidosFilter(rango);
  return filtroPeriodo ? query.or(filtroPeriodo) : query;
}

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

  async pedidosPorEstado(emprendimientoId, rango = {}) {
    let query = this.#client()
      .from("pedidos")
      .select(
        "estado, total, estado_cobro, created_at, items_pedido(cantidad, producto_id, subtotal, productos(nombre))",
      )
      .eq("emprendimiento_id", emprendimientoId);
    query = aplicarFiltroPeriodo(query, rango);

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
    rango = {},
  ) {
    let query = this.#client()
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("emprendimiento_id", emprendimientoId)
      .eq("requiere_revision", true);
    query = aplicarFiltroPeriodo(query, rango);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async ultimosPedidos(emprendimientoId, limite = 10, rango = {}) {
    let query = this.#client()
      .from("pedidos")
      .select(
        "id, estado, estado_cobro, total, created_at, clientes(id, nombre, apellido, telefono, direccion, email)",
      )
      .eq("emprendimiento_id", emprendimientoId)
      .order("created_at", { ascending: false });
    query = aplicarFiltroPeriodo(query, rango);

    const { data, error } = await query.limit(limite);
    if (error) throw error;
    return (data || []).map(({ clientes, ...pedido }) => ({
      ...pedido,
      cliente: clientes ?? null,
    }));
  }
}

export default DashboardDao;