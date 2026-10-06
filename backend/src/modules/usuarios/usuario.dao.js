import { createSupabaseClient } from "../../config/database.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { ForbiddenError } from "../../errors/forbidden.error.js";

/**
 * Acceso a la tabla `usuarios` (perfil espejo de Supabase Auth).
 *
 * La relacion N:M con emprendimientos vive en
 * usuario-emprendimiento.dao.js, que la usa el middleware de tenant.
 */
export class UsuarioDao {
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
   * Asegura el perfil espejo de Supabase Auth.
   *
   * El camino normal no pasa por acá: el trigger
   * `on_auth_user_created` de la 001 inserta la fila dentro de la misma
   * transacción de `auth.users`, así que el espejo no depende de que el
   * backend se acuerde. Este método queda para reparar el caso borde
   * (cuentas creadas antes de que existiera el trigger).
   *
   * Es `ON CONFLICT DO NOTHING` y no un UPSERT a propósito: un UPSERT
   * necesita política de UPDATE, y `usuarios` sólo tiene políticas de
   * SELECT e INSERT (cada quien ve y crea su propia fila).
   */
  async create({ id, email }) {
    const { error } = await this.#client()
      .from("usuarios")
      .upsert({ id, email }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    return this.findById(id);
  }

  async findById(id) {
    const { data, error } = await this.#client()
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByEmail(email) {
    const { data, error } = await this.#client()
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Perfil del usuario validando que el JWT corresponda al id solicitado.
   * @param {string} id
   */
  async findOwn(id) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundError(`Usuario ${id} no encontrado`);

    if (this.token) {
      const { data, error } = await createSupabaseClient(this.token).auth.getUser(
        this.token
      );
      if (error || data?.user?.id !== id) {
        throw new ForbiddenError(
          "No tenes autorizacion para acceder a los datos de este usuario"
        );
      }
    }

    return user;
  }
}

export default UsuarioDao;
