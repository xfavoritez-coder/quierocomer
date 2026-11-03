# Delifast → POS worker

Proceso siempre-encendido que escucha el **Pusher de Delifast** y, por cada
`cambio-estado`, hace `POST` a `/api/pos/delivery-status` del POS para mover el
estado del pedido (`En Camino → out_for_delivery`, `Entregada → delivered`).

No corre en Vercel (es un websocket persistente). Va en **Railway / Fly.io /
Render / un VPS**.

## Variables de entorno

| Var | Qué es |
|---|---|
| `DELIFAST_WEBHOOK_SECRET` | **Igual** al secreto seteado en Vercel. |
| `QC_ENDPOINT` | `https://quierocomer.com/api/pos/delivery-status` (default). |
| `DELIFAST_CHANNELS` | JSON canal→restaurantId. Ej: `{"local-335":"cmvcjbx090001jn074i0eg9zu"}` |
| `DELIFAST_PUSHER_KEY` | `dc0518c6de20140ed532` (default). |
| `DELIFAST_PUSHER_CLUSTER` | `us2` (default). |

> `local-335` = Kojo Recoleta. Para La Florida: entra a su panel Delifast, abre
> la consola y corre `window.Pusher.instances[0].channels.channels` para ver su
> `local-<id>`, y agrégalo al JSON.

## Correr local

```bash
cd workers/delifast-pusher
cp .env.example .env     # edita el secreto
npm install
node --env-file=.env index.js
```

## Desplegar en Railway (lo más simple)

1. Nuevo proyecto → Deploy from GitHub → este repo, **Root Directory** =
   `workers/delifast-pusher`.
2. En Variables, pega las del `.env.example` con tus valores reales.
3. Deploy. Railway detecta Node y corre `npm start`.

## Desplegar en Fly.io

```bash
cd workers/delifast-pusher
fly launch --no-deploy        # genera fly.toml (sin puertos; es un worker)
fly secrets set DELIFAST_WEBHOOK_SECRET=... DELIFAST_CHANNELS='{"local-335":"..."}'
fly deploy
```

## Verificar

En los logs deberías ver:
```
[subscribed] local-335 -> cmvcjbx090001jn074i0eg9zu
[cambio-estado] local-335 {"id_venta":"312651","cliente":"Camilo Soto","nuevo_estado":"En Camino"}
[forward] cmvcjbx... "En Camino" -> 200 {"ok":true,"matched":true,...}
```
