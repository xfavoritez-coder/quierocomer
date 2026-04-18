# Modulo: Panel Admin

Panel de administracion accesible en `/admin`. Soporta dos tipos de usuario: superadmin y owner de local.

## Auth

### Superadmin (Jaime)
- Credenciales en env vars: `ADMIN_EMAIL` + `ADMIN_PASSWORD`
- Ve todos los locales
- Puede crear owners y asignar locales
- Badge "SUPER" visible en sidebar

### Owner (dueno de local)
- Modelo `RestaurantOwner` en BD con email + passwordHash (bcrypt)
- Ve solo su(s) local(es)
- Si tiene multiples locales, selector en el sidebar
- Se crea via API `/api/admin/owners` (POST, superadmin only)

### Flujo de login
1. POST `/api/admin/login` con email + password
2. Primero verifica si es superadmin (env vars)
3. Si no, busca RestaurantOwner en BD y verifica bcrypt
4. Setea cookies: `admin_token` (httpOnly 7d), `admin_role`, `admin_id`
5. Redirect a /admin

### Verificacion
- GET `/api/admin/me` — devuelve rol, nombre, lista de locales
- `useAdminSession()` hook en el layout verifica y expone la sesion

## Paginas

### /admin (Dashboard)
Metricas reales desde la BD:
- Visitas esta semana (con delta % vs semana pasada)
- Visitantes unicos, registrados, tasa de conversion
- Duracion promedio de sesion
- Sesiones activas vs abandonadas
- Distribucion de vista preferida (Lista/Clasica/Espacial)
- Distribucion por dispositivo (mobile/tablet/desktop)
- Top 5 platos mas vistos
- Top 5 platos mas recomendados por Genio
- Distribucion de dieta de clientes
- (Superadmin) Top locales por visitas, locales activos

### /admin/locales
Gestion de restaurantes.

### /admin/menus
Gestion de platos: crear, editar, ordenar, fotos.

### /admin/genie
Analytics del Genio: sesiones, conversiones, perfiles.

### /admin/ajustes
Configuracion del local.

## APIs

| Endpoint | Metodo | Acceso | Descripcion |
|----------|--------|--------|-------------|
| `/api/admin/login` | POST | Publico | Login |
| `/api/admin/me` | GET | Auth | Info de sesion |
| `/api/admin/logout` | POST | Auth | Limpiar cookies |
| `/api/admin/dashboard` | GET | Auth | Metricas del dashboard |
| `/api/admin/owners` | GET/POST | Superadmin | CRUD de owners |

## Componentes

- **Layout** (`admin/layout.tsx`): sidebar desktop + hamburger mobile, selector de local, badge SUPER
- **useAdminSession** (`lib/admin/useAdminSession.ts`): hook que expone `role`, `isSuper`, `restaurants`, `selectedRestaurantId`, `setSelectedRestaurant`, `logout`
- **Stat, RankList, DistributionBar**: componentes reutilizables del dashboard
