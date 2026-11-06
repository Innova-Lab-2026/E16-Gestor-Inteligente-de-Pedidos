# Gestor Inteligente de Pedidos, Ventas y Stock para Emprendedores

Plataforma web para centralizar la operación diaria de pequeños emprendimientos: pedidos, clientes, ventas y stock, con integración a WhatsApp y alertas operativas.

## Propósito

Ayudar a emprendedores que reciben pedidos por canales digitales (especialmente WhatsApp) a ordenar su gestión diaria sin recurrir a sistemas complejos. Cada cuenta representa un emprendimiento y mantiene separados su catálogo, clientes, pedidos, ventas y stock.

## Problema que resuelve

- Pedidos dispersos entre WhatsApp, Instagram u otros canales sin registro centralizado.
- Dificultad para seguir el estado de cada pedido (recibido, preparación, listo, entregado, cancelado).
- Falta de control actualizado del stock, incluyendo variantes.
- Errores en cobros, entregas, reposiciones y ajustes de inventario.
- Escasa visibilidad sobre productos más vendidos y necesidades de reposición.

## Solución

Un panel operativo que centraliza pedidos (manuales y provenientes de WhatsApp), catálogo con variantes y stock, seguimiento de estados, cobros, alertas de bajo stock e indicadores clave para planificar compras, producción y ventas.

## Funcionalidades principales

- Acceso y emprendimiento: registro/inicio de sesión y gestión aislada por cuenta.
- Catálogo de productos: alta, edición y baja lógica con precio y estado.
- Variantes: talle, color, sabor o tamaño con stock propio.
- Stock y movimientos: stock inicial y ajustes manuales con motivo.
- Stock automático: reserva/descuento al confirmar y devolución al cancelar.
- Pedidos manuales: creación desde el gestor con cliente, productos, cantidades y entrega.
- Integración con WhatsApp: recepción automática de pedidos vía API oficial.
- Clientes: datos básicos asociados al pedido.
- Seguimiento de pedidos: estados y modalidad/fecha de entrega.
- Cobros: estado pagado o pendiente.
- Alertas de stock: destacado de productos que requieren reposición.
- Dashboard operativo: ventas, pedidos por estado, cobros pendientes, bajo stock y más vendidos.
- Búsqueda y filtros por cliente, fecha, estado o cobro.
- Validaciones y trazabilidad de movimientos críticos.
- Interfaz responsive para operar desde computadora o celular.

## Flujo general

1. Registro/inicio de sesión y configuración del emprendimiento.
2. Carga de catálogo, variantes y stock.
3. Recepción de pedido (WhatsApp o manual) y asociación de cliente.
4. Confirmación y actualización automática de stock.
5. Gestión de preparación, entrega y cobro.
6. Consulta de alertas e indicadores.

## Estructura del repositorio

- `backend/` — API y lógica de negocio (Node.js/Express).
- `frontend/` — Aplicación web (Vite/React).

## Documentación adicional

ver docs externas

## Licencia

TBA
