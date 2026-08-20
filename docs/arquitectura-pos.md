# Arquitectura POS QuieroComer — Etapa 1

## Decisiones tomadas

### 1. IndexedDB con Dexie.js v4
- Base: `pos_quierocomer` (singleton en `src/lib/pos/db.ts`)
- Tablas locales: events, accounts, items, rounds, payments, cashSessions, posTables, staff, devices, products, syncQueue, snapshots
- `EntityTable<T>` de Dexie 4 para tipado fuerte
- `posTables` en vez de `tables` para evitar colisión con propiedad interna de Dexie

### 2. Event sourcing
- Cada mutación genera un `PosEvent` inmutable con UUID v4 generado en cliente
- Tipos v1: `account_opened`, `round_sent`, `item_voided`, `item_updated`, `payment_recorded`, `account_closed`, `account_voided`, `cash_session_opened`, `cash_session_closed`
- Las proyecciones son **incrementales**: cada evento se aplica al estado actual via reducer (`projectEvent`)
- `rebuildFromEvents()` disponible para reconstrucción completa (recovery / carga inicial)
- Nunca se edita el estado directamente — siempre via evento

### 3. Sync con Supabase
- **Push**: cola `syncQueue` → batch upsert idempotente a `pos_events` (unique en `event_id`)
- **Pull**: cursor por `server_seq` (BIGSERIAL autoincremental del servidor)
- **Realtime**: suscripción a `postgres_changes` en `pos_events` filtrada por `restaurant_id`
- **Conflictos**: eventos aditivos, sin last-write-wins. Dos garzones = dos eventos válidos
- **Ciclo**: cada 5s, push → pull. En paralelo, Realtime para inmediatez

### 4. PWA / Service Worker
- SW manual registrado solo en `/pos` (scope: `/pos`) — no usa Serwist globalmente para no interferir con carta QR / admin
- Estrategia: network-first para navegación, stale-while-revalidate para assets estáticos
- APIs/Supabase: network-only (el sync engine maneja offline)
- Manifest en `/pos/manifest.json`, instalable como app standalone

### 5. Estructura de archivos

```
src/
├── lib/pos/
│   ├── types.ts      — tipos del dominio (eventos, proyecciones, payloads)
│   ├── db.ts         — Dexie database (IndexedDB)
│   ├── events.ts     — event sourcing (crear eventos + projecciones)
│   ├── sync.ts       — push/pull + Supabase Realtime
│   ├── hooks.ts      — React hooks (useOnlineStatus, usePosSync, etc.)
│   ├── index.ts      — barrel export
│   └── sql/
│       └── 001_pos_events.sql  — DDL para Supabase (ejecutar manualmente)
├── app/pos/
│   ├── layout.tsx    — layout del POS (metadata, viewport, SW)
│   ├── page.tsx      — UI de prueba (Etapa 1)
│   └── PosServiceWorker.tsx  — registro del SW
public/pos/
├── manifest.json     — Web App Manifest
└── sw.js             — Service Worker
```

### 6. Modelo de datos Supabase

```sql
pos_events (
  server_seq  BIGSERIAL PK,
  event_id    UUID UNIQUE,
  device_id   TEXT,
  user_id     TEXT,
  restaurant_id TEXT FK → restaurants,
  created_at_local TIMESTAMPTZ,
  type        TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)
```

Realtime habilitado. RLS abierto temporalmente (se ajustará con auth de staff).

## Pendiente para siguientes etapas
- Snapshots diarios (estructura lista en `db.ts`, lógica al implementar caja en Etapa 6)
- Catálogo compartido (Etapa 2): cache de `products` desde Prisma/Supabase existente
- Puente de impresión (Etapa 3): `/print-bridge` standalone
