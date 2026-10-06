import { ForbiddenError } from "./forbidden.error.js";

/**
 * El usuario autenticado no tiene acceso al emprendimiento solicitado.
 * Se usa en tenant.middleware y en los DAOs que resuelven
 * el tenant a partir del body/query.
 */
export class UnverifiedTenantError extends ForbiddenError {
  constructor(message = "El usuario no tiene acceso alventurement indicado") {
    super(message);
    this.code = "UNVERIFIED_TENANT";
  }
}

export default UnverifiedTenantError;