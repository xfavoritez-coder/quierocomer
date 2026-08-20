# POS QuieroComer — Plan Maestro v1

**Fecha:** Agosto 2026
**Estado:** Planificación cerrada, listo para desarrollo
**Laboratorio:** Restaurante propio de Jaime
**Hardware de pruebas:** Impresora térmica Xprinter 80mm Ethernet (ya comprada)

### Decisiones cerradas (20 agosto 2026)
- **Mixed content:** el puente de impresión también sirve el POS en LAN (todo HTTP, sin problemas de browser). Vercel queda como acceso remoto/fallback.
- **Garzones:** tabla separada `pos_staff` (nombre + PIN hasheado + rol, sin email, ligada al restaurante). No se extiende `users`.
- **Ruta:** el POS vive en `/pos` dentro del mismo repo y app Next.js.
- **Snapshots:** se implementan desde Etapa 1 — al cerrar caja se persiste estado materializado para no reconstruir desde todos los eventos históricos.
- **Proyecciones:** incrementales en IndexedDB (reducer aplica evento nuevo al estado actual), rebuild completo solo en carga inicial o inconsistencia.
- **PWA:** usar Serwist (no next-pwa, que está deprecado), con scope limitado a `/pos`.
- **Empaquetado puente:** Node SEA o @yao-pkg/pkg (pkg original está muerto).
- **Redondeo CLP:** a $10, el último pagador absorbe la diferencia.
- **PIN:** rate limiting local (5 intentos → bloqueo 60s) + timeout 2min en dispositivos compartidos.

---

## 1. Visión

Un POS gastronómico 100% web, offline-first, integrado al ecosistema QuieroComer (Carta QR, Genio, Loyalty, Food Cost). Diferenciador clave: **catálogo único compartido con la Carta QR** — el restaurante mantiene su menú una sola vez y sirve para la carta digital, el Genio y el POS.

Principio rector de UX: *dedos apurados, cero ambigüedad, máximo 2 toques para lo frecuente.* Se usa a las 21:30 con el local lleno.

## 2. Alcance v1

**Incluye:**
- Mapa de mesas con estados y cuentas abiertas
- Toma de pedidos: pantalla touch en salón + celular de garzón (responsivo, un solo código)
- Flujos: salón (mesa), mostrador, retiro
- Impresión de comandas a cocina/barra vía puente ESC/POS TCP 9100
- Cobro: todos los medios de pago (registro manual del medio), división por ítems, división en partes iguales, pagos mixtos, propina sugerida 10% editable
- Cierre de caja: apertura con monto inicial, arqueo, resumen por medio de pago, reporte imprimible
- Identificación: sesión persistente en celular personal; PIN de 4 dígitos en dispositivos compartidos para acciones sensibles (enviar pedido, cobrar, anular)
- Offline-first completo: operación total sin internet externo

**Fuera de v1 (anotado en arquitectura, no construido):**
- Delivery (direcciones, repartidores, integraciones apps)
- Pantalla de cocina (KDS)
- Boleta electrónica SII (se sigue usando boletera actual en paralelo)
- Integración de pago Transbank (el voucher va por la máquina de siempre)
- Inventario en tiempo real (el Food Cost usa modelo periódico, ya definido)

## 3. Modelo operacional

**Entidad central: la Cuenta** (comanda madre). Todo flujo es una cuenta:

- **Mesa:** se abre al sentarse el cliente, acumula rondas de pedidos de distintos garzones, se cierra con uno o varios pagos.
- **Mostrador:** cuenta que se abre y cierra en el momento.
- **Retiro:** mostrador + nombre del cliente + hora de retiro.
- **Delivery (v2):** cuenta + dirección + estado de entrega. El modelo lo soporta desde el día uno.

**Ciclo de vida de una cuenta:**
`abierta → con pedidos enviados → cuenta pedida → pagada parcial → cerrada`
(anulación posible en cualquier estado previo a cerrada, con registro de quién anula)

**Rondas:** cada "Enviar a cocina" genera una ronda. La comanda impresa incluye solo los ítems nuevos de esa ronda, nunca lo ya enviado.

**División de cuenta:** dos modos combinables:
1. Por ítems (se marcan los ítems que paga cada persona, quedan en gris al pagarse)
2. En partes iguales (entre N personas)
Cada pago parcial elige su medio; la cuenta muestra saldo restante hasta llegar a cero. Pagos mixtos permitidos (ej: mitad tarjeta, mitad efectivo).

## 4. Módulos y pantallas

### 4.1 Mapa de mesas (home del salón)
- Grilla de mesas editable (el dueño dibuja su salón una vez en configuración)
- Estados por color: libre / ocupada / pedido en cocina / cuenta pedida
- Cada mesa muestra: total acumulado + tiempo abierta
- 1 toque = entra a la cuenta
- Accesos directos arriba: "Mostrador" y "Retiro" (abren cuenta al vuelo)

### 4.2 Comandero (toma de pedidos)
- Categorías a la izquierda (desktop/touch) o abajo (celular)
- Productos en grilla grande, foto opcional
- Toque = agrega · toque largo = modificadores ("sin cebolla", agregados con precio)
- Notas libres para cocina por ítem
- Botón gigante "Enviar a cocina" → imprime comanda de la ronda
- Catálogo: el mismo de la Carta QR (productos, categorías, modificadores, precios)

### 4.3 Cobro
- Cuenta completa visible, números grandes, contraste alto (se lee a un metro, apurado)
- Tres caminos: "Pagar todo" / "Dividir por ítems" / "Dividir en partes"
- Propina sugerida 10%, editable o eliminable
- Medios: efectivo, tarjeta (débito/crédito), transferencia, apps de pago — registro manual del medio en v1

### 4.4 Caja
- Apertura con monto inicial
- Resumen del día por medio de pago
- Arqueo: contado vs. esperado, diferencia visible sin esconderla
- Cierre con reporte imprimible en la térmica
- Sin gráficos ni analytics (eso vive en el admin QuieroComer)

### 4.5 Configuración
- Editor de mapa de mesas
- Gestión de usuarios/garzones y PINs
- Impresoras: IP, puerto, asignación por zona (cocina/barra) — v1 parte con una
- Parámetros: propina sugerida, moneda, datos del local

## 5. Diseño visual

- **Tema claro tipo Landing v4:** blanco + amber, estándar Apple/Linear
- Excepción funcional: cobro y caja con números grandes y contraste alto
- Tipografía y componentes consistentes con el resto del ecosistema QuieroComer
- Touch targets mínimo 44px; botones de acción principal sobredimensionados

---

## 6. Arquitectura técnica

### 6.1 Stack
- **Frontend:** Next.js + TypeScript + Tailwind (PWA)
- **Local:** IndexedDB (vía Dexie.js) como fuente de verdad inmediata
- **Backend:** Supabase (PostgreSQL) como fuente de verdad consolidada
- **Sync:** cola de eventos con push/pull incremental
- **Impresión:** puente local ESC/POS → TCP 9100 (universal: Xprinter, Epson, etc.)
- **Deploy:** Vercel (app) + puente instalable en PC del local

### 6.2 Offline-first (PWA)
- Service Worker cachea app completa + catálogo + mapa de mesas
- Sin internet externo: tomar pedidos, imprimir comandas, cobrar, cerrar cuentas y caja — todo funciona
- La red local (WiFi del local) basta para POS ↔ puente ↔ impresora
- Indicador de estado de conexión visible pero no invasivo (punto de color en header)

### 6.3 Event sourcing (el corazón del sistema)
Cada acción es un **evento inmutable** con:
- `event_id` (UUID generado en el dispositivo)
- `device_id`, `user_id`, `timestamp` local
- `type` (cuenta_abierta, ronda_enviada, item_anulado, pago_registrado, cuenta_cerrada, caja_abierta, caja_cerrada…)
- `payload` (datos del evento)

Reglas:
1. Los eventos se escriben primero en IndexedDB y se encolan para sync
2. El servidor los recibe con upsert idempotente por `event_id` → si el internet vuelve a medias y se reenvía, no se duplica nada
3. El estado (cuenta, caja) se **deriva** de los eventos, nunca se edita directo
4. Conflictos multi-dispositivo: dos garzones agregando a la misma mesa = dos eventos que se suman, no se pisan. No hay "última escritura gana" sobre la cuenta.
5. Anulaciones = evento nuevo que revierte, nunca borrado. Trazabilidad total (quién, cuándo, qué).

### 6.4 Puente de impresión
- Servicio pequeño (Node.js empaquetado como ejecutable de doble clic para Windows/Mac, o corriendo en cualquier equipo del local)
- Expone HTTP local (ej: `http://IP-DEL-PC:7777/print`)
- Recibe JSON con la comanda → la convierte a comandos ESC/POS → la manda por TCP 9100 a la impresora
- Cola local con reintentos: si la impresora está ocupada o sin papel, reintenta y avisa al POS
- Universal: funciona con Xprinter, Epson y cualquier térmica de red ESC/POS
- Futuro (v1.x): modo directo Epson ePOS como optimización para locales con Epson moderna

### 6.5 Modelo de datos (tablas principales)

**Compartidas con el ecosistema (ya existen o se extienden):**
- `restaurants`, `products`, `categories`, `modifiers`

**Nuevas del POS:**
- `pos_events` — el log de eventos (fuente de verdad)
- `pos_accounts` — cuentas (proyección derivada: estado, tipo, mesa, totales)
- `pos_rounds` — rondas enviadas a cocina
- `pos_account_items` — ítems con modificadores, notas, estado (activo/anulado)
- `pos_payments` — pagos (monto, medio, propina, división)
- `pos_cash_sessions` — sesiones de caja (apertura, cierre, arqueo)
- `pos_tables` — mesas y layout del salón
- `pos_users` — garzones, PINs (hasheados), roles
- `pos_devices` — dispositivos registrados

En IndexedDB viven espejos locales de todas + la cola `sync_queue`.

### 6.6 Identificación y permisos
- Celular personal: login persistente (tipo WhatsApp), todo queda a nombre del garzón
- Dispositivo compartido: PIN 4 dígitos en acciones sensibles (enviar, cobrar, anular)
- Roles v1: admin (todo) / garzón (operar, no configurar ni ver caja completa)

---

## 7. Roadmap de desarrollo

| Etapa | Entregable | Criterio de éxito |
|-------|-----------|-------------------|
| 1 | Fundación: modelo de datos + event sourcing + PWA offline | Eventos se crean offline y sincronizan sin duplicar |
| 2 | Comandero + catálogo compartido | Tomar un pedido completo con modificadores desde celular y touch |
| 3 | Puente de impresión | Comanda real sale en la Xprinter, con y sin internet externo |
| 4 | Mapa de mesas + ciclo de cuenta | Servicio completo de una mesa: abrir → rondas → cerrar |
| 5 | Cobro + división | Dividir cuenta por ítems y partes, pagos mixtos, propina |
| 6 | Caja + PINs + configuración | Día completo de operación real en el restaurante de Jaime |

**Prueba de fuego:** operar el restaurante propio un mes completo solo con el POS (boletera actual en paralelo) antes de mostrar a pilotos.

---

## 8. Prompts para Claude Code

> Uso: un prompt por etapa, en orden. Cada etapa termina con criterio de éxito verificable antes de pasar a la siguiente. Ajusta rutas/nombres a tu repo real (c:/proyectos/quierocomer o repo nuevo según decidas).

### Prompt Etapa 1 — Fundación offline-first

```
Estoy construyendo un POS gastronómico web offline-first para mi plataforma QuieroComer
(Next.js + TypeScript + Tailwind + Supabase + Vercel). Esta es la Etapa 1: la fundación.

QUÉ CONSTRUIR:
1. PWA: configura Service Worker (next-pwa o serwist) para que la app completa funcione
   sin conexión tras la primera carga. Manifest, íconos, instalable.
2. Capa local: IndexedDB con Dexie.js. Tablas locales: accounts, account_items, rounds,
   payments, cash_sessions, tables, users, devices, products_cache, sync_queue.
3. Event sourcing: toda mutación del dominio se registra como evento inmutable:
   { event_id: uuid v4 generado en cliente, device_id, user_id, created_at_local,
     type, payload }.
   Tipos v1: account_opened, round_sent, item_voided, payment_recorded, account_closed,
   cash_session_opened, cash_session_closed.
   El estado de cuentas/caja se DERIVA de los eventos con funciones puras de proyección
   (reducers). Nunca se edita el estado directamente.
4. Sync con Supabase: tabla pos_events con unique constraint en event_id.
   Push: la sync_queue envía eventos pendientes en batch cuando hay conexión
   (upsert idempotente: reenviar no duplica). Pull: eventos de otros dispositivos
   del mismo restaurante (por restaurant_id + cursor de secuencia del servidor).
   Al recibir eventos remotos, se re-proyecta el estado local.
5. Conflictos: los eventos se SUMAN (dos garzones agregando a la misma mesa = dos
   eventos válidos). Sin last-write-wins sobre entidades.
6. Indicador de conexión: hook useOnlineStatus + punto de color discreto en el header.

CRITERIO DE ÉXITO (debo poder probarlo yo):
- Abro la app, corto el internet, creo eventos (usa una UI mínima de prueba), cierro
  y reabro el navegador: los eventos persisten.
- Vuelve el internet: sincronizan solos. Los reviso en Supabase.
- Simulo reenvío del mismo batch: cero duplicados.
- Dos navegadores distintos convergen al mismo estado.

Escribe tests de las proyecciones y del ciclo push/pull idempotente.
Documenta en /docs/arquitectura-pos.md las decisiones tomadas.
```

### Prompt Etapa 2 — Comandero + catálogo compartido

```
Etapa 2 del POS QuieroComer. La fundación offline/event-sourcing ya existe (léela antes
de partir: /docs/arquitectura-pos.md).

QUÉ CONSTRUIR:
1. Catálogo compartido: el POS consume el MISMO catálogo de la Carta QR
   (products, categories, modifiers de mi Supabase existente — revisa el esquema actual
   y NO dupliques tablas). Se cachea completo en IndexedDB (products_cache) y se
   refresca cuando hay conexión.
2. Pantalla Comandero, responsiva con un solo código:
   - Desktop/touch: categorías en columna izquierda, productos en grilla grande.
   - Celular: categorías como tabs horizontales abajo, productos apilados.
   - Toque en producto = agrega 1 unidad. Toque largo (o botón ⋯) = modal de
     modificadores (opciones con y sin precio extra) + nota libre para cocina.
   - Panel de pedido actual: ítems, cantidades, subtotal, editar/quitar antes de enviar.
   - Botón principal sobredimensionado "Enviar a cocina": genera evento round_sent con
     SOLO los ítems nuevos de esta ronda.
3. Diseño: tema claro, blanco + amber (sigue el sistema visual de mi landing v4),
   nivel Apple/Linear. Touch targets ≥44px. Sin decoración innecesaria: esto se usa
   con el local lleno.

CRITERIO DE ÉXITO:
- Desde un celular y desde una pantalla grande tomo un pedido completo con
  modificadores y notas, offline, y queda registrado como ronda.
- El pedido de prueba usa el catálogo real de mi restaurante (el de la Carta QR).
```

### Prompt Etapa 3 — Puente de impresión ESC/POS

```
Etapa 3 del POS QuieroComer: impresión de comandas. Tengo una Xprinter 80mm con
Ethernet en la red local del restaurante.

QUÉ CONSTRUIR:
1. Puente de impresión: servicio Node.js standalone (carpeta /print-bridge del repo):
   - Servidor HTTP local (puerto 7777, configurable) con endpoint POST /print.
   - Recibe JSON de comanda → renderiza a ESC/POS (usa una librería como
     escpos o node-thermal-printer, elige la mejor mantenida) → envía por TCP
     al puerto 9100 de la IP de la impresora (configurable en config.json).
   - Cola local con reintentos exponenciales; endpoint GET /status para que el POS
     consulte salud del puente y de la impresora.
   - CORS habilitado solo para el origen del POS.
   - Empaquetado como ejecutable doble-clic para Windows (pkg o equivalente actual)
     + instrucciones de instalación en README.
2. Formato de comanda (80mm, fuente grande y legible en cocina):
   - Cabecera: MESA X / MOSTRADOR / RETIRO nombre — hora — garzón
   - Ítems de la ronda con cantidad, modificadores indentados, notas destacadas
   - Nº de ronda y nº de cuenta corto
3. Integración en el POS: al enviar ronda, POST al puente. Si el puente no responde,
   el POS muestra alerta clara y deja la comanda en cola de reimpresión manual
   (botón "Reimprimir" en la cuenta).
4. Configuración en el POS: IP del puente, IP de la impresora, botón "Imprimir prueba".

CRITERIO DE ÉXITO:
- Envío una ronda desde el celular y la comanda sale en la Xprinter.
- Corto el internet EXTERNO (no el WiFi local): sigue imprimiendo.
- Apago la impresora, envío, la enciendo: la comanda sale sola (reintentos).
```

### Prompt Etapa 4 — Mapa de mesas + ciclo de cuenta

```
Etapa 4 del POS QuieroComer. Ya existen: fundación offline, comandero, impresión.

QUÉ CONSTRUIR:
1. Mapa de mesas (pantalla home):
   - Grilla de mesas con estado por color: libre (neutro) / ocupada (amber suave) /
     pedido en cocina (amber pleno) / cuenta pedida (destacado).
   - Cada mesa: número, total acumulado, tiempo abierta (mm o hh:mm).
   - 1 toque = abre la cuenta de esa mesa (nueva si estaba libre → evento
     account_opened tipo "mesa").
   - Header con accesos "Mostrador" y "Retiro": abren cuenta al vuelo (retiro pide
     nombre y hora opcional).
2. Editor de layout en Configuración: agregar/quitar/renombrar mesas, arrastrarlas en
   una grilla simple. Persistido y sincronizado.
3. Vista de cuenta: rondas enviadas (agrupadas), ítems con estado, botón "Agregar
   pedido" (vuelve al comandero sobre esa cuenta), "Pedir cuenta" (cambia estado),
   anulación de ítem (evento item_voided con motivo y usuario).
4. Multi-dispositivo en vivo: si dos dispositivos operan la misma mesa, ambos ven
   las rondas del otro tras el sync (y en tiempo real vía Supabase Realtime cuando
   hay conexión; con polling de cola como fallback).

CRITERIO DE ÉXITO:
- Servicio completo: abro mesa desde el touch, agrego ronda desde un celular,
  ambas comandas salen impresas, la mesa refleja el total y el tiempo en ambos
  dispositivos.
```

### Prompt Etapa 5 — Cobro + división de cuenta

```
Etapa 5 del POS QuieroComer: el cobro. Es la pantalla más crítica: números grandes,
contraste alto, se lee a un metro de distancia con apuro.

QUÉ CONSTRUIR:
1. Pantalla de cobro de una cuenta:
   - Total, ítems, propina sugerida 10% (editable en monto o %, eliminable).
   - Tres caminos: "Pagar todo" / "Dividir por ítems" / "Dividir en partes iguales".
2. Dividir por ítems: se tocan los ítems que paga esta persona → subtotal parcial →
   se elige medio de pago → evento payment_recorded → ítems pagados quedan en gris.
   Repetible hasta saldo cero.
3. Dividir en partes: entre N personas → muestra monto por persona → cada parte se
   registra con su medio. Maneja el redondeo del último pago (ajusta centenas).
4. Pagos mixtos: una misma división puede pagarse con 2+ medios (ej: 20.000 efectivo
   + resto tarjeta).
5. Medios v1: efectivo (con calculadora de vuelto), débito, crédito, transferencia,
   app de pago. Solo registro del medio: el voucher va por la máquina externa.
6. Al llegar a saldo cero: evento account_closed, la mesa vuelve a libre, opción de
   imprimir pre-cuenta/detalle en la térmica.

CRITERIO DE ÉXITO:
- Cierro una cuenta de 4 personas: 2 pagan sus ítems por separado, los otros 2
  dividen el resto en partes iguales, uno paga mixto. Saldo llega a cero exacto,
  la caja registra cada pago con su medio, todo offline.
```

### Prompt Etapa 6 — Caja + PINs + cierre del círculo

```
Etapa 6, final de la v1 del POS QuieroComer.

QUÉ CONSTRUIR:
1. Caja:
   - Apertura de sesión con monto inicial (evento cash_session_opened).
   - Durante el día: total por medio de pago, propinas, cuentas cerradas.
   - Cierre con arqueo: monto contado vs. esperado por medio, diferencia VISIBLE
     (nunca ocultarla ni auto-cuadrarla), nota opcional. Evento cash_session_closed.
   - Reporte de cierre imprimible en la térmica.
   - Regla: no se puede cerrar caja con cuentas abiertas (o exige confirmación
     explícita listándolas).
2. Usuarios y PINs:
   - Gestión de garzones en Configuración: nombre, PIN 4 dígitos (hasheado), rol
     admin/garzón.
   - Celular personal: login persistente, no vuelve a pedir nada.
   - Dispositivo compartido (marcado como "compartido" en config): modal de PIN
     rápido antes de enviar ronda, cobrar o anular. El evento queda firmado con
     ese user_id.
3. Pulido final v1:
   - Revisión de todos los flujos en celular real y pantalla touch.
   - Estados vacíos, errores de red y de impresora con mensajes humanos y accionables.
   - Auditoría simple en admin: log de anulaciones (quién, qué, cuándo, motivo).

CRITERIO DE ÉXITO (la prueba de fuego):
- Un día completo de operación real en mi restaurante solo con el POS:
  apertura de caja, servicio de almuerzo y cena, cierres de cuenta variados,
  arqueo final cuadrado. La boletera actual corre en paralelo por fuera.
```

---

## 9. Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Mixed content / red local desde HTTPS | El puente expone HTTP en red local; si el navegador bloquea, opciones: servir POS también vía puente en LAN, o certificado local. Resolver en Etapa 3 con la impresora real en mano. |
| WiFi del local inestable | El puente y el POS reintentan; cola de reimpresión manual siempre visible. |
| Robo hormiga / anulaciones | Event sourcing + PIN + log de auditoría: nada se borra, todo queda firmado. |
| Scope creep (delivery, KDS, SII) | Este documento es el contrato de v1. Todo lo demás es v2 y se anota, no se construye. |
| Confiabilidad en servicio | Un mes de operación en restaurante propio antes de cualquier piloto externo. |

---

*Documento vivo: actualizar al cerrar cada etapa con decisiones tomadas y aprendizajes.*
