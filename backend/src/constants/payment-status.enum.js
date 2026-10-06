/** Estados de cobro de un pedido. */
export const PAYMENT_STATUS = Object.freeze({
  PAGADO: "PAGADO",
  PENDIENTE: "PENDIENTE",
});

export const isPaymentStatus = (value) =>
  Object.values(PAYMENT_STATUS).includes(value);

export default PAYMENT_STATUS;