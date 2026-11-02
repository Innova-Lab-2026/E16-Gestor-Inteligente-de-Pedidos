# Pruebas Postman – Circuito completo (Webhook WhatsApp → Pedido → Inventario)

## Base
- Base URL: `http://localhost:3000`
- Webhook WhatsApp: `POST /webhooks/whatsapp`
- Requiere canal WhatsApp previamente registrado con `phone_number_id` correspondiente.

## Variables Postman
- `{{baseUrl}}`
- `{{phoneNumberId}}`
- `{{messageId}}`
- `{{texto}}`
- `{{token}}` (JWT de login)
- `{{emprendimientoId}}`

## 0) Pre-requisitos (setup mínimo)

Antes de probar el webhook, crear el tenant, el canal WhatsApp y (opcional) catálogo/stock.

### 0.1 Registrar usuario + emprendimiento
`POST /api/auth/register`
```json
{
  "email": "yo@emprendimiento.com",
  "password": "clave12345",
  "emprendimiento": { "nombre": "Mi emprendimiento" }
}
```

### 0.2 Login
`POST /api/auth/login`
```json
{ "email": "yo@emprendimiento.com", "password": "clave12345" }
```
Header en el resto: `Authorization: Bearer <token>` y, si hay varios emprendimientos, `x-emprendimiento-id: <emprendimientoId>`.

### 0.3 Crear canal WhatsApp
`POST /api/canales`
```json
{
  "tipo": "WHATSAPP",
  "identificadorExterno": "{{phoneNumberId}}",
  "nombre": "Canal WhatsApp principal",
  "activo": true
}
```
> `identificadorExterno` debe coincidir con el `phone_number_id` que envía Meta en el webhook.

### 0.4 (Opcional) Crear producto y variante
`POST /api/productos`
```json
{ "nombre": "Remera", "unidad": "unidad" }
```
`POST /api/productos/:id/variantes`
```json
{ "nombre": "Talle M", "sku": "REM-M" }
```

### 0.5 (Opcional) Definir stock inicial
`POST /api/stock/movimientos`
```json
{ "productoId": "<uuid>", "varianteId": "<uuid>", "cantidad": 10, "tipo": "INGRESO" }
```

### 0.6 (Opcional) Crear cliente manual
`POST /api/clientes`
```json
{ "nombre": "Juan", "telefono": "5491112345678" }
```

---


## Payload base de WhatsApp (texto)
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5491112345678",
              "phone_number_id": "{{phoneNumberId}}"
            },
            "contacts": [
              { "profile": { "name": "Juan" }, "wa_id": "5491112345678" }
            ],
            "messages": [
              {
                "from": "5491112345678",
                "id": "wamid.{{messageId}}",
                "timestamp": "1735689600",
                "text": { "body": "{{texto}}" },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```
### Request en Postman (webhook)
- Método: `POST`
- URL: `{{baseUrl}}/webhooks/whatsapp`
- Headers:
  - `Content-Type: application/json`
  - `X-Hub-Signature-256: sha256=<firma>` (en dev puede omitirse si el backend no valida; en prod es obligatoria)
- Body: `raw` → `JSON` (usar el payload base con las variables resueltas).

### Verificación general (después de cada caso)
- Pedidos del tenant: `GET {{baseUrl}}/api/pedidos?limite=200` (Headers: `Authorization: Bearer {{token}}`, `x-emprendimiento-id: {{emprendimientoId}}`).
- Detalle de pedido creado: `GET {{baseUrl}}/api/pedidos/<pedidoId>` y `GET {{baseUrl}}/api/pedidos/<pedidoId>/eventos`.
- Stock: `GET {{baseUrl}}/api/stock/movimientos?limite=100` (mismos headers).
- Eventos de canal sin pedido asociado: consultar `GET {{baseUrl}}/api/pedidos?requiereRevision=true`.

---

## 1) Primer mensaje – crea pedido
- `messageId`: `abc123`
- `texto`: `2 remeras talle M`
Esperado:
- HTTP 200
- `duplicado: false`
- Pedido creado con items o marcado para revisión según resolución

## 2) Idempotencia – mismo message id
- Repetir request del paso 1 sin cambiar `messageId`
Esperado:
- HTTP 200
- `duplicado: true`
- No se crea un segundo pedido

## 3) Normalización singular/plural – remera/remeras
- `messageId`: `abc124`
- `texto`: `1 remera`
Esperado:
- Resuelve el mismo producto que `remeras`
- No crea coincidencia ambigua si solo hay un producto

## 4) Normalización singular/plural – alfajor/alfajores
- `messageId`: `abc125`
- `texto`: `3 alfajores`
Esperado:
- Resuelve producto `alfajor`/`alfajores` correctamente

## 5) Normalización singular/plural – producto/productos
- `messageId`: `abc126`
- `texto`: `2 productos`
Esperado:
- Resuelve solo si existe producto con ese nombre o descripción

## 6) Palabras con fragmentos compartidos pero no equivalentes
- `messageId`: `abc127`
- `texto`: `2 remer`
Esperado:
- No debe resolver por coincidencia parcial accidental
- Evento marcado para revisión si no hay match exacto por palabra

## 7) Productos con nombres similares
- Catálogo con productos `Remera` y `Remera Premium`
- `messageId`: `abc128`
- `texto`: `1 remera`
Esperado:
- Si ambos coinciden, respuesta ambigua: `producto: null`, `requiereRevision: true`
- Nunca selecciona arbitrariamente uno

## 8) Coincidencia ambigua
- Catálogo con dos productos que contengan el mismo token
- `messageId`: `abc129`
- `texto`: `1 remera`
Esperado:
- No se crea pedido con producto arbitrario
- Evento en `REVISION_REQUERIDA`

## 9) Aislamiento entre emprendimientos
- Usar `phoneNumberId` de un canal de otro emprendimiento
- `messageId`: `abc130`
- `texto`: `2 remeras`
Esperado:
- Solo se consideran productos del emprendimiento del canal
- No se filtra por productos de otro emprendimiento

## 10) Mensaje sin productos identificables
- `messageId`: `abc131`
- `texto`: `2 cosas raras`
Esperado:
- `pedido: null`
- Evento en `REVISION_REQUERIDA`
- No se invoca creación de pedido

## 11) Variante requerida y no identificada
- Producto con variantes, mensaje sin talle/color
- `messageId`: `abc132`
- `texto`: `2 remeras`
Esperado:
- Producto resuelto
- Variante no resuelta
- `requiereRevision: true`
- No se selecciona variante arbitraria

## 12) Conservación de unidad comercial
- `messageId`: `abc133`
- `texto`: `2 kg de harina`
Esperado:
- El item conserva `unidad: kg`
- El producto mencionado sigue siendo `harina`
- No se descuenta stock en este flujo de resolución

## 13) Atributos descriptivos no provocan coincidencias incorrectas
- Catálogo con producto `Harina 000`
- `messageId`: `abc134`
- `texto`: `1 harina integral`
Esperado:
- Si no coincide por tokens completos, no se asocia incorrectamente
## 14) Verificación de inventario
Después de un pedido confirmado:
1. Consultar stock del producto/variante por API: `GET {{baseUrl}}/api/stock/movimientos?limite=100` (Headers: `Authorization: Bearer {{token}}`, `x-emprendimiento-id: {{emprendimientoId}}`).
2. Verificar que el descuento se realice únicamente en el flujo de pedidos/inventario.
3. Verificar que la resolución de catálogo no haya modificado stock.
4. Revisar bitácora del pedido: `GET {{baseUrl}}/api/pedidos/<pedidoId>/movimientos`.
5. Verificar evento asociado: `GET {{baseUrl}}/api/pedidos/<pedidoId>/eventos`.

## Notas
- No se agregaron dependencias, IA, migraciones ni cambios de esquema.
- La resolución de productos y variantes no valida ni descuenta stock.
- La idempotencia se basa en `mensajeria_message_id` por canal.
```