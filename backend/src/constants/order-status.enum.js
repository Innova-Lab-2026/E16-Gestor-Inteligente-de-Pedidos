/** Estados posibles de un pedido. */
export const ORDER_STATUS = Object.freeze({
  RECIBIDO: "RECIBIDO",
  EN_PREPARACION: "EN_PREPARACION",
  LISTO: "LISTO",
  EN_VIAJE: "EN_VIAJE",
  ENTREGADO: "ENTREGADO",
  CANCELADO: "CANCELADO",
});

/**
 * Transiciones válidas. Al cancelar, la RPC restituye las reservas existentes;
 * no se puede volver desde un estado terminal.
 */
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.RECIBIDO]: [
    ORDER_STATUS.EN_PREPARACION,
    ORDER_STATUS.CANCELADO,
  ],
  [ORDER_STATUS.EN_PREPARACION]: [ORDER_STATUS.LISTO, ORDER_STATUS.CANCELADO],
  // EN_VIAJE solo aplica a envíos: lo valida la RPC cambiar_estado_pedido (009).
  [ORDER_STATUS.LISTO]: [
    ORDER_STATUS.EN_VIAJE,
    ORDER_STATUS.ENTREGADO,
    ORDER_STATUS.CANCELADO,
  ],
  [ORDER_STATUS.EN_VIAJE]: [ORDER_STATUS.ENTREGADO, ORDER_STATUS.CANCELADO],
  [ORDER_STATUS.ENTREGADO]: [],
  [ORDER_STATUS.CANCELADO]: [],
});

export const isOrderStatus = (value) =>
  Object.values(ORDER_STATUS).includes(value);

export default ORDER_STATUS;