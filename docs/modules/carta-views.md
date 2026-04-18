# Modulo: Vistas de la Carta

La carta QR de cada restaurante se puede ver en 3 modos. El comensal elige cual prefiere con el ViewSelector (pill flotante abajo a la derecha).

## Las 3 vistas

### Vista Lista
- **Archivo**: `CartaLista.tsx`
- **Icono**: List (lineas)
- **Descripcion**: Directa y funcional. Ideal para el cliente que ya sabe que quiere.
- **UI**: Mini-hero oscuro con logo, navbar sticky de categorias, platos en tarjetas compactas con foto, nombre, precio.
- **Busqueda**: Barra de busqueda integrada en el navbar.

### Vista Clasica
- **Archivo**: `CartaPremium.tsx`
- **Icono**: BookOpen (libro)
- **Descripcion**: Visual y elegante. Scroll horizontal por categoria.
- **UI**: Hero grande con plato destacado (autorotacion), categorias horizontales con fotos grandes, platos en cards con swipe.
- **Features extra**: Banner de cumpleanos, captura de email en segunda visita.

### Vista Espacial
- **Archivo**: `CartaViaje.tsx`
- **Icono**: Sparkles (estrellas)
- **Descripcion**: Cinematografica e inmersiva. Cada seccion es una experiencia visual.
- **UI**: Portada fullscreen con nombre gigante (Fraunces 200), secciones verticales con scroll snap, platos en slides horizontales con 4 variantes (hero, split, light, spotlight).
- **Features**: Logo+nombre sticky arriba a la izquierda, foto de fondo con Ken Burns en secciones, badge de seccion clickeable, outro con Genio.

## ViewSelector

**Archivo**: `ViewSelector.tsx`

Pill flotante que se abre al tocar, mostrando las 3 opciones. Al seleccionar una vista:
1. `showViewTransition(label, view)` muestra overlay con icono de la vista
2. `setView(next)` actualiza URL (?vista=X) y localStorage
3. CartaRouter renderiza la nueva vista
4. La vista llama `onReady()` → overlay hace fade out

La vista seleccionada persiste en `localStorage` (key: `quierocomer_carta_view`) y en el URL param `?vista=`.

## CartaRouter

**Archivo**: `CartaRouter.tsx`

Orquesta cual vista se muestra. Solo monta 1 vista a la vez (no las 3 simultaneas para evitar queries redundantes).

Responsabilidades:
- Determinar vista activa via `useCartaView()`
- Compartir `qrUser` entre vistas (fetch unico en /api/qr/user/me)
- Manejar ProfileDrawer (login/perfil)
- Iniciar session tracking (`startSession`)
- Trackear cambios de vista (`trackViewSelected`)

## Transicion entre vistas

Se usa un sistema de overlay global via `useViewTransition` (hook con estado global):
- ViewSelector llama `showViewTransition()` sincronamente al click
- CartaRouter muestra overlay con icono correspondiente (List/BookOpen/Rocket)
- La vista nueva llama `onReady()` al montarse
- `hideViewTransition()` hace fade out del overlay

## Analytics

Cada cambio de vista genera un `CARTA_VIEW_SELECTED` StatEvent. El dashboard muestra la distribucion de vistas preferidas (Lista vs Clasica vs Espacial) para que el dueno sepa como exploran su carta.
