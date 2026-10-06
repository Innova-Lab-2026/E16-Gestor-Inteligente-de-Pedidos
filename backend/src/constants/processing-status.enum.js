/** Estados de procesamiento de un evento de canal. */
export const PROCESSING_STATUS = Object.freeze({
  PROCESADO: "PROCESADO",
  ERROR: "ERROR",
  REVISION_REQUERIDA: "REVISION_REQUERIDA",
});

/** Tipos de movimiento de stock. */
export const STOCK_MOVEMENT_TYPE = Object.freeze({
  RESERVA_PEDIDO: "RESERVA_PEDIDO",
  RESTITUCION_CANCELACION: "RESTITUCION_CANCELACION",
  REPOSICION: "REPOSICION",
  PRODUCCION: "PRODUCCION",
  PERDIDA: "PERDIDA",
  CORRECCION_MANUAL: "CORRECCION_MANUAL",
});

/** Signo aplicado a la cantidad según el tipo de movimiento. */
export const STOCK_MOVEMENT_SIGN = Object.freeze({
  [STOCK_MOVEMENT_TYPE.RESERVA_PEDIDO]: -1,
  [STOCK_MOVEMENT_TYPE.RESTITUCION_CANCELACION]: 1,
  [STOCK_MOVEMENT_TYPE.REPOSICION]: 1,
  [STOCK_MOVEMENT_TYPE.PRODUCCION]: 1,
  [STOCK_MOVEMENT_TYPE.PERDIDA]: -1,
  // CORRECCION_MANUAL toma el signo de la cantidad enviada.
  [STOCK_MOVEMENT_TYPE.CORRECCION_MANUAL]: 0,
});

/** Modalidades de entrega. */
export const DELIVERY_MODE = Object.freeze({
  RETIRO: "RETIRO",
  ENVIO: "ENVIO",
});

export default PROCESSING_STATUS;