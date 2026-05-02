# Modulo: El Genio (Personalizador de carta)

El Genio es un asistente que **recopila las preferencias del comensal** y luego **reordena y filtra la carta** para ese cliente. NO sugiere un plato especifico ni hace cross-sell — solo personaliza la carta segun gustos.

> ⚠️ La logica vieja (Akinator de 9 fotos + scoring + plato recomendado final) fue removida. Si encuentras referencias a `GENIO_DISH_ACCEPTED`, `GENIO_DISH_REJECTED`, `topDishesGenio`, "platos recomendados por el Genio", son legacy y deberian limpiarse.

## Archivo principal

`src/components/qr/genio/GenioOnboarding.tsx`

## Flujo del onboarding (5 pasos)

Pasos definidos en `STEP_NAMES = ["welcome", "diet", "restrictions", "dislikes", "done"]`.

### Paso 0 — Welcome
Pantalla de bienvenida explicando que el Genio va a personalizar la carta.

### Paso 1 — Dieta
Opciones: omnivore, vegetarian, vegan, pescetarian.
Se guarda en `localStorage.qr_diet`.

### Paso 2 — Restricciones
Multi-seleccion: lactosa, gluten, nueces, almendras, mani, mariscos, cerdo, alcohol, ninguna.
Se guarda en `localStorage.qr_restrictions` (JSON array).

### Paso 3 — Dislikes
Ingredientes que no le gustan: palta, cebolla, tomate, cilantro, etc.
Se guarda en `localStorage.qr_dislikes` (JSON array).

### Paso 4 — Done
Confirmacion: "tu carta esta lista". Se cierra el onboarding y la carta se reordena/filtra segun el perfil capturado.

## Que hace con esos datos

La carta consume los valores de `localStorage` para:
- **Filtrar** platos que violan dieta o restricciones
- **Reordenar** carruseles y secciones priorizando los platos compatibles
- **Resaltar** platos especialmente alineados con el perfil

No hay un output explicito tipo "tu plato recomendado es X".

## Persistencia

- **localStorage**: `qr_diet`, `qr_restrictions`, `qr_dislikes` (sobreviven entre sesiones del mismo navegador)
- **DB**: si el cliente se registra (via banner de cumple u otro punto de captura), las preferencias se sincronizan al `QRUser`

## Visitante recurrente

Si ya hay preferencias guardadas en `localStorage`, el Genio detecta y muestra "Bienvenido de nuevo" — ofrece ajustar el perfil sin re-hacer todo el onboarding.

## Cross-sell ("Va perfecto con")

OJO: el componente que sugiere acompanamientos en la pantalla de detalle de un plato (`Vendedor silencioso` / `productSuggestions`) **NO es el Genio**. Es una logica separada que vive en `src/components/qr/carta/DishDetail.tsx` y similares, basada en reglas del dueno y co-ocurrencia historica.

## Tracking

| Evento | Cuando |
|--------|--------|
| `GENIO_START` | Avanza del paso 0 al 1 (primera vez), o modifica perfil (recurrente) |
| `GENIO_STEP_DIET` | Selecciona dieta |
| `GENIO_STEP_RESTRICTIONS` | Selecciona restricciones |
| `GENIO_STEP_DISLIKES` | Selecciona dislikes |
| `GENIO_COMPLETE` | Termina el onboarding (paso done) |
| `GENIO_PROFILE_SAVED` | Persiste perfil en QRUser tras registro |

Los eventos `GENIO_DISH_ACCEPTED` y `GENIO_DISH_REJECTED` quedaron en el enum de Prisma por compatibilidad pero ya no se emiten desde el cliente.
