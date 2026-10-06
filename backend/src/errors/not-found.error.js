import { AppError } from "./app-error.js";

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado", details) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export default NotFoundError;