# Dark Mode para Cartas

## Resumen
Agregar modo oscuro a las cartas de los restaurantes para que se adapten a la preferencia del usuario o la elección del restaurante.

## Opciones de control
- **El restaurante elige** en su admin: claro / oscuro / automático
- **Automático** respeta `prefers-color-scheme` del celular del cliente

## Cambios visuales
| Elemento | Light (actual) | Dark |
|----------|---------------|------|
| Fondo | #fff / #faf6ee | #0e0e0e / #1a1a1a |
| Texto | #0e0e0e | #f0f0f0 |
| Bordes | #f0f0f0 / #e0e0e0 | rgba(255,255,255,0.1) |
| Badges | amber sobre blanco | amber sobre dark |
| Modal (DishDetail) | fondo blanco | fondo oscuro |
| CategoryNav | blanco sticky | oscuro sticky |
| Accent (amber) | #F4A623 (sin cambio) | #F4A623 (sin cambio) |

## Implementación técnica
1. Migrar inline styles de carta a CSS variables (`--carta-bg`, `--carta-text`, `--carta-surface`, `--carta-border`)
2. Definir valores en `:root` (light) y `.carta-dark` (dark)
3. Agregar campo `themeMode` al modelo Restaurant en Prisma: `LIGHT | DARK | AUTO`
4. Aplicar clase `.carta-dark` según preferencia del restaurante o media query
5. Para `AUTO`: usar `@media (prefers-color-scheme: dark)` con las mismas variables

## Componentes afectados
- CartaLista, CartaPremium, CartaFeed, CartaViaje
- DishCard (ambas variantes)
- DishDetail (modal)
- CategoryNav
- HeroDish / HeroSlim
- NameModal
- Badges (recomendado, popular, nuevo)
- GenioOnboarding

## Prioridad
Baja - implementar cuando se terminen las funcionalidades core.
