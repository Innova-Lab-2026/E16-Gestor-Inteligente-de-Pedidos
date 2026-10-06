import { UnauthorizedError } from "../errors/unauthorized.error.js";
import { BadRequestError } from "../errors/bad-request.error.js";
import { UnverifiedTenantError } from "../errors/unverified-tenant.error.js";
import { UsuarioEmprendimientoDao } from "../modules/usuarios/usuario-emprendimiento.dao.js";

/**
 * Resuelve el tenant (emprendimiento) y lo inyecta en `req.tenant`.
 *
 * No confía ciegamente en el valor enviado por el cliente: el
 * emprendimientoId se valida contra usuarios_emprendimientos.
 *
 * Fuentes admitidas, en este orden:
 *   1. `x-emprendimiento-id` (header)
 *   2. `emprendimientoId` (query o body)
 *
 * Si el usuario tiene un único emprendimiento se resuelve ese,
 * sin necesidad de enviarlo explícitamente.
 *
 * @param {import('../modules/usuarios/usuario-emprendimiento.dao.js').UsuarioEmprendimientoDao|Function} [daoOrFactory]
 *   DAO ya instanciado (tests) o factory `(req) => dao`. Si se omite,
 *   se crea por-request con `req.userToken` para no perder el JWT.
 */
export const tenantMiddleware = (daoOrFactory) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError(
          "El middleware de tenant requiere un usuario autenticado"
        );
      }

      let usuarioEmprendimientoDao = daoOrFactory;
      if (typeof daoOrFactory === "function") {
        usuarioEmprendimientoDao = daoOrFactory(req);
      }
      if (!usuarioEmprendimientoDao) {
        usuarioEmprendimientoDao = new UsuarioEmprendimientoDao(req.userToken);
      }

      const requestedId =
        req.headers["x-emprendimiento-id"] ||
        req.query?.emprendimientoId ||
        req.body?.emprendimientoId ||
        null;

      const ventures = await usuarioEmprendimientoDao.listByUser(req.user.id);

      if (requestedId) {
        const found = ventures.find((row) => row.emprendimiento_id === requestedId);
        if (!found) {
          throw new UnverifiedTenantError(
            `El usuario ${req.user.id} no tiene acceso al emprendimiento ${requestedId}`
          );
        }
        req.tenant = { id: found.emprendimiento_id, nombre: found.nombre };
        return next();
      }

      if (ventures.length === 0) {
        throw new UnverifiedTenantError(
          "El usuario no pertenece a ningún emprendimiento"
        );
      }

      if (ventures.length > 1) {
        throw new BadRequestError(
          "El usuario pertenece a varios emprendimientos: indicá 'emprendimientoId' (header x-emprendimiento-id, query o body)"
        );
      }

      req.tenant = { id: ventures[0].emprendimiento_id, nombre: ventures[0].nombre };
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export default tenantMiddleware;
