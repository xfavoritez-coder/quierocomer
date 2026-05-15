# Plan completo — Funnel /subircarta QuieroComer

## Resumen

Funnel de captación de dueños de restaurantes. El dueño sube su carta (link, PDF o foto), el sistema la analiza con IA, y le entrega una carta viva por correo. El lead queda registrado para seguimiento comercial.

---

## Ya construido (Mayo 2026)

### Infraestructura

- **Tablas Prisma**: Lead, MenuProvider, AdminPushSubscription
- **Campos Lead**: localName, ownerName, email, whatsapp (E.164), cartaType, cartaUrl, cartaFileUrl, detectedProviderId, cartaStatus, preview (Json), generatedSlug, step2At, completedAt, activated
- **cartaStatus flow**: PENDING → PROCESSING → READY → DELIVERED
- **Rate limit**: 5 leads/IP/hora + detección de duplicados por URL

### Proveedores configurados

| Proveedor | Tipo de extractor | Método | Velocidad |
|-----------|------------------|--------|-----------|
| **Justo** | Dedicado (HTML parsing) | Fetch directo /pedir, cheerio | ~3s |
| **UberEats** | Dedicado (API) | POST /_p/api/getStoreV1 | ~2s |
| **Queresto/Bistrify** | Dedicado (JSON-LD) | Fetch HTML, parse JSON-LD | ~2s |
| **Fudo** | Genérico (Jina+Claude) | Jina renderiza SPA, Sonnet extrae | ~60s |
| **Mercat** | Genérico (Jina+Claude) | Jina renderiza SPA, Sonnet extrae | ~60s |
| **Gourmedia** | Genérico (Jina+Claude) | Pendiente optimización | ~60s |
| **Desconocido** | Genérico (Jina+Claude) | Intenta ambos, elige mejor | ~60s |

### Detección de proveedor (dos pasos)

1. Comparar hostname contra `domainPatterns` (instantáneo)
2. Si no hay match → fetch HTML → buscar `htmlSignatures` de cada proveedor

### Flujo completo modo LINK

1. **Paso 1** (`/subircarta`): pega link → crea Lead → detecta proveedor → redirige a paso 2
2. **Paso 2** (`/subircarta/paso2`): animación de progreso (~14s) + dispara preview async + formulario
3. **Submit**: PATCH guarda datos del dueño (localName, ownerName, email, whatsapp)
4. **Confirmación** (`/subircarta/confirmacion`):
   - Dispara process completo async
   - Polling cada 3s para detectar preview y cartaStatus
   - Estados: "Tu carta ya está en preparación" → "Tu experiencia está lista" → "Revisa tu correo"
   - Timeout 20s: "Tu carta de X está en revisión" + "Te la enviaremos"
   - iPhone mockup con datos reales (hero rotante, platos con fotos)
   - Modal "Casi lista" → "Lista" → fade-out → carta nítida

### Extracción en dos fases

- **Preview rápida** (~15s): Haiku con 4KB para 5 platos (o extractor dedicado)
- **Proceso completo** (~60s): Sonnet con 20KB para todos los platos + crear Restaurant + re-upload fotos
- Validación de calidad: mínimo 3 platos con precios para marcar READY

### Email automático

- Se envía cuando cartaStatus pasa a READY
- Desde: hola@quierocomer.cl (Resend)
- Asunto: "{Local} · Tu nueva carta está lista"
- Contenido: logo del local, saludo, cantidad de platos, botón "Ver mi carta"
- Marca lead como DELIVERED

### Push notifications admin

- Service worker `sw-admin.js` + AdminPushSubscription
- Botón "Activar notificaciones" en `/admin/funnel`
- Push en éxito: "🧞 Nueva carta creada" con nombre y cantidad de platos
- Push en fallo: "⚠️ Lead sin procesar" con nombre del local
- Click en notificación → abre `/admin/funnel`

### Admin Funnel (`/admin/funnel`)

- Cards responsive (funciona en móvil)
- Stats: total, paso 2, completados, abandonados, por tipo
- Auto-refresh al volver a la página (visibilitychange)
- Link "Ver carta" para leads READY/DELIVERED

### Otros features implementados

- WhatsApp normalización E.164 con libphonenumber-js
- Upload de archivos (PDF/foto) a Supabase Storage
- Accent color configurable por restaurante (amber/rojo)
- Dark/light mode toggle en ViewSelector
- GenioFab con lámpara personalizada
- Birthday modal con dark mode
- FABs unificados (mismo estilo dark glass)
- Nav superior con logo + RRSS + idioma
- No flash blanco entre pasos (layout con body oscuro)

---

## Pendientes

### Prioridad alta

1. **Banner demo en carta generada** — Cuando el dueño abre su carta desde el email, mostrar un banner superior tipo "Esto es un demo · Ver mi panel / Activar carta / Ver QR". Al activar, muestra los 3 planes. Similar a cómo Monster Templates muestra previews con CTA. Esto convierte leads en clientes.

2. **Gourmedia optimización** — Crear extractor dedicado si tiene API o JSON-LD (como Queresto/UberEats). Actualmente usa genérico (lento, puede fallar).

3. **Mejorar diseño de email** — El email actual es funcional pero básico. Mejorar template con preview de la carta, QR, y CTA más atractivo.

### Prioridad media

4. **Modos DOCUMENT y PHOTO completos** — Upload funciona, pero la extracción de texto/OCR no está implementada. Estrategia: buscar nombre del local en Google → encontrar link online → tratar como LINK.

5. **n8n/Make seguimiento** — Webhook en creación de lead para CRM. Secuencia de seguimiento para leads que no activan. WhatsApp para los que dejaron teléfono.

6. **Procesamiento manual** — Botón "Reprocesar" en admin funnel para leads PENDING. Botón "Procesar manual" que lleva a /agregarlocal con URL pre-llenada.

### Prioridad baja

7. **Más proveedores** — Agregar según demanda: TheFork, Rappi, PedidosYa, iFood.

8. **Admin funnel mejoras** — Filtros por estado/proveedor, búsqueda, paginación.

9. **Analytics del funnel** — Dashboard con conversion rate, tiempo promedio de procesamiento, proveedores más usados.

---

## Arquitectura de archivos

```
prisma/schema.prisma          → Lead, MenuProvider, AdminPushSubscription
src/lib/extractors/
  types.ts                    → ExtractedDish, ExtractionResult
  justo.ts                    → Extractor Justo (HTML parsing)
  ubereats.ts                 → Extractor UberEats (API)
  queresto.ts                 → Extractor Queresto (JSON-LD)
  scrape.ts                   → Genérico (Jina+Claude) + quick preview
  preview.ts                  → Preview rápida (router a extractores)
  pipeline.ts                 → Pipeline completo (extracción → restaurant → email)
src/lib/adminPush.ts          → Push notifications al admin
src/lib/normalizePhone.ts     → WhatsApp E.164
src/app/subircarta/
  layout.tsx                  → Body oscuro (no flash)
  page.tsx                    → Paso 1
  SubirCartaClient.tsx        → Paso 1 (client)
  paso2/
    page.tsx                  → Paso 2
    Paso2Client.tsx           → Paso 2 (client, animación + form)
  confirmacion/
    page.tsx                  → Confirmación
    ConfirmacionClient.tsx    → Confirmación (client, polling + iPhone preview)
src/app/api/subircarta/
  route.ts                    → POST: crear lead + detectar proveedor
  upload/route.ts             → POST: upload archivo a Supabase
  preview/route.ts            → POST: preview rápida
  process/route.ts            → POST: pipeline completo
  [id]/route.ts               → GET: fetch lead, PATCH: completar lead
src/app/api/admin/
  funnel/route.ts             → GET: leads + stats
  push/route.ts               → POST/DELETE: push subscriptions
src/app/(main)/admin/funnel/
  page.tsx                    → Dashboard funnel (responsive)
public/
  sw-admin.js                 → Service worker admin push
  genio-lamp.png              → Icono lámpara GenioFab
```

---

## Decisiones tomadas

- Un solo registro Lead por funnel (se crea en paso 1, se completa en paso 2)
- Preview rápida en paso 2, proceso completo en confirmación
- Sonnet para extracción full (calidad), Haiku para preview (velocidad)
- Extractores dedicados cuando es posible (Justo, UberEats, Queresto) — sin IA, instantáneos
- Genérico (Jina+Claude) como fallback para proveedores desconocidos
- Validación de calidad: min 3 platos con precios antes de marcar READY
- Push solo en fallo del pipeline (no del preview)
- Email solo cuando READY con datos válidos
- Timeout de 20s en confirmación para feedback rápido al usuario
