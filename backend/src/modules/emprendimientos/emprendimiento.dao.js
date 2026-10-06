import { createSupabaseClient } from "../../config/database.js";
import { ConflictError } from "../../errors/conflict.error.js";
import { NotFoundError } from "../../errors/not-found.error.js";

/**
 * Acceso a la tabla `emprendimientos` (tenant raíz).
 *
 * Unicidad del nombre (global, normalizada): la garantiza el indice
 * `uq_emprendimientos_nombre_normalizado` (migracion 006) sobre
 * `lower(btrim(nombre))`, y la RPC `crear_emprendimiento` la chequea
 * antes de insertar para dar un mensaje limpio. Aca solo se traduce
 * el 23505 a un ConflictError (409): un "select previo" desde este DAO
 * no serviria porque corre con RLS y solo ve los emprendimientos del
 * usuario, nunca los de todos.
 */
export class EmprendimientoDao {
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
   * Crea el emprendimiento YA vinculado a su dueño.
   *
   * El dueño es SIEMPRE `auth.uid()`: la RPC lo toma de la sesión y
   * no acepta que se lo pasen por parámetro, así que no hay forma de
   * crear un tenant a nombre de otro usuario.
   *
   * Delega en la RPC `crear_emprendimiento` en vez de hacer
   * `.insert().select()` por dos motivos:
   *
   * 1. Con `.insert().select()` PostgREST emite INSERT ... RETURNING, y el
   *    RETURNING tambien pasa por la política `emp_select`, que busca el
   *    vinculo en usuarios_emprendimientos. Ese vinculo todavia no existe
   *    durante el INSERT, asi que la fila recien creada es invisible para
   *    su propia politica de SELECT y Postgres responde
   *    "new row violates row-level security policy for table
   *    \"emprendimientos\"". Es un problema de orden, no de permisos.
   *
   * 2. La RPC inserta el emprendimiento y el vinculo en la misma
   *    transaccion: no queda un emprendimiento huerfano si el link falla.
   */
  async create({ nombre }) {
    const { data, error } = await this.#client().rpc("crear_emprendimiento", {
      p_nombre: nombre,
    });
    if (error) throw mapNombreDuplicado(error, nombre);
    return data;
  }

  async findById(id) {
    const { data, error } = await this.#client()
      .from("emprendimientos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByIdOrFail(id) {
    const row = await this.findById(id);
    if (!row) throw new NotFoundError(`Emprendimiento ${id} no encontrado`);
    return row;
  }

  async update(id, cambios) {
    const { data, error } = await this.#client()
      .from("emprendimientos")
      .update(cambios)
      .eq("id", id)
      .select()
      .single();
    if (error) throw mapNombreDuplicado(error, cambios?.nombre);
    return data;
  }

  async list() {
    const { data, error } = await this.#client()
      .from("emprendimientos")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }
}

/**
 * Traduce la violacion del indice unico de nombre a un 409 con mensaje
 * de dominio. PostgREST/Supabase expone el codigo SQLSTATE en
 * `error.code` ("23505") cuando choca contra
 * `uq_emprendimientos_nombre_normalizado`; la RPC, ademas, levanta el
 * mismo codigo con mensaje propio. Cualquier otro error sube tal cual.
 *
 * Se exporta para poder probarlo sin mockear el cliente Supabase
 * (el `#client()` privado no es interceptable desde afuera).
 */
export const mapNombreDuplicado = (error, nombre) => {
  if (error?.code === "23505") {
    const etiqueta = String(nombre ?? "").trim();
    return new ConflictError(
      etiqueta
        ? `Ya existe un emprendimiento con el nombre "${etiqueta}"`
        : "Ya existe un emprendimiento con ese nombre",
      { nombre: etiqueta || undefined }
    );
  }
  return error;
};

export default EmprendimientoDao;