import { AppError } from "./app-error.js";

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado", details) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export default ForbiddenError;