# Producto QuieroComer

## Vision

La primera carta QR que aprende los gustos de tus clientes, personaliza el menu en tiempo real, y convierte visitantes anonimos en clientes recurrentes.

## Usuarios

### Comensal (B2C)
- Escanea el QR en la mesa del restaurante
- Explora la carta en 3 vistas distintas
- Configura sus preferencias en el Genio para que la carta se adapte a el
- Puede registrarse para guardar preferencias
- Llama al garzon desde su celular

### Dueno de local (B2B)
- Ve estadisticas de su carta (que miran, que piden)
- Gestiona su menu (platos, fotos, categorias, precios)
- Recibe llamadas de garzon en su celular
- 🚧 Crea promociones inteligentes sugeridas por IA
- 🚧 Envia email marketing segmentado

## Features principales

### Carta QR Viva
- 3 vistas: Lista (funcional), Clasica (visual), Espacial (cinematografica)
- Hero dinamico con plato destacado
- Fotos, precios, ingredientes, alergenos
- Adaptacion por horario y clima (reglas configurables)
- Banner de cumpleanos con A/B testing

### El Genio (personalizador de carta)
- Onboarding en 4 pasos: dieta, restricciones, dislikes, listo
- No sugiere un plato especifico — reordena y filtra la carta segun el perfil
- Recuerda preferencias entre visitas (localStorage) y se sincroniza con QRUser si el cliente se registra

### Llamada al garzon
- Boton en la carta QR
- Push notification al celular del garzon
- Panel en tiempo real con mesas activas
- Sin hardware, sin app, sin instalacion

### Admin / Dashboard
- Superadmin (Jaime): ve todos los locales
- Owner: ve solo su(s) local(es)
- Metricas: visitas, conversion, engagement, platos top, dietas
- Gestion de menus y platos

### 🚧 Genio Marketing (en construccion)
- Segmentacion automatica de clientes
- Promociones generadas por IA (Claude)
- Email marketing personalizado
- Promos in-app para visitantes anonimos

## Roadmap alto nivel

| Fase | Estado | Descripcion |
|------|--------|-------------|
| Carta QR + Genio | ✅ Live | 3 vistas, personalizador de carta, garzon |
| Tracking + GuestProfile | ✅ Live | Sesiones, dwell times, weather, merge |
| Admin multi-tenant | ✅ Live | Owners con auth, dashboard con metricas |
| Cron diario | ✅ Live | Cleanup, snapshots, tokens |
| Segmentacion | 🚧 Siguiente | Segmentos automaticos de clientes |
| Campanias manuales | 🚧 Planificado | Emails, templates, tracking |
| Promos IA | 🚧 Planificado | Claude sugiere promos al dueno |
| Email marketing | 🚧 Planificado | Envios segmentados, triggers |
| Promos in-app | 🚧 Planificado | Ofertas personalizadas a fantasmas |

## Modelo de negocio

- **Plan base**: 1 UF/mes (~$39.000 CLP) por local
  - Carta QR premium, Genio, garzon, estadisticas basicas
- **Modulos adicionales**:
  - Llamada al garzon: $9.900/mes
  - Estadisticas avanzadas: $9.900/mes
  - Email de cumpleanos: $14.900/mes
- **Setup**: $100.000 unico (configuracion completa)
- **Fotografia**: $150.000 opcional
- 🚧 **Genio Marketing**: 2-4 UF adicionales/mes
