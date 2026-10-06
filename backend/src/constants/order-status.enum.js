/** Estados posibles de un pedido. */
export const ORDER_STATUS = Object.freeze({
  RECIBIDO: "RECIBIDO",
  EN_PREPARACION: "EN_PREPARACION",
  LISTO: "LISTO",
  ENTREGADO: "ENTREGADO",
  CANCELADO: "CANCELADO",
});

/**
 * Transiciones válidas. Cancelar desde cualquier estado no terminal
 * genera restitución de stock; no se puede volver desde un estado terminal.
 */
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.RECIBIDO]: [
    ORDER_STATUS.EN_PREPARACION,
    ORDER_STATUS.CANCELADO,
  ],
  [ORDER_STATUS.EN_PREPARACION]: [ORDER_STATUS.LISTO, ORDER_STATUS.CANCELADO],
  [ORDER_STATUS.LISTO]: [ORDER_STATUS.ENTREGADO, ORDER_STATUS.CANCELADO],
  [ORDER_STATUS.ENTREGADO]: [],
  [ORDER_STATUS.CANCELADO]: [],
});

export const isOrderStatus = (value) =>
  Object.values(ORDER_STATUS).includes(value);

export default ORDER_STATUS;