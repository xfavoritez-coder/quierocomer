# ADR-003: Merge de GuestProfile anonimo con QRUser registrado

**Fecha**: Abril 2026
**Estado**: Implementado

## Contexto

La mayoria de comensales usan QuieroComer sin registrarse (fantasmas). Generan datos valiosos: que platos miran, cuanto tiempo, que vista prefieren, que dieta tienen. Cuando eventualmente se registran (email), necesitamos vincular todo su historial previo con su cuenta nueva.

El problema tecnico: el fantasma se identifica por un `quierocomer_guest_id` en localStorage. El registrado se identifica por `qr_user_id` (cookie). Son dos identidades separadas.

## Decision

### Identidad persistente
- Generar `quierocomer_guest_id` (UUID) en localStorage al primer visit
- Respaldarlo en cookie de 365 dias (sobrevive limpieza de localStorage)
- Migrar automaticamente desde el viejo `sessionStorage.qr_session_id`
- Crear `GuestProfile` en BD con este ID al primer evento

### Merge al registrarse
Cuando un fantasma se registra como QRUser:
1. Tomar su `guestId` actual del body del request
2. Actualizar `GuestProfile.linkedQrUserId` → nuevo QRUser.id
3. Backfill `qrUserId` en todos los `StatEvent` de ese guestId
4. Backfill `qrUserId` en todas las `Session` de ese guestId
5. Todo es retroactivo — el historial completo queda vinculado

### Campos duales en tracking
`StatEvent` y `Session` tienen ambos campos:
- `guestId` (FK a GuestProfile) — siempre presente
- `qrUserId` (FK a QRUser) — solo si esta registrado

Queries pueden filtrar por cualquiera de los dos.

## Consecuencias

**Positivas:**
- Cero data perdida al registrarse
- El dueno ve el historial completo del cliente
- Conversion fantasma → registrado es transparente
- El fantasma mantiene su experiencia personalizada sin registro

**Negativas:**
- Dos campos de identidad en cada evento (guestId + qrUserId) — mas indices
- El merge es un UPDATE masivo (puede ser lento si hay muchos eventos)
- Si el usuario borra localStorage Y cookies, pierde su identidad (nuevo UUID)
- Multiples dispositivos generan multiples GuestProfiles (no se cruzan)

## Alternativas consideradas

1. **Solo cookie de session**: descartado porque se pierde al cerrar pestana (sessionStorage original).
2. **Fingerprinting de browser**: descartado por privacidad y fiabilidad variable.
3. **Forzar registro antes de usar**: descartado porque mata la conversion — nadie se registra antes de ver la carta.
4. **No hacer merge, solo vincular hacia adelante**: descartado porque se pierde todo el historial pre-registro, que es el mas valioso.
