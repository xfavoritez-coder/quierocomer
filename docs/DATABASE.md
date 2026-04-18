# Base de Datos

PostgreSQL en Supabase. ORM: Prisma 6. Schema en `prisma/schema.prisma`.

## Diagrama de relaciones (QR Viva)

```
RestaurantOwner (1) ──→ (N) Restaurant
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         Category (N)    Dish (N)        StatEvent (N)
              │               │               │
              └──→ Dish (N)   │          GuestProfile?
                              │          QRUser?
                         Review (N)
                              │
                         Customer (N)

GuestProfile (1) ──→ (1?) QRUser
     │                       │
  Session (N)            QRMagicToken (N)
  StatEvent (N)          QRUserInteraction (N)
```

## Modelos principales

### RestaurantOwner
Dueno de local con auth propia.
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| email | String unique | Login |
| passwordHash | String | bcrypt |
| name | String | Nombre |
| role | OWNER / SUPERADMIN | Nivel de acceso |
| lastLoginAt | DateTime? | Ultimo login |

### Restaurant
Local de comida con su carta.
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| slug | String unique | URL: /qr/[slug] |
| name, description | String | Info basica |
| logoUrl, bannerUrl | String? | Imagenes |
| cartaTheme | BASIC / PREMIUM | Nivel de carta |
| ownerId | String? FK | Dueno (nullable) |

### Dish
Plato de la carta.
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| name, description | String | Info |
| price, discountPrice | Float | Precios |
| photos | String[] | URLs de fotos |
| tags | DishTag[] | RECOMMENDED, NEW, MOST_ORDERED, PROMOTION |
| isHero | Boolean | Plato destacado en hero |
| ingredients, allergens | String? | Texto libre |
| position | Int | Orden en la carta |

### GuestProfile
Visitante anonimo persistente.
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | String PK | = quierocomer_guest_id del browser |
| visitCount | Int | Cuantas veces ha entrado |
| totalSessions | Int | Sesiones completadas |
| preferences | Json? | Gustos acumulados |
| linkedQrUserId | String? FK | Si se registro |

### Session
Una visita a un local, resumida.
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| guestId | String FK | Visitante |
| qrUserId | String? FK | Si esta logueado |
| restaurantId | String FK | Local visitado |
| durationMs | Int? | Duracion total |
| viewUsed | String? | lista / premium / viaje |
| deviceType | String? | mobile / tablet / desktop |
| closeReason | String? | inactivity / pagehide / beforeunload |
| weather | String? | cloudy:18C |
| timeOfDay | TimeOfDay? | MORNING/LUNCH/AFTERNOON/DINNER/LATE |
| dishesViewed | Json? | [{ dishId, dwellMs }] |
| categoriesViewed | Json? | [{ categoryId, dwellMs }] |
| pickedDishId | String? | Si eligio un plato |
| isAbandoned | Boolean | Inactividad >30s |

### StatEvent
Evento individual de analiticas.
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| eventType | StatEventType | Tipo de evento |
| restaurantId | String FK | Local |
| dishId | String? | Plato relacionado |
| sessionId | String | ID de sesion del tab |
| guestId | String? FK | Visitante persistente |
| qrUserId | String? FK | Usuario registrado |
| weather | String? | Clima al momento |
| timeOfDay | TimeOfDay? | Franja horaria |

### QRUser
Comensal registrado (sin password, magic link).
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| email | String unique | Login |
| name | String? | Nombre |
| birthDate | DateTime? | Cumpleanos |
| dietType | String? | omnivore/vegetarian/vegan/pescetarian |
| restrictions | String[] | Alergias/restricciones |
| verifiedAt | DateTime? | Si confirmo email |

## Enumeraciones importantes

### StatEventType
```
SESSION_START, SESSION_END
DISH_VIEW, DISH_SELECT, DISH_DWELL
CATEGORY_VIEW, CATEGORY_DWELL
CARTA_VIEW_SELECTED
GENIO_START, GENIO_COMPLETE
GENIO_DISH_ACCEPTED, GENIO_DISH_REJECTED
GENIO_GROUP_START
WAITER_CALL, QR_SCAN
```

### DishTag
```
RECOMMENDED  — marcado por el dueno como recomendado
NEW          — plato nuevo
MOST_ORDERED — mas pedido (gestion manual)
PROMOTION    — en promocion
```

### TimeOfDay
```
MORNING    — 6:00 - 10:59
LUNCH      — 11:00 - 14:59
AFTERNOON  — 15:00 - 18:59
DINNER     — 19:00 - 22:59
LATE       — 23:00 - 5:59
```

## Modelos legacy (plataforma original)

`Usuario`, `Local`, `MenuItem`, `Interaction`, `DishRating`, `UserTasteProfile`, `GroupSession`, `GroupMember` — pertenecen a la version original de QuieroComer (explorador de restaurantes). Siguen en el schema pero no se usan en la Carta QR Viva.
