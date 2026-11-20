# Plan: CRM de WhatsApp para tomar pedidos

CRM/bandeja de WhatsApp para que los **cajeros atiendan manualmente** a clientes que
escriben primero, tomen pedidos (→ POS) y el dueño pueda ver, analizar y medir las
conversaciones. **Sin agentes de IA.** 100% sobre la **API oficial (Cloud API de Meta)**.

> ⚠️ **Nunca** usar librerías no oficiales (whatsapp-web.js, Baileys, scraping de
> WhatsApp Web): violan los términos y terminan en baneo del número.

---

## Principios de diseño
- **Solo Cloud API oficial.** Un webhook global recibe todo y rutea por `phone_number_id` → restaurante.
- **Config por local**, como Twilio/Delifast: `ecommerceConfig.whatsapp` con el `accessToken` **cifrado en reposo** (`configSecrets` AES-GCM).
- **Una bandeja compartida por número.** Meta no limita agentes; la **app** gestiona asignación de chats entre cajeros.
- **Ventana de 24h respetada en la UI:** si está cerrada, se bloquea el envío libre y solo se ofrece plantilla aprobada.
- **El teléfono = llave del cliente** → se reutiliza la búsqueda `lite=1` y el pipeline del POS.
- **Tiempo real con Supabase Realtime** (mismo patrón que KDS/board; recordar la policy `anon_read`).

---

## Reglas de WhatsApp que aplican (checklist de cumplimiento)
- ✅ Mensajes **entrantes = gratis**. El cliente escribe primero → se abre la **ventana de servicio de 24h**; cada mensaje del cliente la reinicia.
- ✅ Dentro de la ventana: respuestas **libres** (texto/medios). Fuera: solo **plantilla aprobada**.
- ✅ Mensajes de **servicio**: 1.000 gratis/mes por número (desde oct-2026), luego por mensaje (centavos). Plantillas (marketing/utilidad/auth) se pagan por mensaje.
- ✅ El número de la API **no** puede usarse a la vez en la app normal de WhatsApp.
- ✅ Datos de clientes tratados como privados (estándar del proyecto).

---

## Fases

### Fase 0 — Alta y setup (trámite, sin código)
- Meta Business + **WABA**; número dedicado (nuevo para el piloto, o migrar uno existente).
- Verificación del negocio + nombre para mostrar.
- Proveedor: **Cloud API directo** (recomendado para el CRM) vs Twilio (ya está, pero cobra encima — se deja solo para plantillas).
- Meta entrega **número de prueba gratis** → permite desarrollar Fases 1–2 sin esperar verificación.
- **Listo cuando:** se puede enviar/recibir con un `phone_number_id` + token.

### Fase 1 — Plomería: webhook + envío + modelo de datos ✅ (en curso)
- **Modelo Prisma** (aditivo): `WhatsAppContact`, `WhatsAppConversation`, `WhatsAppMessage`.
- **Webhook** `GET/POST /api/whatsapp/webhook` — GET verifica (verify token); POST recibe mensajes **y** estados (delivered/read/failed), ruteando por `phone_number_id`. Idempotente por `waMessageId`. Valida firma `X-Hub-Signature-256` si hay `WHATSAPP_APP_SECRET`.
- **Cliente** `src/lib/whatsapp/client.ts` — `sendText`, `sendTemplate` (Graph API, token por local).
- **Config** en `/admin/locales` (sección "WhatsApp"): `phoneNumberId`, `wabaId`, `accessToken` (cifrado), `displayPhone`, enabled.
- **Endpoint de envío** `POST /api/whatsapp/send` (auth panel) para que la UI de Fase 2 lo use.
- **Tablas en prod:** creación **aditiva** (CREATE TABLE IF NOT EXISTS), nunca `prisma db push`.
- **Listo cuando:** un WhatsApp al número de prueba queda en la BD y se puede responder y le llega al cliente.

### Fase 2 — Bandeja MVP (el corazón del CRM)
- Lista de conversaciones (no leídos, asignadas a mí / sin asignar, estado de ventana 🟢/🔴 con cuenta regresiva).
- Panel de chat: historial, enviar texto/imagen, indicador entregado/leído.
- Tiempo real (Supabase Realtime sobre mensajes/conversaciones).
- **Asignación** (tomar/reasignar chat) para evitar choques entre cajeros.
- **Enforcement de 24h** en el input.
- Descarga/almacenamiento de medios entrantes → bucket privado de Supabase Storage.
- **Listo cuando:** dos cajeros atienden chats reales de un local piloto en vivo.

### Fase 3 — Integración con pedidos (el payoff)
- Sidebar del cliente: búsqueda por teléfono (`lite=1`) → nombre, direcciones, historial; o "crear cliente".
- Botón **"Crear pedido"** → abre el tomador (PosQuickOrder) pre-llenado → genera `PosOrder` → POS + impresión/cocina.
- Vínculo bidireccional chat ↔ pedido (`WhatsAppMessage.posOrderId`).
- **Listo cuando:** un cajero toma un pedido por WhatsApp y sale impreso en cocina, atado al cliente.

### Fase 4 — Analítica
- Tiempo de 1ª respuesta, tiempo medio de respuesta, # conversaciones, **conversión chat→pedido**, ticket promedio, desempeño por cajero, horas peak, clientes recurrentes.
- Dashboard en `/panel` (filtros local/fecha/cajero) sobre Postgres. Export CSV opcional.

### Fase 5 — Pulido y escala
- Respuestas rápidas (canned), etiquetas (pedido/reclamo/mayorista).
- Notificaciones al cajero (sonido/push; ojo `urgency:high`).
- Plantillas para reabrir fuera de 24h (unificar con los avisos que ya salen por Twilio).
- Multi-local + permisos por cajero (`teamMemberCanAccess`).
- Auditoría y retención de medios.

---

## Modelo de datos (Fase 1)
- **WhatsAppContact** — `restaurantId`, `phone` (E.164), `waId`, `name`, `customerId?`. Único por `(restaurantId, phone)`.
- **WhatsAppConversation** — `restaurantId`, `contactId`, `status` (open/closed), `assignedToId?`, `windowExpiresAt?`, `lastInboundAt?`, `lastMessageAt?`, `unreadCount`.
- **WhatsAppMessage** — `conversationId`, `restaurantId`, `direction` (in/out), `type`, `body?`, `mediaUrl?`, `mediaId?`, `waMessageId?` (único), `status?`, `errorDetail?`, `sentById?`, `posOrderId?`.

## Variables de entorno (Fase 1)
- `WHATSAPP_VERIFY_TOKEN` — token del GET del webhook (se configura en Meta).
- `WHATSAPP_APP_SECRET` — (opcional) para validar la firma `X-Hub-Signature-256`.
- `WHATSAPP_GRAPH_VERSION` — (opcional) versión de Graph API, default `v21.0`.

## Ruta recomendada
Piloto en **un local**: Fases 0→1→2→3 con el número de prueba, luego el número real al verificar. Fases 4–5 una vez que el flujo de pedidos corre.
