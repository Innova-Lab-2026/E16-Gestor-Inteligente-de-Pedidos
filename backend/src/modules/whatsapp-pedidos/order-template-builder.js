// modules/whatsapp-pedidos/order-template-builder.js
//
// Construye la plantilla genérica (sin productos reales del catálogo) para
// sugerir al cliente. Stateless.

export class OrderTemplateBuilder {
  build() {
    return [
      "Para registrar tu pedido, respondé con este formato (copiá y completá):",
      "",
      "PEDIDO",
      "Items:",
      "- Producto: <nombre del producto> | Variante: <variante> | Cantidad: <número>",
      "Entrega: Retiro",
      "Nombre: <tu nombre>",
      "",
      "Campos opcionales: Dirección (si Entrega: Envío), Teléfono, Observaciones.",
      "Podés agregar más ítems repitiendo la línea que empieza con '-'.",
    ].join("\n");
  }
}

export default OrderTemplateBuilder;