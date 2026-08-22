# Sistema de diseño — POS QuieroComer

**Handoff para Claude Code.** Aplicar a TODAS las pantallas del POS: las que ya existen (refactorizar) y las que vengan. Referencia visual: `pos-design.html` (4 pantallas navegables).

---

## 0. Cómo usar este documento

1. Copia el bloque de tokens (sección 2) tal cual a tu CSS global / `globals.css` o al tema de Tailwind.
2. Refactoriza las pantallas existentes (Inicio y Comandero) para que usen estos tokens y componentes.
3. Construye Cobro y Caja siguiendo las secciones 4 y 5.
4. La **regla de oro** de la sección 3.1 es lo que hace que todo se sienta un solo sistema. Respétala sin excepción.

No inventar acentos nuevos, no volver a headers oscuros, no mezclar familias tipográficas fuera de las dos definidas.

---

## 1. Principio rector

Se usa a las 21:30 con el local lleno, en celular y en pantalla touch, por gente apurada. Por lo tanto:

- **Máximo 2 toques para lo frecuente.**
- **Legibilidad a un metro de distancia** en Cobro y Caja (números grandes, alto contraste).
- **Cero ambigüedad de estado**: el color y la posición dicen qué pasa, no hace falta leer.
- **Calma**: superficie clara, una sola familia de acento. El POS es una herramienta de precisión, no una landing.

---

## 2. Design tokens (pegar tal cual)

```css
:root{
  /* COLOR */
  --bg:#F5F4F1;            /* fondo, paper cálido */
  --surface:#FFFFFF;       /* tarjetas, barras */
  --sunk:#FAF9F7;          /* superficies hundidas (rieles, footers) */
  --ink:#1B1A17;           /* texto primario, casi negro cálido */
  --ink-2:#6E6B64;         /* texto secundario */
  --ink-3:#A19D94;         /* texto terciario / deshabilitado */
  --line:#EAE8E2;          /* bordes, divisores */
  --line-strong:#DCD9D1;   /* bordes en hover / dashed */

  --amber:#DE7C00;         /* ACENTO. Solo acción primaria, estado activo, totales */
  --amber-press:#B86500;   /* hover/pressed del acento y texto ámbar sobre claro */
  --amber-tint:#FBEED6;    /* relleno suave (chips activos) */
  --amber-tint-2:#FDF7EC;  /* relleno muy suave (fondos seleccionados) */

  --jade:#2F8F6B;          /* estado positivo: libre, pagado, cuadrado */
  --jade-tint:#E7F1EC;
  --slate:#3B6FB0;         /* neutro informativo: chips mostrador/retiro */
  --slate-tint:#EAF0F8;

  /* FORMA */
  --r-card:16px;           /* tarjetas, tickets, contenedores */
  --r-btn:12px;            /* botones */
  --r-chip:999px;          /* chips, segmented, pills */
  --sh-1:0 1px 2px rgba(27,26,23,.04), 0 1px 3px rgba(27,26,23,.03);  /* reposo */
  --sh-2:0 2px 4px rgba(27,26,23,.05), 0 6px 16px rgba(27,26,23,.06);  /* hover/elevado */

  /* TIPOGRAFÍA */
  --sans:'Inter',system-ui,sans-serif;   /* PALABRAS */
  --mono:'IBM Plex Mono',monospace;       /* NÚMEROS + etiquetas-dato */
}
```

Fuentes (Google Fonts):
```
Inter: 400, 500, 600, 700
IBM Plex Mono: 400, 500, 600
```

---

## 3. Fundamentos

### 3.1 Regla de oro — palabras vs. números

Esta es la firma del sistema y no se rompe nunca:

- **Palabras → Inter** (`--sans`): nombres de plato, nombres de cuenta, botones, etiquetas de acción, textos.
- **Números y datos → IBM Plex Mono** (`--mono`) con `font-variant-numeric: tabular-nums`: precios, totales, montos, cantidades (`6 ítems`, `2×`), horas (`21:34`, `42 min`), contadores (`Pago 2 de 4`), y las etiquetas-eyebrow en mayúscula (`CUENTAS ABIERTAS`, `PEDIDO ACTUAL`, `TOTAL`).

Regla simple: **si es un número o un dato de sistema, va en mono. Si es lenguaje humano, va en Inter.**

### 3.2 Uso del ámbar (`--amber`)

El ámbar es caro porque se usa poco. Solo aparece en:
1. La **acción primaria** de cada pantalla (un botón ámbar sólido por vista, no más).
2. El **estado activo**: categoría seleccionada, cuenta con consumo, método de pago elegido.
3. Los **totales y precios** (texto ámbar `--amber-press` sobre claro).

NO usar ámbar para: bordes decorativos, fondos de sección, íconos genéricos, textos largos.

### 3.3 Escala tipográfica

| Uso | Familia | Tamaño | Peso |
|-----|---------|--------|------|
| Total grande (saldo, caja) | mono | 28–30px | 600 |
| Total de cuenta (ticket) | mono | 19–22px | 600 |
| Título de pantalla | sans | 15–16px | 700 |
| Nombre de cuenta / plato | sans | 14–15px | 600 |
| Precio de producto | mono | 13px | 600 |
| Botón | sans | 14–15px | 600 |
| Cuerpo / método | sans | 13–14px | 500–600 |
| Meta-dato (`6 ítems · 42 min`) | mono | 11–12px | 400–500 |
| Eyebrow / label (MAYÚS, tracking .1em) | mono | 11px | 500 |

### 3.4 Espaciado

Escala base 4px. Padding de tarjeta 16–20px. Gap entre tickets 9–12px. Touch target mínimo **44px** en toda acción. Botón primario sobredimensionado (padding vertical 15px).

### 3.5 Sombras y bordes

Todo contenedor: `border:1px solid var(--line)` + `--sh-1` en reposo. En hover sube a `--sh-2` + `--line-strong` y `translateY(-1 a -3px)`. Los divisores internos "de ticket" usan `dashed var(--line-strong)` para el look de comanda física.

### 3.6 Estados y feedback (voz de interfaz)

- **Vacío = invitación**, no error: "Toca un producto para agregarlo a la comanda".
- **Error accionable**, sin disculpas: "La impresora no responde. Revisa que esté encendida o reimprime." + botón.
- **Acción = mismo verbo en todo el flujo**: el botón dice "Enviar a cocina" → el toast dice "Enviado a cocina".
- Sentence case siempre. Sin signos de exclamación de relleno.

---

## 4. Componentes (specs)

### 4.1 Top bar
- Fondo `--surface`, `border-bottom:1px solid --line`. **Nunca oscuro.**
- Izquierda: marca (cuadro ámbar 26px con "Q" + "QuieroComer" 15/700 + "POS" en mono 10.5px MAYÚS `--ink-3`). En pantallas internas se reemplaza por botón "volver" (30px, borde `--line`) + eyebrow mono + subtítulo (nombre de cuenta).
- Derecha: indicador de conexión (`punto jade` con halo `jade-tint` + "En línea" en mono 11px) y, en Inicio, el usuario/caja.
- El punto de conexión cambia a ámbar cuando está offline sincronizando, y a `--ink-3` sin conexión. Discreto, nunca alarmante.

### 4.2 Botones
- **Primario**: fondo `--amber`, texto blanco, `--r-btn`, sombra ámbar (`0 8px 18px rgba(222,124,0,.24)`). Hover `--amber-press`. Deshabilitado: fondo `--line-strong`, texto `--ink-3`, sin sombra.
- **Secundario**: fondo `--surface`, borde `--line-strong`, texto `--ink`. Hover fondo `--sunk`.
- **Acción de card (Mostrador/Retiro)**: tarjeta con borde `--line`, ícono `--ink-2`, label 14.5/600. La primaria de esa fila (Comandero) va en variante ámbar sólida.

### 4.3 Segmented control (`.seg`)
Contenedor pill `--sunk` + borde `--line`, padding 4px. Botón activo: fondo `--surface` + `--sh-1` + texto `--ink`. Inactivo: texto `--ink-2`. Se usa en Cobro (Pagar todo / Dividir por ítems / Dividir en partes).

### 4.4 Ticket de cuenta (Inicio) — **componente firma**
Estructura: `[riel 4px] [chip 42px] [nombre + meta] ......... [total]`
- **Riel** izquierdo de 4px codifica estado: `--amber` = activa con consumo; `--line-strong` = vacía/idle; (futuro) tono destacado = cuenta pedida.
- **Chip** cuadrado 42px, radio 11px, iniciales en mono 600: `MO` mostrador / `RE` retiro / número de mesa. Fondo tint según tipo (`amber-tint` si activa, `slate-tint` si informativa).
- **Nombre** en Inter 15/600. **Meta** en mono 11.5 `--ink-3` con separadores `·`.
- **Total** a la derecha en mono 19/600. Si es `$0` → `--ink-3` peso 500 (se atenúa para que el ojo vaya a las cuentas con plata).
- Card completa: hover eleva a `--sh-2`.

### 4.5 Riel de categorías (Comandero)
Columna `--sunk`, `border-right --line`. Ítem: 13.5/500 `--ink-2`, radio 10px. Activo: fondo `--amber-tint-2`, texto `--amber-press` 600, + **barra ámbar 3px** a la izquierda (`::before`). En móvil pasa a fila horizontal scrolleable arriba (sin la barra lateral).

### 4.6 Card de producto
Foto arriba (aspect 4/3, con degradado sutil abajo para legibilidad del texto sobre cualquier imagen). Info: nombre Inter 13.5/600, precio mono 13/600 `--amber-press`. Hover eleva `-3px`. **Tap = agrega 1** (feedback de escala al active). **Tap largo / botón ⋯ = modal de modificadores + nota**.

### 4.7 Panel de comanda / ticket (Comandero)
- Header con eyebrow "PEDIDO ACTUAL" (mono) + nº de ronda, divisor `dashed`.
- **Vacío**: anillo dashed 52px con "+" + copy invitador centrado.
- **Con ítems**: filas `[cantidad mono ámbar] [nombre Inter] [precio mono]`, hover `--sunk`.
- Footer `--sunk`, borde superior: fila TOTAL (label mono MAYÚS + valor mono 22/600) + botón primario "Enviar a cocina" (deshabilitado si vacío).

### 4.8 Fila de cuenta en Cobro (`.bill-row`)
`[cantidad mono ámbar] [nombre Inter] ......... [precio mono]`, divisor `--line`.
- Estado **pagado**: `opacity .4`, nombre tachado, precio en `--jade`. (Al dividir por ítems, el ítem tocado y cobrado queda así.)

### 4.9 Card de método de pago (`.m`)
Botón vertical: ícono 18px + label 12.5/600. Reposo borde `--line`, texto `--ink-2`. **Seleccionado**: borde `--amber`, fondo `--amber-tint-2`, texto `--amber-press`. "App de pago" ocupa ancho completo (`.wide`).

### 4.10 Bloque de arqueo (Caja)
Card con filas `[label Inter] ......... [monto mono]`. La fila **Diferencia** se separa con divisor `dashed` y:
- `$0` → tag jade "Cuadrado" con check.
- Distinto de 0 → monto en ámbar (o rojo si prefieres para faltante), **siempre visible, nunca auto-cuadrada ni oculta**. Es requisito anti-robo-hormiga.

---

## 5. Pantalla por pantalla

### 5.1 Inicio · Cuentas abiertas
Top bar (marca + conexión + caja). Fila de 3 acciones: Mostrador, Retiro (secundarias) y **Comandero (primaria ámbar)** — la más frecuente pesa más, grid `1fr 1fr 1.35fr`. Luego eyebrow "CUENTAS ABIERTAS · N" y lista de tickets (4.4) ordenados: primero las activas con consumo, luego las idle. Tocar un ticket entra a la cuenta.

### 5.2 Comandero
Layout `[riel categorías 158px] [grilla productos 3 col] [panel comanda 300px]`. Grilla de productos con el **catálogo real de la Carta QR** (no duplicar datos). Panel de comanda a la derecha (4.7). "Enviar a cocina" genera la ronda con solo los ítems nuevos e imprime vía puente.
- **Responsive**: bajo 840px → categorías arriba en fila, grilla a 2 col, panel de comanda abajo.

### 5.3 Cobro
Layout `[cuenta 1fr] [panel de pago 320px]`. Arriba, segmented (5 · 4.3) con los 3 caminos:
- **Pagar todo**: toda la cuenta, elige método, registra.
- **Dividir por ítems**: las filas se vuelven tocables; al tocar se acumulan en un subtotal parcial; se cobra con un método; los ítems cobrados quedan en estado pagado (4.8). Repetir hasta saldo 0.
- **Dividir en partes**: input de N personas → muestra monto por persona → cada parte se cobra con su método; ajustar redondeo en el último pago.
- Panel de pago: contador "Pago X de N" (mono), Subtotal restante, Propina (chip 10% editable/eliminable), **Saldo a cobrar** en mono 30px (el número que se lee de lejos), grilla de métodos (4.9), botón primario "Registrar pago · $monto". Permite **pagos mixtos** dentro de una misma división.
- Al llegar a saldo 0 → cerrar cuenta, mesa vuelve a libre, opción de imprimir detalle.

### 5.4 Caja
Ancho acotado (~720px). Banner de apertura (monto inicial + hora + usuario, en `amber-tint-2`). Grilla de cards por método de pago (4.9 estilo mcard) + card de Propinas. Bloque de arqueo (4.10): apertura + ventas efectivo → esperado vs. contado → diferencia visible. Botones: **Cerrar caja** (primario) + Imprimir (secundario). Regla: no cerrar con cuentas abiertas sin confirmación explícita listándolas.

---

## 6. Responsive — un solo código, responsive POR ROL (no por ancho)

**Regla:** un solo código y un solo sistema de diseño. NO dos apps. Pero adaptar el layout según el ROL del dispositivo, no simplemente encogiendo la pantalla de escritorio (eso es "responsive ingenuo" y se siente pésimo en el celular del garzón).

Cada dispositivo cumple un rol distinto:

- **Celular (garzón, en la mano, caminando):** su ciclo es corto y repetido — ver mesas → tomar pedido → enviar a cocina. Layout de UNA columna, pulgar-primero, botones grandes. Es el caso principal para tomar pedidos.
- **Touch de salón / PC de caja (estación fija):** aquí viven las tareas que piden ancho — comandero de 3 columnas, cobro con división lado a lado, caja y arqueo. Es el caso principal para cobrar y cerrar caja.

Lo que se COMPARTE siempre (nunca se duplica): capa offline, event sourcing, sync, catálogo, y este sistema de diseño. Lo único que cambia por breakpoint es el LAYOUT.

**Breakpoints:** `< 840px` = móvil (una columna) · `≥ 840px` = estación (2–3 columnas del mockup).

### Mapa pantalla × dispositivo

| Pantalla | Celular (garzón) | Estación (touch/PC) | Prioridad de diseño |
|----------|------------------|---------------------|---------------------|
| **Inicio · Cuentas** | Una columna. Las 3 acciones apiladas o en fila compacta; tickets a ancho completo. | Grid `1fr 1fr 1.35fr` de acciones + lista de tickets. | Ambos por igual |
| **Comandero** | Categorías en tabs horizontales scrolleables arriba; grilla de productos a 2 columnas; el "Pedido actual" NO va de panel lateral: va como **hoja inferior** (bottom sheet) que sube, o como paso siguiente tras "Ver comanda". Botón "Enviar a cocina" fijo abajo. | 3 columnas: categorías · productos (3 col) · panel de comanda lateral. | **Celular primero** (es donde el garzón toma pedidos) |
| **Cobro** | Una columna: cuenta arriba, panel de pago abajo. Los 3 caminos siguen disponibles pero "Dividir por ítems" se maneja tocando filas a pantalla completa. Saldo y métodos grandes. | `[cuenta 1fr] [panel de pago 320px]` lado a lado. División por ítems cómoda con todo a la vista. | **Estación primero** (usable en celular, pero el caso principal es la caja) |
| **Caja / arqueo** | Una columna, cards de método apiladas, arqueo scrolleable. Usable pero no es el caso principal. | Ancho acotado ~720px, cards en grilla, arqueo completo. | **Estación primero** |
| **Configuración** (mapa de mesas, usuarios, impresora) | Solo lectura / ajustes simples. | Edición completa (arrastrar mesas, gestión de PINs). | **Estación primero** |

**Qué NO hacer:** meter a la fuerza el panel lateral de comanda o la división por ítems de 2 columnas dentro de 5 pulgadas encogiendo todo. En celular esos casos cambian de forma (hoja inferior, pantalla completa), no de escala.

---

## 7. Piso de calidad (no negociable)

- Touch targets ≥44px.
- Foco de teclado visible en toda acción.
- `prefers-reduced-motion`: desactivar transiciones/animaciones.
- Contraste AA en texto sobre fondos (el par `--amber-press` sobre claro cumple; el ámbar puro `--amber` solo sobre blanco o como fondo con texto blanco).
- Estados vacíos y de error redactados según 3.6.
- `tabular-nums` en todo número que pueda cambiar (evita que los montos "salten").

---

## 8. Do / Don't

**Do**
- Un botón ámbar sólido por pantalla (la acción primaria).
- Números en mono, palabras en Inter, siempre.
- Estado por riel/posición/tint, no por avatares de colores al azar.
- Header claro con hairline.
- Atenuar lo irrelevante ($0, ítems pagados) para dirigir el ojo.

**Don't**
- Header oscuro/negro.
- Serif en nombres de plato (se ve accidental).
- Ámbar decorativo por todos lados.
- Ocultar o auto-cuadrar la diferencia de caja.
- Mezclar más de dos familias tipográficas.

---

## 9. Prompt listo para pegar a Claude Code

> Vamos a unificar el sistema visual del POS QuieroComer y aplicarlo a todas las pantallas (refactor de las existentes + base para las nuevas). Adjunto el documento `pos-sistema-diseno-handoff.md` y el mockup `pos-design.html` como referencia visual exacta.
>
> 1. Agrega los design tokens de la sección 2 al CSS global (o al theme de Tailwind como variables/colores custom). Carga Inter (400–700) e IBM Plex Mono (400–600).
> 2. Refactoriza las pantallas actuales (Inicio y Comandero) para consumir SOLO estos tokens y los componentes de la sección 4. Elimina el header oscuro y cualquier serif en nombres de plato.
> 3. Aplica la regla de oro sin excepción: palabras en Inter, números/datos/etiquetas en IBM Plex Mono con tabular-nums.
> 4. El ámbar #DE7C00 solo en: acción primaria (un botón por pantalla), estado activo y totales/precios.
> 5. Implementa las pantallas Cobro (con los 3 caminos de división y pagos mixtos) y Caja (con arqueo de diferencia visible) según las secciones 4 y 5.
> 6. Respeta el piso de calidad de la sección 7 (touch ≥44px, foco visible, reduced-motion, tabular-nums).
> 7. Aplica el responsive de la sección 6: UN solo código, responsive POR ROL. Móvil (<840px) = una columna, pulgar-primero, con el "Pedido actual" del comandero como hoja inferior (no panel lateral). Estación (≥840px) = 2–3 columnas del mockup. No encojas la pantalla de escritorio en el celular; cambia la forma según el mapa pantalla×dispositivo.
>
> No introduzcas acentos, fuentes ni estilos fuera de este sistema. Cuando termines, corre las pantallas y comparemos contra el mockup.
