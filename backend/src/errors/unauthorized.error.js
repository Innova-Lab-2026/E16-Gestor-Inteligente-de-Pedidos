import { AppError } from "./app-error.js";

export class UnauthorizedError extends AppError {
  constructor(message = "No autenticado", details) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export default UnauthorizedError;