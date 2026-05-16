# Plan completo — Funnel /subircarta QuieroComer

## Resumen

Funnel de captación de dueños de restaurantes. El dueño sube su carta (link, PDF o foto), el sistema la analiza con IA, y le entrega una carta viva por correo. El lead queda registrado para seguimiento comercial.

---

## Ya construido (Mayo 2026)

### Infraestructura

- **Tablas Prisma**: Lead, MenuProvider, AdminPushSubscription
- **Campos Lead**: localName, ownerName, email, whatsapp (E.164), cartaType, cartaUrl, cartaFileUrl, detectedProviderId, cartaStatus, preview (Json), generatedSlug, step2At, completedAt, previewAt, readyAt, activated
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
   - Modal "Casi lista" → (15s) "Te avisaremos por correo / Puedes cerrar esta página" → "Lista" → fade-out → carta nítida

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
- Timeline de tiempos por lead: Inicio → Paso 2 → Preview → Lista (con deltas)
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

## Completado (15 Mayo 2026)

- ✅ **Pipeline FAILED status** — CartaStatus ahora tiene FAILED. Pipeline marca FAILED en catch y timeout de 4 min. Admin recibe push notification de fallo.
- ✅ **Pipeline timeout safety** — setTimeout de 4 min dentro de pipeline.ts resetea a FAILED si se cuelga.
- ✅ **HD photo pipeline** — reuploadPhoto() intenta URL HD (og:image > srcset > data-src > fallback). Resize 1200px, quality 88. upgradePhotoUrl() para Shopify/Cloudinary/CDNs.
- ✅ **Scraper HD photos** — agregarlocal/scrape busca og:image > srcset > data-src antes de img src.
- ✅ **Birthday modal i18n** — Placeholders traducidos (nombre/email/fecha). Subtexto del perk eliminado.
- ✅ **Vista Impact** — Nueva vista completa: hero rotativo, mood categories, destacados, ofertas cinema, menú con chips, genio, FABs. Dark y light mode.
- ✅ **FabSpeedDial** — Botón lámpara expande genio/campana/vistas. Todas las vistas.
- ✅ **Theme persistence** — Dark/light se guarda en localStorage, se restaura vía inline script.
- ✅ **i18n badges** — Recomendado/Popular traducidos en todas las vistas.
- ✅ **i18n Impact titles** — Secciones (Qué se te antoja, Destacados, Ofertas, Menú) en es/en/pt/it.
- ✅ **Language selector Impact** — Dropdown con banderas SVG en nav superior.
- ✅ **Accent-based ambient** — Destellos de fondo usan color del theme (amber/rojo).
- ✅ **Genio carousels** — Fotos 118px, títulos 14px, precios 13px, disclaimer eliminado.
- ✅ **Ajustes panel** — Vista Impact agregada, bloque "Vista por defecto" primero.
- ✅ **Sin gluten badge** — Siempre dorado (#d4a047), no usa accent.
- ✅ **BirthdayBanner removido** — Quitado de las 4 vistas (auto modal se mantiene).
- ✅ **Gourmedia investigado** — Es WooCommerce con JS rendering. Sigue con Jina+Claude (crear extractor dedicado requiere más análisis).
- ✅ **Modo PHOTO en /subircarta** — Claude Vision extrae menú de fotos. Preview con Sonnet, proceso completo con Sonnet. Fotos de Unsplash como referencial para demo.
- ✅ **Multi-foto upload** — Hasta 10 fotos, upload secuencial con progreso ("Procesando foto 2 de 4..."), validación 50MB total.
- ✅ **Compresión browser** — Canvas resize a 1600px JPEG antes de subir (4MB→300KB, upload 10x más rápido).
- ✅ **Auto-detect diet/spicy** — Scraper y Vision extraen VEGAN/VEGETARIAN/isSpicy, pipeline los guarda en dish.
- ✅ **Auto-RECOMMENDED** — Primer plato de primeras 2 categorías se marca RECOMMENDED automáticamente.
- ✅ **Auto-translate** — enabledLangs ["es","en","pt"] por defecto, traducción se dispara automáticamente.
- ✅ **Default Impact** — Nuevos restaurantes creados con defaultView "impact".
- ✅ **Scroll to top** — Paso2 y Confirmación hacen scrollTo(0,0) al montar.
- ✅ **HEIC/HEIF soporte** — Fotos de iPhone aceptadas en upload.
- ✅ **Funnel links fotos** — Links individuales por foto en admin/funnel.
- ✅ **Stat cumpleaños** — Dashboard admin muestra "🎂 Cumpleaños hoy" con conteo semanal.
- ✅ **FabSpeedDial fixes** — Toast fixed, modal portal, backdrop fade, blur flash fix.
- ✅ **Impact logo fallback** — Círculo con inicial cuando no hay logoUrl.

## Completado (15-16 Mayo 2026)

- ✅ **DemoBanner** — Banner glassmorphism fijo en todas las vistas (Impact, Premium, Lista). Pill "DEMO" con tooltip i, texto "Tu carta está lista", botones "Ver panel" + "Activar →" (gradient amber). paddingTop 70px en vistas.
- ✅ **Página /activar/[slug]** — Landing de activación para restaurantes demo. Diseño dark con radial glows amber. Secciones: hero + iPhone preview animado + offer card con flecha + venues reales + benefits "Después de activar" + comparación 3 planes con tooltips + CTA final. Responsive desktop.
- ✅ **iPhone preview animado** — Mini carta estilo Lista dentro de mockup iPhone. Hero rotativo (3 platos cada 3s con dots), nav categorías, 3 dish cards con fotos reales, estrella destacada, destellos amber de fondo.
- ✅ **API /api/activar/trial** — Endpoint que activa trial: FREE quita isDemo, GOLD da 7 días trial, PREMIUM da 30 días trial ($4.900 primer mes). Cambia plan + subscriptionStatus + trialEndsAt.
- ✅ **Offer card con descuento** — $4.900 primer mes Premium (90% dcto), precio tachado $49.900, badge -90%.
- ✅ **Venues social proof** — Hand Roll, Horus Vegan, Alleria Pizza, Nascosto Pizzeria con logos reales y badge de plan.
- ✅ **Benefits section** — 4 cards con iconos: multiidioma, vistas, estadísticas, cumpleaños. Diseño highlight con glow amber.
- ✅ **Planes con tooltips** — Gratis/Gold/Premium diferenciados visualmente. Tooltips "i" en cada feature. Gold con borde amber sutil.
- ✅ **ViewSelector light mode** — Trigger button con fondo negro semi-transparente + blur en light mode (como campanita garzón). Icono cambiado de Menu a LayoutGrid.
- ✅ **FabSpeedDial sin backdrop oscuro** — Quitado el overlay negro al abrir la lámpara.
- ✅ **DemoBanner en page.tsx** — Renderizado una sola vez desde page.tsx para todas las vistas, no dentro de cada vista.
- ✅ **DemoPlanModal** — Componente wrapper para escuchar show-plan-modal (ya no se usa, reemplazado por /activar).

## Pendientes

### Prioridad alta

1. **Onboarding demo (tour spotlight)** — Primera vez que el dueño entra a su carta demo, mostrar 3-4 toasts/spotlights explicando: "Este es tu menú", "Aquí cambian las vistas", "El Genio reordena según cada cliente", "Activa para publicarla".

2. **Panel Demo** — Vista /panel con isDemo flag mostrando stats fake (visitas, platos más vistos) para que el dueño vea el valor antes de activar.

3. **Mejorar diseño de email** — El email actual es funcional pero básico. Mejorar template con preview de la carta, QR, y CTA más atractivo.

4. **Flujo de activación desde demo** — Cuando el dueño viene de /subircarta y activa su carta:
   - Las fotos de Unsplash deben marcarse como "referenciales" o invitar al dueño a subir las propias
   - Definir si se mantienen las fotos Unsplash en la carta real o se quitan
   - El dueño debería poder subir sus propias fotos desde /panel
   - Considerar watermark o badge "foto referencial" en las fotos Unsplash

### Prioridad media

4. **Modo DOCUMENT (PDF/Word)** — Similar a PHOTO pero con extracción de texto del documento. Flujo:
   - Extraer texto del PDF/Word
   - Enviar a Claude para estructurar
   - Fotos de Unsplash como referencial

4. **n8n/Make seguimiento** — Webhook en creación de lead para CRM. Secuencia de seguimiento para leads que no activan. WhatsApp para los que dejaron teléfono.

5. **Procesamiento manual** — Botón "Reprocesar" en admin funnel para leads FAILED. Botón "Procesar manual" que lleva a /agregarlocal con URL pre-llenada.

6. **Gourmedia extractor dedicado** — WooCommerce con JS rendering. Posiblemente parsear JSON del API de WooCommerce si el sitio lo expone.

### Prioridad baja

7. **Pexels como fallback de fotos** — API gratuita 200/hora sin aprobación (vs Unsplash 50/hora demo). Usar cuando Unsplash falla por rate limit. API key: se obtiene en pexels.com/api. Endpoint similar: `https://api.pexels.com/v1/search?query=sushi+food&per_page=1`.

8. **Más proveedores** — Agregar según demanda: TheFork, Rappi, PedidosYa, iFood.

8. **Admin funnel mejoras** — Filtros por estado/proveedor, búsqueda, paginación, filtro FAILED.

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
