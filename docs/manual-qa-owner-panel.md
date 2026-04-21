# Manual QA — Owner Panel

Checklist para probar manualmente los flujos del panel de owners.

## Credenciales de prueba
- **Owner:** favoritez@gmail.com / Test1234 (restaurant: Hand Roll)
- **Superadmin:** admin@quierocomer.cl / QuieroComer2026Admin

## Flujos a probar

### Login y layout
- [ ] Owner hace login y ve el nuevo layout cálido (crema/blanco, no dark)
- [ ] Superadmin hace login y ve el layout dark con sidebar (sin cambios)
- [ ] En mobile (<768px): bottom nav con 4 tabs (Inicio, Mi Carta, Ofertas, Más)
- [ ] En desktop (≥768px): sidebar izquierdo crema con 9 items, sin bottom nav
- [ ] Drawer "Más" (mobile): tap en tab Más abre bottom sheet con opciones correctas
- [ ] Drawer "Más" NO muestra Locales, Experiencias, ni Owners

### Dashboard (Inicio)
- [ ] Cards de métricas tienen fondo crema sutil, no parches negros sobre blanco
- [ ] En superadmin, las cards siguen siendo dark como antes
- [ ] El selector de restaurant NO aparece para owners (está en el header)

### Mi Restaurante
- [ ] Acceder desde sidebar (desktop) o drawer Más (mobile)
- [ ] Card "Información básica": editar nombre → guardar → aparece persistido
- [ ] Subir logo → se muestra circular
- [ ] Subir banner → se muestra horizontal
- [ ] Descripción: contador de caracteres funciona (máx 200)
- [ ] Card "Contacto": teléfono, WhatsApp, dirección se guardan
- [ ] Card "Redes": Instagram con prefijo @ visual, website se guarda
- [ ] Card "Horarios": toggle día abierto/cerrado funciona
- [ ] Horarios: "Copiar a todos los días" copia el primer horario a todos
- [ ] Botón "Generar QR" abre modal con restaurant correcto precargado
- [ ] Card "Link del garzón": link se copia al clipboard
- [ ] "Abrir panel" abre el panel del garzón en nueva pestaña
- [ ] Warning "Este link es público" visible

### Navegación y seguridad
- [ ] Owner no puede acceder a /admin/locales (redirige a /admin)
- [ ] Owner no puede acceder a /admin/experiencias (redirige a /admin)
- [ ] Owner no puede acceder a /admin/owners (redirige a /admin)

### Cuenta (drawer del avatar)
- [ ] Tap en avatar abre drawer lateral derecho
- [ ] Nombre del owner visible
- [ ] "Cambiar contraseña" abre modal con 3 campos
- [ ] Cambiar contraseña funciona (probar con contraseña actual correcta)
- [ ] "Ayuda / Soporte" abre email a soporte@quierocomer.cl
- [ ] "Cerrar sesión" funciona y redirige a /admin/login

### Responsive
- [ ] En mobile (375px), todo es táctil, tap targets ≥44px
- [ ] En tablet (768px), sidebar visible, bottom nav oculto
- [ ] Redimensionar ventana de mobile a desktop: drawer se cierra automáticamente
- [ ] Mi Carta y Ofertas se ven correctamente en layout claro

### Páginas dark (deuda técnica conocida)
- [ ] Analytics, Genie, Campañas, Automatizaciones, Segmentos se ven con fondo dark
- [ ] Funcionan correctamente aunque el visual no sea óptimo
