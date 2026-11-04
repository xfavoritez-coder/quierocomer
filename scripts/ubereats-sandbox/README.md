# Uber Eats — sandbox (test store)

Scripts para preparar y probar la integración de pedidos de Uber Eats en el
**sandbox**, antes de pasar a producción. Base: `https://test-api.uber.com`.

## Requisitos (local)
En `.env.local` (o exportadas en el shell) deben estar las credenciales de la app
de integración (las mismas que en Vercel):

```
UBEREATS_CLIENT_ID=ZuK38JJ376td-n5jB315c_zNQn38Lawe
UBEREATS_CLIENT_SECRET=...   # del dashboard de Uber (Setup)
```

> Están en Vercel para que funcione el webhook en prod; acá se necesitan **también
> en `.env.local`** solo para correr estos scripts desde tu máquina.

## Pasos (cuando Uber responda con el `store_id`)

1. **Verificar OAuth**
   ```bash
   node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs token
   ```
   Debe decir "Access token OK". Si falla, revisar el CLIENT_SECRET.

2. **Ver la tienda de prueba** (confirma que el id es válido y ver sus campos)
   ```bash
   node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs info <store_id>
   ```

3. **Subir el menú dummy** (para que la tienda sea "ordenable")
   ```bash
   node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs menu <store_id>
   ```
   Si la API devuelve un error de formato, ajustar `dummy-menu.json` según el
   mensaje (y borrar el campo `__notas__`). El menú es desechable; solo sirve para
   poder colocar un pedido de prueba.

4. **Abrir la tienda** (ONLINE)
   ```bash
   node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs open <store_id>
   ```

5. **Mapear el `store_id` en el admin**: `/admin/locales → Kojo Recoleta → Uber Eats`
   → activar + pegar el `store_id`.

6. **Colocar un pedido de prueba** desde la app de Uber Eats con una **cuenta de
   test**, poniendo como dirección de entrega la **dirección de la test store**
   (Dardignac 68, Recoleta). Uber dispara `orders.notification` a nuestro webhook
   (`/api/ubereats/webhook`) → se crea el pedido en el POS.

## Qué validar con el pedido de prueba
- Que el pedido **aparece en el POS** (board del Centro de pedidos), etiquetado
  "Uber Eats" y como pagado.
- El **factor del monto (CLP)**: si los precios salen ×100 o /100, ajustar en
  `src/lib/ubereats/ingest.ts` (función `money`) y en el menú.
- Los **nombres de los campos** del payload (cliente, ítems, modificadores): si
  algo no mapea, ajustar `src/lib/ubereats/ingest.ts`.

## Después del sandbox
Cuando el pedido de prueba se vea bien en el POS:
1. **Verify Integration** en el dashboard de Uber.
2. Crear la **Prod App**, conectar la tienda real de Kojo Recoleta.
3. En Vercel: `UBEREATS_ENV=production` (cambia los hosts a `api.uber.com` /
   `login.uber.com`).
