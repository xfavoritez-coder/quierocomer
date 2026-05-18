# Dark/Light Mode en Emails HTML

## El problema

Los clientes de email (especialmente Gmail en Android/iOS) aplican "dark mode" de forma automática:

- **Invierten fondos claros** a oscuros (ej: `#fefefe` pasa a `~#1a1a1a`)
- **NO siempre cambian el color del texto** inline
- Resultado: texto oscuro (`#1a1a1a`) sobre fondo invertido a oscuro = **ilegible**

## Lo que NO funciona

- `@media (prefers-color-scheme: dark)` — **Gmail lo ignora** completamente
- `<meta name="color-scheme" content="light dark">` — Gmail lo ignora
- CSS classes con overrides dark — Gmail los stripea
- Cualquier cosa que dependa de `<style>` blocks — Gmail los puede ignorar o stripear

## Lo que SÍ funciona (nuestra solución)

### Regla principal: usar colores de tono medio que se lean en ambos fondos

| Elemento | Color | Por qué funciona |
|---|---|---|
| Texto principal | `#8a7550` (marrón medio) | Visible en fondo claro Y oscuro |
| Texto secundario | `#b8a888` (beige medio) | Suficiente contraste en ambos modos |
| Texto en banners/alerts | `#92400e` (ámbar oscuro) | Se lee sobre fondo claro original Y sobre fondo oscuro invertido |
| Labels/subtítulos | `#b8a888` | Tono medio universal |
| Acento (gold) | `#e8930a` | Brillante, funciona siempre |
| Verde positivo | `#16a34a` | Suficiente brillo para dark mode |
| Rojo negativo | `#dc2626` | Suficiente brillo para dark mode |

### Fondos de tarjetas

- Usar **fondos sólidos** como `#f9f6f0` — Gmail los invierte de forma predecible
- **Evitar gradientes** (`linear-gradient`) en banners — Gmail no los invierte bien y el resultado es impredecible
- Borders: usar `#e8dcc4` o similares — se ven discretos en light y desaparecen elegantemente en dark

### Lo que SÍ puede ser negro

- Los **números grandes** (KPIs como `#1a1a1a`) funcionan porque Gmail SÍ invierte texto negro puro cuando el fondo se invierte — la clave es que sea en un contexto donde Gmail detecte que debe invertir
- El título principal `#1a1a1a` también funciona porque está sobre el fondo `#fefefe` del body, que Gmail invierte correctamente

### Casos problemáticos (evitar)

- Texto `#1a1a1a` dentro de un banner con gradiente — Gmail puede invertir el gradiente pero no el texto
- Texto oscuro sobre `background: rgba(...)` — resultado impredecible
- Imágenes con fondo transparente y texto oscuro — se vuelven invisibles

## Estructura del email (table-based)

Usamos layout basado en `<table>` (no `<div>`) para máxima compatibilidad:
- Gmail, Outlook, Apple Mail, Yahoo
- Todo inline styles, no depender de `<style>` block
- Fuente: `'Segoe UI', system-ui, -apple-system, sans-serif`

## Archivos relevantes

- `/src/lib/email/weeklyEmailHtml.ts` — Template principal del email semanal
- `/src/lib/email/templates/weeklyDigest.ts` — Template legacy (referencia)
- `/src/app/api/cron/weekly-email/route.ts` — Cron que envía los emails
- `/src/app/api/send-weekly-email/route.ts` — Envío manual/test

## Resumen rápido

> **No pelees contra Gmail dark mode. Usa colores de tono medio que se lean en cualquier fondo.**
> Nunca `#1a1a1a` en banners con gradiente. Siempre `#92400e` o `#8a7550` para texto importante.
