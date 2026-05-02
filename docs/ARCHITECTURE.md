# Arquitectura

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Backend | Next.js API Routes (serverless) |
| BD | PostgreSQL (Supabase) |
| ORM | Prisma 6 |
| Email | Resend |
| Clima | Open-Meteo (gratis) |
| Push | web-push |
| Deploy | Vercel |
| Cron | Vercel Cron (8 AM diario) |

## Estructura de carpetas

```
src/app/
  (main)/                # Rutas publicas y admin
    admin/               # Panel admin (layout + pages)
    page.tsx             # Landing principal (explorar)
    perfil/              # Perfil de usuario
  api/
    admin/               # Login, me, dashboard, owners, logout
    qr/                  # Stats, user (register/me/verify), sessions, banner
    cron/                # Job diario
  qr/
    [slug]/              # Carta publica de cada restaurante
    page.tsx             # Landing de venta (/qr)

src/components/qr/
  carta/                 # Las 3 vistas + router + seleccion
    CartaRouter.tsx      # Monta la vista activa, transiciones
    CartaPremium.tsx     # Vista Clasica
    CartaLista.tsx       # Vista Lista
    CartaViaje.tsx       # Vista Espacial
    ViewSelector.tsx     # Selector de vistas (pill flotante)
    DishDetail.tsx       # Modal de detalle de plato
    CategoryNav.tsx      # Navbar de categorias
    HeroDish.tsx         # Hero banner con plato destacado
  genio/
    GenioOnboarding.tsx  # Flujo completo del Genio (5 pasos + resultado)
  garzon/
    WaiterButton.tsx     # Boton de llamada al garzon
  capture/
    BirthdayBanner.tsx   # Banner de captura de cumpleanos
    BirthdayModal.tsx    # Modal de cumpleanos (reutilizable)
    PostGenioCapture.tsx # Captura post-onboarding del Genio

src/lib/
  prisma.ts              # Singleton Prisma client
  guestId.ts             # Identidad persistente (localStorage + cookie)
  sessionTracker.ts      # Tracking de comportamiento por sesion
  weather.ts             # API Open-Meteo
  admin/
    useAdminSession.ts   # Hook de sesion admin multi-tenant
```

## Flujo de auth

### Comensal (QRUser)
```
1. Entra a /qr/[slug] (anonimo)
2. Se genera quierocomer_guest_id (localStorage + cookie 365d)
3. GuestProfile se crea automaticamente en primer StatEvent
4. Si se registra (email):
   - Se crea QRUser
   - Cookie qr_user_id (365d)
   - Se linkea GuestProfile.linkedQrUserId
   - Se backfillean StatEvents y Sessions con qrUserId
5. Magic link por email para verificacion
```

### Admin (Owner / Superadmin)
```
1. Entra a /admin/login
2. Si es ADMIN_EMAIL + ADMIN_PASSWORD → superadmin
3. Si es email de RestaurantOwner → verifica bcrypt
4. Se setean cookies: admin_token (httpOnly 7d), admin_role, admin_id
5. useAdminSession() en el layout verifica via /api/admin/me
6. Superadmin ve todos los locales, owner ve solo los suyos
```

## Flujo de tracking

```
Comensal entra a /qr/[slug]
  → CartaRouter monta → startSession()
  → guestId se genera/recupera
  → SESSION_START event → /api/qr/stats
  → GuestProfile upsert automatico
  → weather + timeOfDay se llenan

Mientras navega:
  → DISH_VIEW, CATEGORY_VIEW (individuales)
  → DISH_DWELL (si >3s en un plato)
  → CARTA_VIEW_SELECTED (al cambiar vista)
  → sessionTracker acumula dwell times

Al cerrar (inactividad 30s, tab close, navigate away):
  → closeSession() envia resumen via sendBeacon
  → /api/qr/sessions/close crea Session record
  → SESSION_END event
```

## Cron jobs

| Job | Schedule | Que hace |
|-----|----------|----------|
| `/api/cron/diario` | 8 AM UTC diario | Marca sesiones abandonadas (>1h sin end), actualiza lastSeenAt, limpia magic tokens expirados, snapshot diario en CronLog |

## Convenciones

- Archivos de componente en PascalCase: `CartaViaje.tsx`
- API routes en kebab-case: `api/qr/user/magic-link`
- Hooks con prefijo `use`: `useCartaView`, `useAdminSession`
- CSS en componentes: inline styles o Tailwind, CSS-in-JS via `<style>` tags para componentes complejos (CartaViaje)
- Prisma: `db push` para desarrollo, sin migraciones formales por ahora
- No hay tests automatizados (deuda tecnica reconocida)
