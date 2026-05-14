# Plan completo — Funnel /subircarta QuieroComer

## Resumen

Funnel de captación de dueños de restaurantes. El dueño sube su carta (link, PDF o foto), el sistema la analiza, y le entrega una propuesta de Carta Viva. El lead queda registrado para seguimiento comercial.

---

## Ya construido

### Tablas en Prisma (db push sincronizado)

- **MenuProvider** — catálogo de proveedores de carta QR. Campos: `name`, `domainPatterns[]`, `htmlSignatures[]`, `status` (SUPPORTED/IN_RESEARCH/UNKNOWN), `extractionConfig` (Json), `notes`. Relación 1:N con Lead.
- **Lead** — prospecto del funnel. Datos del dueño (`localName`, `ownerName`, `email`, `whatsapp` nullable), origen de la carta (`cartaType`: LINK/DOCUMENT/PHOTO, `cartaUrl`, `cartaFileUrl`), `detectedProviderId`, `cartaStatus` (default PENDING), `activated` (default false), `convertedToOwnerId`.

### Flujo modo LINK — funciona de punta a punta

Paso 1 pega link → crea Lead → detección de proveedor (dominio + fetch HTML para firmas) → paso 2 (barra animada ~6.5s, formulario inline) → completa el mismo Lead → confirmación placeholder.

### Seed de MenuProvider — 4 proveedores cargados

| Proveedor | domainPatterns | htmlSignatures | Detección |
|-----------|---------------|----------------|-----------|
| Justo | justo.cl, pedir.justo.cl, menu.justo.cl | getjusto.com, tofuu.getjusto.com, pide.getjusto.com | Dominio propio del restaurante → fetch HTML → detecta firmas de Justo |
| Fudo | fu.do, menu.fu.do | fu.do | Por dominio directo |
| Gourmedia | gour.media | gour.media | Por dominio directo |
| Mercat | kojo.cl, mercat.cl | mer-cat.com, cdn.mer-cat.com | Dominio propio → fetch HTML → detecta CDN de Mercat |

### Detección de proveedor — dos pasos

1. Comparar hostname contra `domainPatterns` (instantáneo)
2. Si no hay match → fetch primeros 100KB del HTML → buscar `htmlSignatures` de cada proveedor (timeout 6s)

---

## Pendientes en orden

### Paso 2 — Normalización de WhatsApp a E.164

- Instalar `libphonenumber-js`
- Normalizar el whatsapp a formato E.164 (ej: `+56912345678`), país default CL
- Aplicar en frontend (antes de enviar) y backend (validación)
- Si es inválido → guardar null. No bloquear el envío por WhatsApp mal escrito (campo opcional)
- Aviso suave en UI: "No pudimos validar este número, se guardará sin WhatsApp"

### Paso 3 — Modos DOCUMENT y PHOTO (Supabase Storage)

- Configurar bucket en Supabase Storage (permisos, tamaño máximo)
- Upload directo desde browser con signed URL (evitar proxy por el servidor para archivos de 10MB)
- El dueño sube PDF/Word/Excel o foto → archivo a Storage → URL en `cartaFileUrl`
- Estos modos NO pasan por detección de proveedor (solo LINK la usa)
- Se montan sobre el flujo ya funcionando: crear Lead → paso 2 → completar datos
- `cartaType` se guarda como DOCUMENT o PHOTO según corresponda

### Paso 4 — Protección contra spam y duplicados

- Rate limit por IP en `POST /api/subircarta` (ej: max 5 leads por IP por hora)
- Detección de leads duplicados por `cartaUrl`: si alguien pega el mismo link, reusar el lead existente si no fue completado, o crear uno nuevo si ya tiene datos
- No es urgente mientras no esté público, pero debe estar antes del lanzamiento

### Paso 5 — Analytics del funnel

- Trackear cada paso del funnel para medir fricción:
  - `step1At`: timestamp cuando se crea el lead (ya existe como `createdAt`)
  - `step2At`: timestamp cuando llega al paso 2 (nuevo campo o StatEvent)
  - `completedAt`: timestamp cuando completa el formulario
  - `abandonedStep`: si se fue, en qué paso
- Alternativa liviana: usar `StatEvent` existente con tipos nuevos (FUNNEL_STEP1, FUNNEL_STEP2, FUNNEL_COMPLETE)
- Dashboard mínimo en /panel para ver conversión del funnel

### Paso 6 — Procesamiento real de la carta

Es asíncrono, corre en backend después de que el dueño se va. Se divide en dos sub-pasos:

#### 6a — Camino "proveedor conocido" (SUPPORTED)

- Escribir el primer adaptador real para un proveedor concreto (Justo es el mejor candidato: HTML público, muchos restaurantes en Chile)
- Aplicar `extractionConfig` del MenuProvider → extraer platos, categorías, precios
- Generar la carta viva y marcar `cartaStatus: READY`
- Esto da un flujo completo de verdad: dueño pega link → lead → carta procesada → entregada

#### 6b — Camino "proveedor desconocido" (IN_RESEARCH/UNKNOWN)

- Disparar un agente IA que investiga cómo extraer los datos de ese proveedor
- El agente propone un adaptador de extracción
- El resultado queda en una bandeja de aprobación para revisión humana (~1 minuto: comparar precios/categorías contra la carta real)
- Si se aprueba → se guarda como MenuProvider SUPPORTED con su `extractionConfig` → queda automático para siempre
- El agente IA puede orquestarse con n8n/Make
- Los adaptadores aprobados viven en el backend Next.js/Prisma

#### Avance de cartaStatus

`PENDING` → `PROCESSING` → `READY` → `DELIVERED`

### Paso 7 — Página de confirmación / paso 3 + correos

- Diseño final de la confirmación, con información contextual:
  - Si proveedor SUPPORTED → "Tu carta estará lista en minutos"
  - Si IN_RESEARCH/UNKNOWN → "Estamos analizando tu carta, te avisamos cuando esté lista"
- Correo de entrega con el link a la carta viva
- Correo distinto para proveedor desconocido ("es primera vez que vemos tu proveedor, la espera vale la pena")
- Copy de tiempo siempre elástico, nunca prometer minutos exactos

### Paso 8 — n8n/Make — seguimiento de ventas

- Webhook fire-and-forget desde `POST /api/subircarta` para notificar a n8n en tiempo real (sin esperar respuesta)
- Registrar lead en CRM/planilla
- Secuencia de seguimiento automática
- Notificaciones internas al equipo
- Disparos de reactivación para leads que no completaron
- El campo `activated` guía a quién perseguir
- WhatsApp personalizado a quienes dejaron teléfono, email a quienes no

---

## Arquitectura de archivos

```
prisma/schema.prisma          → Lead, MenuProvider, enums
src/app/subircarta/
  page.tsx                    → Paso 1 (server component)
  SubirCartaClient.tsx        → Paso 1 (client, React real)
  paso2/
    page.tsx                  → Paso 2 (server component)
    Paso2Client.tsx           → Paso 2 (client, animación + form)
  confirmacion/
    page.tsx                  → Confirmación placeholder
src/app/api/subircarta/
  route.ts                    → POST: crear lead + detectar proveedor
  [id]/route.ts               → GET: fetch lead, PATCH: completar lead
```

---

## Decisiones tomadas

- Un solo registro Lead por funnel (se crea en paso 1, se completa en paso 2)
- Detección de proveedor en dos pasos: dominio primero, HTML fetch si no hay match
- `htmlSignatures` agregado a MenuProvider para detectar proveedores cuando el restaurante usa dominio propio
- Upload de archivos con signed URL directo a Supabase (no proxy por el server)
- WhatsApp opcional, nunca bloquea el flujo
- `cartaStatus` avanza asincrónicamente, independiente del flujo del usuario
