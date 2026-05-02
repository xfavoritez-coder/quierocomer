# Modulo: Genio Marketing

Modulo premium que convierte los datos del Genio en ingresos para los locales. Extiende el tracking existente con segmentacion, promociones IA, y email marketing.

## Estado actual

| Componente | Estado |
|-----------|--------|
| GuestProfile (fantasma persistente) | ✅ Implementado |
| Session tracking con dwell times | ✅ Implementado |
| Merge fantasma → registrado | ✅ Implementado |
| Weather + timeOfDay en eventos | ✅ Implementado |
| Dashboard admin con metricas | ✅ Implementado |
| Admin multi-tenant (owner vs superadmin) | ✅ Implementado |
| Cron diario (cleanup + snapshots) | ✅ Implementado |
| Segmentos automaticos | 🚧 Siguiente fase |
| Campanias de email | 🚧 Planificado |
| Promociones generadas por IA | 🚧 Planificado |
| Promos in-app para fantasmas | 🚧 Planificado |

## Dos tipos de usuarios

### Registrados (oro)
Tienen email vinculado. Se pueden contactar directamente. Todo su historial esta asociado a su identidad. Son el target de email marketing.

### Fantasmas (plata)
No estan registrados pero tienen un `quierocomer_guest_id` persistente en localStorage + cookie 365 dias. El sistema los reconoce cuando vuelven. Saben sus gustos pero no su identidad. Son data agregada para el dueno.

**Metrica clave**: conversion fantasma → registrado. Cuando se registran, todo su historial pasa a ser marketeable.

## Datos que se capturan

### Del Genio (ya existe)
- Dieta, restricciones, dislikes
- Platos aceptados y rechazados
- Local y hora de cada interaccion

### De la sesion (ya implementado)
- Top platos vistos con tiempo acumulado (dwell)
- Categorias donde paso mas tiempo
- Si abrio detalle de plato
- Si termino activo o se fue (abandoned)
- Que vista eligio (Lista/Clasica/Espacial)
- Dispositivo (mobile/tablet/desktop)

### Contextuales (ya implementado)
- Clima (temperatura, condicion via Open-Meteo)
- Dia y hora (franja: morning/lunch/afternoon/dinner/late)
- Primera visita o recurrente (visitCount en GuestProfile)

## Fases de rollout

### Fase 1 — Infraestructura de captura ✅
GuestProfile, Session tracking, merge, weather, cron.

### Fase 2 — Dashboard admin ✅
Metricas reales por local: visitas, conversion, engagement, platos top, dietas.

### Fase 3 — Dashboard del dueno 🚧
El dueno ve su dashboard al loguearse:
- Visitantes semana
- Segmentos automaticos ("40 vegetarianos", "30 amantes del picante")
- Gaps platos vistos vs pedidos
- Promos activas

### Fase 4 — Generador de promos con IA 🚧
Claude analiza la carta, margenes, clima y sugiere promos:
- "Va a llover 3 dias. Sugiere combo sopa + postre"
- "40 vegetarianos potenciales. Sugiere combo vegano"
- "Tu ceviche se mira mucho pero se pide poco. 15% off martes"

El dueno aprueba con un click.

### Fase 5 — Email marketing 🚧
Segmentacion automatica, max 1 email/semana, personalizado por gustos, triggers automaticos (clima, dia, temporada).

### Fase 6 — Promos in-app para fantasmas 🚧
Cuando un fantasma vuelve, la app muestra promos relevantes para su perfil sin email.

## Estrategia de conversion fantasma → registrado

3 momentos para pedir registro:
1. **Post-Genio**: "Tu carta ya esta lista — guarda tus preferencias para tu proxima visita"
2. **Visitas repetidas**: "Te interesa este plato. Te avisamos cuando este en promo"
3. **Promo personalizada**: "Desbloquea una oferta basada en tus gustos"

## Precio propuesto

- 2 UF/mes (<200 visitas)
- 4 UF/mes (>200 visitas)
- Incluye: dashboard, segmentos, 4 emails/mes, promos IA ilimitadas

## Tablas pendientes de crear

- `Campaign` — campanias de email/push
- `CampaignRecipient` — envios individuales con tracking
- `Segment` — segmentos de clientes guardados
- `AutomationRule` — triggers automaticos (cumpleanos, inactividad)
- `EmailTemplate` — plantillas de email
- `GenioInsight` — insights generados por IA

## Ideas futuras

1. **Insights de competencia cruzada**: si hay varios locales del mismo tipo (sushi, pizza), Claude compara métricas agregadas entre ellos. "Tu tasa de abandono es 40% vs 25% promedio de locales similares". Requiere que owners autoricen compartir data agregada.

2. **Push notification al owner**: cuando el Genio detecta algo urgente (ej: tasa de abandono sube 50% vs semana pasada), enviar push notification al celular del dueño. Requiere implementar web push para owners (similar al garzon).

3. **A/B testing en automatizaciones**: para triggers como bienvenida o inactividad, crear 2 versiones del email y enviar aleatoriamente. Trackear cuál tiene mejor tasa de apertura/clic. Después de N envíos, elegir ganador automáticamente.
