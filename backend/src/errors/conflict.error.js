import { AppError } from "./app-error.js";

export class ConflictError extends AppError {
  constructor(message = "El recurso ya existe", details) {
    super(message, 409, "CONFLICT", details);
  }
}

export default ConflictError;
