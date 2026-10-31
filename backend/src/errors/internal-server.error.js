import { AppError } from "./app-error.js";

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error", details) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

export default InternalServerError;
