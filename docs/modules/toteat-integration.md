# Modulo: Integracion con Toteat

Toteat es el POS (punto de venta) que usan algunos locales de QuieroComer. Conectarse a su API nos permite cruzar lo que pasa en la carta digital (vistas, sesiones, tiempos en detalle) con lo que pasa en la caja (ventas reales). Eso destraba features que ningun competidor ofrece: badges basados en ventas, comparacion vista vs venta, dashboard live, y mas.

> Esta integracion fue construida en Mayo 2026 para Horus Vegan como cliente piloto. Toda la base esta disenada para escalar a multiples locales con cero codigo nuevo — solo configuracion.

## Onboarding de un nuevo local con Toteat

Para conectar un nuevo local, el cliente debe pedirle a Toteat las credenciales API. Toteat les entrega:
- `ID de usuario API` (ej: 1002)
- `Token` (string aleatorio de 32 chars)
- `ID Restaurant` (numero grande de Toteat)
- `ID Local` (1, 2, 3... segun cuantos locales tenga)
- Ambiente (PROD o DEV)

Una vez que tienes las 4 credenciales:

1. **Llenar los campos en `Restaurant` via Prisma o admin UI**:
   - `toteatRestaurantId` (xir)
   - `toteatLocalId` (xil, integer)
   - `toteatUserId` (xiu, integer)
   - `toteatApiToken` (xapitoken)
2. **Backfill de ventas historicas**: `npx tsx scripts/backfill-toteat.ts` (chunkea en bloques de 14 dias por el limite de la API). El backfill arranca desde el dia que el local empezo a usar QC, asi nunca tenemos data sin cruzar.
3. **Auto-mapear platos**: en `/panel/menus → tab Toteat`, click "Auto-mapear". Cruza por nombre normalizado y guarda `Dish.toteatProductId`. Lo que no matchee, se mapea manualmente desde el panel (incluye un input para escribir el codigo a mano si `/products` no lo expone).
4. **Listo** — cron diario actualiza incrementalmente cada 30 min.

## Endpoints Toteat que usamos

| Endpoint | Para que |
|----------|----------|
| `/sales` | Cron incremental cada 30 min + backfill |
| `/products` | Catalogo completo para mapeo manual / dropdown |

Ambos viven detras de `https://api.toteat.com/mw/or/1.0/` (PROD) o `https://apidev.toteat.com/mw/or/1.0/` (DEV).

## Auth de Toteat (querystring)

Todos los endpoints usan los mismos query params:
```
?xir={restaurantId}&xil={localId}&xiu={userId}&xapitoken={token}
```

Los nombres de los params en su documentacion son `xir/xil/xiu/xapitoken` (no se llaman como uno esperaria). Si te dice `Not Authorized`, casi siempre es que les estas mandando otros nombres.

Limites a recordar:
- Rate limit: **3 requests por minuto** por token. Importante en backfills — el script espera 25s entre chunks.
- `/sales` cap de **15 dias** por query. Por eso chunkeamos en bloques de 14 dias.
- Los timestamps son **UTC sin sufijo Z** (engano facil — siempre convertir a Chile via `parseToteatDate` y `chileHourOf`).

## Arquitectura local

### Tablas

```
Restaurant
  toteatRestaurantId, toteatLocalId, toteatUserId, toteatApiToken
  toteatLastSyncAt   ← actualizado por el cron en cada corrida

Dish
  toteatProductId   ← codigo Toteat tipo "HV0010"
  toteatMappedAt
  toteatMappedBy    ← "auto" | "manual"

ToteatSale            ← cache de ventas
  toteatOrderId (unique), restaurantId, dateOpen, dateClosed,
  total, payed, gratuity, subtotal, taxes,
  numberClients, toteatTableId, toteatTableName, waiterName,
  paymentMethod, fiscalType,
  rawJson           ← payload completo para extraer campos en el futuro

ToteatSaleProduct     ← items de cada ToteatSale
  toteatProductId, productName, hierarchyName,
  quantity, netPrice, payed, taxes, discounts

BadgeSnapshot         ← snapshot de que platos tienen badge POPULAR/RECOMMENDED
  capturado cada 30 min para analisis retroactivo
```

### Modulos en `src/lib/toteat/`

| Archivo | Funcion |
|---------|---------|
| `fetchSales.ts` | GET `/sales` con cache in-memory de 30s, rate-limit aware |
| `fetchProducts.ts` | GET `/products` con cache de 5 min |
| `sync.ts` | `syncRestaurantSales()` — upsert de ventas, idempotente por toteatOrderId, fetch chunked si rango > 15d |
| `mapping.ts` | `autoMapRestaurantDishes()`, `getToteatProductCatalog()`, similitud por nombre normalizado |
| `timezone.ts` | `parseToteatDate`, `chileTodayYYYYMMDD`, `chileHourOf`, `chileStartOfTodayUTC` |

### Endpoints internos

| Path | Que hace | Quien |
|------|----------|------|
| `/api/cron/toteat-sync` | Sync incremental para todos los locales con credenciales | Vercel cron c/30 min |
| `/api/cron/badge-snapshot` | Snapshot de badges actuales | Vercel cron c/30 min |
| `/api/admin/toteat/sync-now` | Sync manual on-demand | Admin UI |
| `/api/admin/dishes/auto-map-toteat` | Auto-map de platos | Boton en panel |
| `/api/admin/dishes/[id]/map-toteat` | Map manual single dish | Panel |
| `/api/admin/dishes/toteat-status` | Estado del mapeo + suggestions | Panel UI |
| `/api/admin/analytics/carta-vs-caja` | Cross QC views vs Toteat sales | `/panel/analytics` |
| `/api/admin/live` | Datos en tiempo real | `/panel/live` |
| `/api/toteat/sales-today` | Datos hoy (cache local + fallback live) | Pagina `/toteat` debug |
| `/api/toteat/cross-today` | Cruce hoy carta vs caja | `/toteat` debug |
| `/api/toteat/badge-accuracy` | Acierto de badges hoy | `/toteat` debug |

## Crons configurados (vercel.json)

```json
{ "path": "/api/cron/toteat-sync",     "schedule": "*/30 * * * *" }
{ "path": "/api/cron/badge-snapshot",  "schedule": "*/30 * * * *" }
```

Ambos requieren header `Authorization: Bearer ${CRON_SECRET}`. Vercel lo manda automaticamente. Para tests manuales:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/toteat-sync
```

## Politica de fechas: nunca pre-QC

El cron y el script de backfill **clamp from-date al primer Session de QC** del local. Toteat puede tener anos de historia, pero nosotros solo cacheamos desde que la carta digital empezo a usarse. Razon: las analiticas cruzadas (vistas vs ventas) no tienen sentido para fechas pre-QC, y `% conversion` se rompe (sales > 0, qcViews = 0).

## Logica del badge "🔥 Top hoy"

Una sola badge unificada con doble fuente automatica:

```
1. ¿hay ≥5 unidades vendidas HOY via Toteat?
   ├─ SI  → top vendidos hoy (mapeo Dish.toteatProductId → ToteatSaleProduct)
   └─ NO  → fallback a algoritmo de vistas QC (rolling 48h)
```

Maximo 10 badges global, max 2 por categoria. El usuario nunca ve cual fuente se uso — solo el badge. El owner ve el detalle en `/panel/analytics`.

## Sort en carta "Lo mas pedido" (planificado en 1.2)

Logica adaptativa:
```
1. ¿hoy ≥5 unidades vendidas?         → ordena por hoy
2. ¿ultimos 7 dias ≥20 unidades?       → ordena por 7 dias
3. Sin data                           → opcion no aparece en select
```

## Que viene

- **1.2** Sort selector en carta (chip al lado del search)
- **1.5** Acierto de badges en `/panel/analytics` (usa BadgeSnapshot historico)
- **Futuro** Mas locales: solo agregar credenciales a `Restaurant` y correr backfill, todo lo demas es automatico

## Troubleshooting comun

**`{"ok": false, "msg": {"texto": "Not Authorized"}}` con 200 OK**
- Endpoint reachable, auth incorrecta. Verifica que mandaste `xir/xil/xiu/xapitoken` (no otros nombres).

**`{"msg":"Too many requests, rate limit exceeded: 3 per 1 minute"}` con 429**
- Esperar 60s. El cache in-memory de 30s normalmente lo evita.

**Hour 02:00 con $400k en ventas**
- Bug de timezone: estas parseando como Chile cuando Toteat manda UTC. Usar `parseToteatDate` (asume UTC) y `chileHourOf` para bucketing.

**Plato sin mapear pero existe en Toteat (ej HV0230)**
- `/products?activeProducts=true` no lo devuelve aunque este en la carta. Usar el toggle "✎ Codigo" en el panel y escribir el codigo a mano.

**Tabla `ToteatSale` esta vacia en produccion**
- Verificar que `CRON_SECRET` esta seteado en Vercel y que el cron en el dashboard de Vercel esta corriendo. Si no, dispararlo manualmente desde Vercel UI o via curl con el header.

**Ventas pre-QC en el cache**
- Si por error syncearon dias antes del primer Session, hacer `prisma.toteatSale.deleteMany({where: {restaurantId, dateClosed: {lt: firstSession.startedAt}}})`.
