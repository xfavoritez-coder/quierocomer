# Modulo: El Genio (Recomendador)

El Genio es un asistente que recomienda platos personalizados al comensal. No usa un LLM externo — es un algoritmo de scoring local que corre en el browser.

## Archivo principal

`src/components/qr/genio/GenioOnboarding.tsx`

## Flujo del onboarding (5 pasos)

### Paso 1 — Dieta
Opciones: omnivore, vegetarian, vegan, pescetarian.
Se guarda en `localStorage.qr_diet`.

### Paso 2 — Restricciones
Multi-seleccion: lactosa, gluten, nueces, almendras, mani, mariscos, cerdo, alcohol, ninguna.
Se guarda en `localStorage.qr_restrictions` (JSON array).

### Paso 3 — Dislikes
Ingredientes que no le gustan: palta, cebolla, tomate, cilantro, etc.
Se guarda en `localStorage.qr_dislikes` (JSON array).
No filtra platos, solo penaliza en scoring (-8 por match).

### Paso 4 — Nivel de hambre
Opciones: light, normal, heavy.
Solo en estado local, no se persiste.

### Paso 5 — Akinator visual
Grilla de 9 fotos de platos del local. El usuario toca los que le llaman la atencion.
La grilla evoluciona: los platos no seleccionados se reemplazan por otros con mayor score de afinidad.
Despues de 2 rondas, genera la recomendacion final.

## Algoritmo de scoring

### Scoring basico (evolucion de grilla)
```
+10  categoria coincide con platos liked
 +3  por ingrediente compartido con liked
 +5  tag RECOMMENDED
 -8  por ingrediente en dislikes
 +0-4 factor random (variedad)
```

### Scoring final (recomendacion)
```
+20  categoria coincide con liked
 +5  por ingrediente compartido
+10  tag RECOMMENDED
 +8  alineacion con nivel de hambre
 +5  precio alto si hambre heavy
 +2  bonus si tiene foto
 +0-3 random
 -8  por dislike
```

Se filtran platos segun dieta y restricciones. El mejor scored se muestra como recomendacion.

## Persistencia

- **localStorage**: dieta, restricciones, dislikes (sobreviven entre sesiones)
- **BD**: solo al registrarse via PostGenioCapture (email → QRUser)
- Las selecciones de fotos y hambre son efimeras

## Visitante recurrente

Si el usuario ya tiene preferencias guardadas en localStorage, el Genio lo detecta y muestra "Bienvenido de nuevo" — salta directo al paso del Akinator.

## Modo grupal

`GroupSession` permite que toda la mesa participe. Cada miembro hace su onboarding y el Genio cruza preferencias para recomendar platos que le gusten a todos. Usa un codigo de 6 digitos para unirse.

## Tracking

| Evento | Cuando |
|--------|--------|
| `GENIO_START` | Abre el Genio |
| `GENIO_COMPLETE` | Termina con recomendacion (incluye dishId) |
| `GENIO_DISH_ACCEPTED` | Acepta la recomendacion ("ver plato") |
| `GENIO_DISH_REJECTED` | Pide otra recomendacion ("siguiente") |
| `GENIO_GROUP_START` | Inicia sesion grupal |

## Punto de captura

Despues de la recomendacion, `PostGenioCapture` muestra un prompt sutil para que el usuario deje su email. Si lo hace, se crea QRUser y se linkea con su GuestProfile.
