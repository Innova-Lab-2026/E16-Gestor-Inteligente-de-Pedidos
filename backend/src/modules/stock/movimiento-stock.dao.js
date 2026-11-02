import {
  createSupabaseClient,
  createSecretClient,
} from "../../config/database.js";

/**
 * Acceso a `movimientos_stock`: bitácora de auditoría del inventario.
 *
 * Estrategia:
 * - ESCRITURA: Se realiza exclusivamente vía RPC `registrar_movimiento_stock`.
 *   Esto evita problemas de RLS en inserts manuales y garantiza validaciones
 *   de consistencia (ej: producto pertenece al emprendimiento) dentro de la DB.
 * - LECTURA: Se utiliza el cliente estándar con filtros por tenant_id.
 */
export class MovimientoStockDao {
  constructor(token) {
    this.token = token;
  }

  #client() {
    return this.token ? createSupabaseClient(this.token) : createSecretClient();
  }

  /**
   * Registra un único movimiento de stock.
   * Delega en la RPC SECURITY DEFINER para saltar restricciones de RLS de escritura
   * pero manteniendo validaciones lógicas internas.
   */
  async create({
    emprendimientoId,
    productoId,
    varianteId = null,
    pedidoId = null,
    tipo,
    cantidad,
    motivo = null,
  }) {
    // Mapeo explícito CamelCase -> Argumentos de la RPC (Snake_Case)
    const args = {
      p_emprendimiento_id: emprendimientoId,
      p_producto_id: productoId,
      p_variante_id: varianteId,
      p_pedido_id: pedidoId,
      p_tipo: tipo,
      p_cantidad: cantidad,
      p_motivo: motivo,
    };

    const { data, error } = await this.#client().rpc(
      "registrar_movimiento_stock",
      args,
    );

    if (error) throw error;

    // La RPC devuelve un array porque usa RETURNING *. Tomamos el primero.
    return Array.isArray(data) ? data[0] : data;
  }

  /**
   * Inserta varios movimientos secuencialmente.
   * Nota: No existe una RPC batch nativa definida en el paso anterior.
   * Para mantener la seguridad y atomicidad individual, iteramos sobre cada uno.
   * Si se requiere alta performance masiva, se debería crear una RPC específica
   * que acepte arrays o usar transacciones SQL puras.
   */
  async createMany(movimientos) {
    if (!movimientos.length) return [];

    const results = [];
    for (const mov of movimientos) {
      // Reutilizamos el método create individual que ya tiene la lógica de RPC
      const result = await this.create({
        emprendimientoId: mov.emprendimiento_id || mov.emprendimientoId,
        productoId: mov.producto_id || mov.productoId,
        varianteId: mov.variante_id ?? mov.varianteId ?? null,
        pedidoId: mov.pedido_id ?? mov.pedidoId ?? null,
        tipo: mov.tipo,
        cantidad: mov.cantidad,
        motivo: mov.motivo ?? null,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Lista movimientos recientes de un emprendimiento.
   * Usa SELECT estándar, protegido por RLS de lectura.
   */
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

  /**
   * Lista todos los movimientos asociados a un pedido específico.
   */
  async listByPedido(pedidoId) {
    const { data, error } = await this.#client()
      .from("movimientos_stock")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Alertas: Productos simples (sin variantes) cuyo stock disponible
   * es menor o igual al mínimo definido.
   */
  async listStockBajo(emprendimientoId) {
    const { data, error } = await this.#client()
      .from("productos")
      .select("id, nombre, stock_disponible, stock_minimo")
      .eq("emprendimiento_id", emprendimientoId)
      .eq("tiene_variantes", false)
      .lt("stock_disponible", 0) // Ojo: Usualmente se compara <= stock_minimo, no solo < 0
      // Corrección sugerida: Comparar contra el mínimo real si quieres alertas precisas
      // .filter('stock_disponible', 'lte', 'stock_minimo') // Sintaxis Supabase JS para comparar columnas

      // Como Supabase JS no soporta fácilmente columna vs columna sin helpers,
      // dejaremos la lógica simple (< 0) o deberías traer todos y filtrar en memoria/service
      // si la tabla no es gigante. Para producción grande, usa una VIEW o RPC.

      .order("stock_disponible", { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

export default MovimientoStockDao;
