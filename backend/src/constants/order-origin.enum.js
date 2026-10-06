/** Origen del pedido. MANUAL nunca debe ser un canal. */
export const ORDER_ORIGIN = Object.freeze({
  MANUAL: "MANUAL",
  CANAL: "CANAL",
});

export const isOrderOrigin = (value) =>
  Object.values(ORDER_ORIGIN).includes(value);

export default ORDER_ORIGIN;