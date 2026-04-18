# ADR-001: Tres vistas para la carta

**Fecha**: Abril 2026
**Estado**: Aceptado

## Contexto

Los restaurantes tienen clientes con distintas expectativas. Unos quieren ver la carta rapido y pedir. Otros quieren explorar, ver fotos, dejarse llevar. Una sola UI no sirve para todos.

Las cartas QR existentes en Chile son todas iguales: una lista plana con texto y precios. No hay diferenciacion visual.

## Decision

Implementar 3 vistas distintas para la misma carta, seleccionables por el comensal:

- **Lista**: funcional, directa, con busqueda. Para el que ya sabe que quiere.
- **Clasica**: visual, con hero y scroll horizontal. El default para la mayoria.
- **Espacial**: cinematografica, inmersiva, fullscreen. Para la experiencia premium.

El comensal elige con un ViewSelector flotante. La eleccion persiste en localStorage.

## Consecuencias

**Positivas:**
- Cada comensal usa la carta como prefiere
- Diferenciador fuerte vs competencia (nadie tiene esto)
- Data valiosa: saber que vista prefieren los clientes de cada local
- La vista Espacial funciona como argumento de venta al dueno

**Negativas:**
- 3 componentes que mantener (CartaLista, CartaPremium, CartaViaje ~800 lineas cada uno)
- Solo se monta 1 a la vez (pero los 3 se descargan en el bundle)
- Complejidad en el ViewSelector y transiciones entre vistas

## Alternativas consideradas

1. **Una sola vista configurable**: el dueno elige el estilo. Descartado porque limita al comensal.
2. **Dos vistas (simple + premium)**: descartado porque la Espacial agrega valor unico como wow factor.
3. **Vista adaptativa (detectar contexto)**: descartado porque es impredecible y el usuario pierde control.
