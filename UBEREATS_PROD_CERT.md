# Uber Eats — Certificación y paso a Producción

Estado y checklist de la integración directa Uber Eats ↔ QuieroComer POS (Eats Marketplace,
Orders API). Reemplaza a Toteat para los pedidos de Uber. Última actualización: **2026-11-20**.

---

## 1. Estado actual (2026-11-20)

**Solicitud de producción ENVIADA** — esperando aprobación de Uber (Partner Engineering).

Stepper de la app de producción en el dashboard de Uber:

| Paso | Estado |
|------|--------|
| Application Created | ✅ |
| Organization Linked | ✅ |
| Legal Agreement(s) Signed | ✅ |
| **Production Access Requested** | ✅ (enviada 2026-11-20) |
| **Production Access Granted** | ⏳ *Your scope request is being verified* |

Cuando Uber apruebe, el paso "Production Access Granted" se pone verde y se habilita generar el
**Access Token** y el **Client Secret de producción**.

---

## 2. Datos de las apps en el Uber Developer Dashboard

Cuenta: el dashboard tiene 2 organizaciones de QuieroComer + la de Hand Roll (Uber Direct, aparte).

### App SANDBOX / test (la que se usó para certificar)
- **Organización:** `QuieroComer` (TEST ORG) — org id `94f018aa-a14a-499c-9fdb-102ad7f034d6`
- **App:** `QuieroComer POS` — API Suite **Eats Marketplace**
- **Client ID (sandbox):** `ZuK38JJ376td-n5jB315c_zNQn38Lawe`
- **Test store id:** `1308c127-b53e-435b-8199-52b1acd9c3ef`
- Hosts: `test-api.uber.com` + `sandbox-login.uber.com`

### App PRODUCCIÓN (creada vía "Move To Production" el 2026-11-20)
- **Organización (prod):** `QuieroComer` — org id `5fa00ce7-2216-49ea-9c85-3124c4afbae8`
  - Dirección: Emilio Vaisse 760, dpto 2703, Ñuñoa, Santiago, Chile
  - Email de contacto: alfredomoralesw580@gmail.com
- **App:** `QuieroComer POS` — API Suite **Eats Marketplace**
- **Client ID (producción):** `0_4FRanMFwKviidxuzp87cSRmYfuhQa8`
- **Client Secret (producción):** ⏳ *generar cuando Uber otorgue el acceso*
- **NDA "Eats NDA 2024":** ✅ firmado 2026-11-20 18:29 por alfredomoralesw580@gmail.com
- **OAuth Grant Type:** `Client Credential` · **Auth:** `Client Secret`
- Hosts: `api.uber.com` + `login.uber.com`

---

## 3. APIs ejercidas en sandbox (evidencia de certificación)

Todas devolvieron 2xx contra la test store; visibles en **Dashboard → Analytics** (pico 2026-11-19/20).
Verificación de Uber = self-service: revisan esos logs de llamadas, no hay reunión agendada.

| Área | Llamadas |
|------|----------|
| Store | GET detalles, GET status, SET status (online/paused), GET holiday-hours, GET `pos_data` |
| Menu | GET menú, **PUT** `/v2/eats/stores/{}/menus` (categorías, ítems, modificadores, precios) |
| Orders | webhook `orders.notification` → `getOrder` (v2) → inyección idempotente en POS |
| Orders | **Accept** (`accept_pos_order`, con `pickup_time` + `fields_relayed`) |
| Orders | **Deny** (`deny_pos_order`, body `{reason:{code,explanation}}`) |
| Orders | **Cancel** (`/v1/eats/orders/{}/cancel`) → ciclo CREATED→ACCEPTED→CANCELED verificado |
| Webhooks | `orders.notification` y `orders.cancel` (cancelación del comercio desde el Manager, verificada en vivo) |
| Integration Config | GET `pos_data` |

---

## 4. Cuando Uber APRUEBE — pasos del lado de Uber

1. En la app de producción → **Access Token**: generar el **Client Secret de producción**.
2. **Setup → Webhooks** de la app de producción: registrar la URL del webhook productivo
   `https://quierocomer.com/api/ubereats/webhook` y copiar el **Webhook Signing Key** de prod.
3. Confirmar los **scopes** concedidos (ver §6) para setear `UBEREATS_SCOPES` sin romper el token.

## 5. Cuando Uber APRUEBE — cambios del lado de QuieroComer (código/infra)

Toda la lógica ya está lista; es solo cambiar credenciales y entorno. El switch de host es automático
por `UBEREATS_ENV` (ver `src/lib/ubereats/client.ts`).

### Env en Vercel (producción)
| Variable | Valor prod |
|----------|------------|
| `UBEREATS_ENV` | `production` ← flip de host (api.uber.com + login.uber.com) |
| `UBEREATS_CLIENT_ID` | `0_4FRanMFwKviidxuzp87cSRmYfuhQa8` |
| `UBEREATS_CLIENT_SECRET` | *(secret de prod generado en paso 4.1)* |
| `UBEREATS_WEBHOOK_SIGNING_KEY` | *(signing key de prod del paso 4.2)* |
| `UBEREATS_SCOPES` | según lo concedido (ver §6) |

### Por local (admin)
- `ecommerceConfig.ubereats.enabled = true` y `ecommerceConfig.ubereats.storeId = <store id REAL de prod>`
  para cada local que opere con Uber Eats (el storeId de prod lo da Uber al dar de alta la tienda real).
- Config POS: `uberEatsAutoAccept` (Centro de pedidos → Pedidos) y tiempo "Repartidor"
  (`ecommerceStoreConfig.waitTimeDriver`) que alimenta el `pickup_time` del accept.

---

## 6. Scopes (ojo: pedir uno NO concedido rompe TODO el token con 400 invalid_scope)

- Default mínimo en código: `eats.store eats.order` (getOrder + accept/deny).
- Escritura verificada en sandbox 2026-11-20:
  - store toggle → `eats.store.status.write`
  - "listo"/reparto PROPIO → `eats.store.orders.restaurantdelivery.status`
    (NO `..restaurant_delivery`; en **Delivery-by-Uber** no hay "marcar listo" → la prep se fija al aceptar)
- Setear `UBEREATS_SCOPES` solo con lo efectivamente concedido en prod, p. ej.:
  `eats.store eats.order eats.store.status.write eats.store.orders.restaurantdelivery.status`

---

## 7. Notas

- `pos_provisioning` es scope de **Authorization Code**, NO se necesita para el flujo de pedidos
  (que es `client_credentials`).
- Paths Order API (verificados empíricamente, hay mezcla de versiones): `getOrder` v2 singular,
  acciones v1 plural. Los `/v1/delivery/orders/...` de la guía dan 404 (son del suite Delivery BYOC).
- Captura de depuración del webhook: flag PlatformSetting `ubereats_webhook_debug` = "1".
- Alerta Delifast "no asigna motoristas" NO aplica a pedidos Uber (excluidos del check del board).
