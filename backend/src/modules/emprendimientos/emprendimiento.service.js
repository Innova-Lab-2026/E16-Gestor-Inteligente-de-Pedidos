import { NotFoundError } from "../../errors/not-found.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";
import { UsuarioEmprendimientoDao } from "../usuarios/usuario-emprendimiento.dao.js";
import { EmprendimientoDao } from "./emprendimiento.dao.js";

/**
 * Reglas de negocio del tenant.
 *
 * No hay registro publico de emprendimientos: un usuario solo existe si
 * Supabase Auth lo crea, y todo emprendimiento nace junto con el vinculo
 * de su usuario dueno.
 */
export class EmprendimientoService {
  /**
   * @param {{ emprendimientoDao?: EmprendimientoDao, usuarioEmprendimientoDao?: UsuarioEmprendimientoDao, token: string }} deps
   *   `token` es obligatorio: este servicio escribe datos de tenant y
   *   siempre corre con la sesión del usuario (RLS).
   */
  constructor({
    emprendimientoDao,
    usuarioEmprendimientoDao,
    token,
  } = {}) {
    this.emprendimientoDao =
      emprendimientoDao || new EmprendimientoDao(token);
    this.usuarioEmprendimientoDao =
      usuarioEmprendimientoDao ||
      new UsuarioEmprendimientoDao(token);
  }

  /**
   * Crea un emprendimiento y lo vincula al usuario autenticado como dueno.
   *
   * El alta es UNA sola operacion: el DAO delega en la RPC
   * `crear_emprendimiento`, que inserta el emprendimiento y su vinculo en
   * la misma transaccion. Por eso aqui no se hace un `link()` aparte: si se
   * hiciera, el `.insert().select()` del DAO fallaria contra la politica
   * `emp_select` (el vinculo todavia no existe) y, aun si pasara, quedaria
   * un emprendimiento huerfano si el link fallara despues.
   */
  async create({ nombre }) {
    // El dueño lo resuelve la RPC con auth.uid(): no se pasa por
    // parámetro a propósito. Si no hay sesión, la RPC responde 42501 y
    // el error sube tal cual, en vez de crear un tenant huérfano.
    return this.emprendimientoDao.create({ nombre });
  }

  /** Emprendimientos del usuario autenticado. */
  async listMine(usuarioId) {
    if (!usuarioId) throw new BadRequestError("usuarioId es obligatorio");
    return this.usuarioEmprendimientoDao.listByUser(usuarioId);
  }

  async getById(id) {
    return this.emprendimientoDao.findByIdOrFail(id);
  }

  async rename(id, cambios) {
    const current = await this.emprendimientoDao.findById(id);
    if (!current) {
      throw new NotFoundError(`Emprendimiento ${id} no encontrado`);
    }
    // El PATCH va directo a la tabla (no pasa por la RPC, que es la que
    // hace btrim al crear): se normaliza aca para no guardar
    // "  Kiosco  " con espacios. La unicidad global la garantiza el
    // indice `uq_emprendimientos_nombre_normalizado` (migracion 006);
    // si el nombre ya lo usa OTRO emprendimiento, el DAO traduce el
    // 23505 a un ConflictError (409). No se hace "select previo" en
    // este servicio porque corre con RLS y solo veria los
    // emprendimientos del usuario, nunca los de todos.
    const normalizados = { ...cambios };
    if (typeof normalizados.nombre === "string") {
      normalizados.nombre = normalizados.nombre.trim();
    }
    return this.emprendimientoDao.update(id, normalizados);
  }
}

export default EmprendimientoService;
