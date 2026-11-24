export const EMPRENDIMIENTO_STORAGE_KEY = "emprendimientoId";

export const CANALES_VENTA = ["WHATSAPP", "TELEGRAM", "EN_PERSONA"] as const;
export const MODALIDADES_ENTREGA = ["RETIRO", "ENVIO"] as const;

export type CanalVenta = (typeof CANALES_VENTA)[number];
export type ModalidadEntrega = (typeof MODALIDADES_ENTREGA)[number];
