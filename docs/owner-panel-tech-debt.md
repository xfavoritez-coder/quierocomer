# Owner Panel — Tech Debt

## Páginas con theme dark pendientes de migrar

Estas 5 páginas siguen usando colores dark hardcodeados (`#1A1A1A`, `#111`, `#2A2A2A`).
Cuando un owner las visita desde el drawer "Más" o el sidebar, las verá con fondo oscuro
dentro del layout claro. Es aceptable para el piloto pero debe corregirse después.

| Página | Ruta | Prioridad |
|--------|------|-----------|
| Analytics (y sub-páginas) | `/admin/analytics/*` | Alta — datos importantes |
| Sesiones (Genie) | `/admin/genie` | Media |
| Campañas | `/admin/campanias` | Media |
| Automatizaciones | `/admin/automatizaciones` | Baja |
| Segmentos | `/admin/segmentos` | Baja |

## Por qué se pospuso

- Las 3 páginas más usadas (dashboard, menus, promociones) ya están migradas a CSS variables
- Las 5 restantes son secciones avanzadas con muchos componentes inline (forms, cards, tables)
- El piloto tiene 3-4 restaurantes y los owners usan principalmente Mi Carta y Ofertas
- Migrar cada página toma ~30 min de find-replace mecánico

## Cómo migrar cuando llegue el momento

El sistema de CSS variables ya está creado en `globals.css` (`.theme-dark` / `.theme-light`).
Para migrar una página:

1. Abrir el archivo `page.tsx`
2. Reemplazar mecánicamente:
   - `"#1A1A1A"` → `"var(--adm-card)"`
   - `"#111"` → `"var(--adm-input)"`
   - `"1px solid #2A2A2A"` → `"1px solid var(--adm-card-border)"`
   - `"white"` (como color de texto) → `"var(--adm-text)"`
   - `"#888"` → `"var(--adm-text2)"`
   - `"#666"` → `"var(--adm-text2)"`
   - `"#555"` → `"var(--adm-text3)"`
   - `"#aaa"` → `"var(--adm-text2)"`
3. Verificar que no se rompan status colors (verde/rojo/azul) que NO son de tema
4. Probar en ambos layouts (superadmin dark + owner light)

Tiempo estimado: ~2-3 horas para las 5 páginas.
