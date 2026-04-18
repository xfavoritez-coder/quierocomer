# QuieroComer

Plataforma de cartas QR inteligentes para restaurantes en Chile. Cada local obtiene una carta digital con recomendaciones personalizadas por IA, llamada al garzon sin hardware, y estadisticas de comportamiento de sus clientes.

## Quien lo hace

Proyecto de Jaime (Santiago, Chile). Producto B2B2C: se vende al restaurante, lo usa el comensal.

## Stack

- **Framework**: Next.js 16 + React 19 (App Router)
- **BD**: PostgreSQL en Supabase, ORM Prisma 6
- **Styling**: Tailwind CSS v4
- **Email**: Resend
- **Clima**: Open-Meteo (gratis, sin API key)
- **Push**: web-push para notificaciones al garzon
- **Deploy**: Vercel
- **QR**: qrcode + qrcode.react

## Como correr local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local
# Llenar DATABASE_URL, DIRECT_URL, ADMIN_EMAIL, ADMIN_PASSWORD

# Generar cliente Prisma
npx prisma generate

# Sincronizar schema con BD
npx prisma db push

# Iniciar dev server
npm run dev
```

## Comandos utiles

| Comando | Que hace |
|---------|----------|
| `npm run dev` | Dev server en localhost:3000 |
| `npm run build` | Build de produccion (genera Prisma + Next.js) |
| `npx prisma db push` | Sincroniza schema con BD sin migraciones |
| `npx prisma generate` | Regenera el cliente Prisma |
| `npx prisma studio` | UI visual para explorar la BD |

## Variables de entorno

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Si | PostgreSQL direct connection |
| `ADMIN_EMAIL` | Si | Email del superadmin |
| `ADMIN_PASSWORD` | Si | Password del superadmin |
| `RESEND_API_KEY` | No | Para emails de verificacion y marketing |
| `FROM_EMAIL` | No | Remitente de emails (default: noreply@quierocomer.cl) |
| `NEXT_PUBLIC_APP_URL` | No | URL base (default: https://quierocomer.cl) |
| `CRON_SECRET` | No | Secret para proteger cron jobs en produccion |

## Estructura de carpetas

```
src/
  app/
    (main)/           # Landing, explorar, perfil, admin
    api/              # API routes
    qr/               # Carta QR publica
  components/
    qr/
      carta/          # 3 vistas de la carta (Lista, Clasica, Espacial)
      genio/          # Motor de recomendacion
      garzon/         # Sistema de llamada al garzon
      capture/        # Banners de captura (cumpleanos, etc)
      auth/           # Login/perfil del comensal
  lib/
    admin/            # Hook de sesion admin
    qr/               # Queries y utils del modulo QR
    guestId.ts        # Identidad persistente de visitantes
    sessionTracker.ts # Tracking de comportamiento por sesion
    weather.ts        # API de clima
    prisma.ts         # Cliente Prisma singleton
```
