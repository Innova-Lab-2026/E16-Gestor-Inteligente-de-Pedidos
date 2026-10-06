import { AppError } from "./app-error.js";

export class BadRequestError extends AppError {
  constructor(message = "Solicitud inválida", details) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export default BadRequestError;