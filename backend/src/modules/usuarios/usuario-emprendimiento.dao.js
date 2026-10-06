import { createSupabaseClient } from "../../config/database.js";
import { BadRequestError } from "../../errors/bad-request.error.js";

/**
 * Acceso a la relación N:M usuario ↔ emprendimiento.
 * Se expone en su propio archivo porque la resuelve el middleware de tenant
 * y los servicios de alta, no el módulo de usuarios.
 */
export class UsuarioEmprendimientoDao {
  /**
   * @param {string} token JWT del usuario (RLS).
   */
  constructor(token) {
    this.token = token;
  }

  #client() {
    // Exige el JWT del usuario: este DAO no puede saltarse RLS, a
    // proposito. Sin token auth.uid() es NULL, todas las politicas
    // rechazan la fila y la operacion falla ruidosamente. El alta de
    // usuario ya no es una excepcion: el registro corre con el token
    // que devuelve signUp.
    return createSupabaseClient(this.token);
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<Array<{emprendimiento_id: string, nombre: string|null, created_at: string}>>}
   */
  async listByUser(usuarioId) {
    if (!usuarioId) throw new BadRequestError("usuarioId es obligatorio");

    const { data, error } = await this.#client()
      .from("usuarios_emprendimientos")
      .select("emprendimiento_id, created_at, emprendimientos(nombre)")
      .eq("usuario_id", usuarioId);

    if (error) throw error;

    return (data || []).map((row) => ({
      emprendimiento_id: row.emprendimiento_id,
      nombre: row.emprendimientos?.nombre ?? null,
      created_at: row.created_at,
    }));
  }

  async findAccess(usuarioId, emprendimientoId) {
    if (!emprendimientoId) {
      throw new BadRequestError("emprendimientoId es obligatorio");
    }
    const rows = await this.listByUser(usuarioId);
    return (
      rows.find((row) => row.emprendimiento_id === emprendimientoId) || null
    );
  }

  async link({ usuarioId, emprendimientoId }) {
    const { data, error } = await this.#client()
      .from("usuarios_emprendimientos")
      .insert({ usuario_id: usuarioId, emprendimiento_id: emprendimientoId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async unlink({ usuarioId, emprendimientoId }) {
    const { data, error } = await this.#client()
      .from("usuarios_emprendimientos")
      .delete()
      .eq("usuario_id", usuarioId)
      .eq("emprendimiento_id", emprendimientoId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new BadRequestError(
        "El usuario no está vinculado a ese emprendimiento"
      );
    }
    return data[0];
  }
}

export default UsuarioEmprendimientoDao;