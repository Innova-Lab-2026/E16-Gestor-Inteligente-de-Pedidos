/**
 * Error base de la aplicación.
 * Todo error de negocio debe heredar de AppError para que el
 * middleware de errores lo serialice de forma uniforme.
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {string} [code='APP_ERROR']
   * @param {object} [details]
   */
  constructor(message, statusCode = 500, code = "APP_ERROR", details = undefined) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, new.target);
  }
}

export default AppError;