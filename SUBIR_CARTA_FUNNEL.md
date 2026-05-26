# Pendientes del funnel subir carta

## SEGURIDAD — demo-auth abierto (URGENTE)

El endpoint `/api/panel/demo-auth?slug=xxx` permite entrar al panel de CUALQUIER restaurante solo con el slug, sin contraseña. Es un riesgo de seguridad serio.

**Fix requerido:**
1. `demo-auth` solo debe funcionar para restaurantes con `isDemo: true`
2. Para restaurantes activados, usar auto-login con token firmado (`buildAutoLoginUrl` en `src/lib/email/autoLoginUrl.ts`)
3. Reemplazar todos los usos de `demo-auth` en:
   - Emails (activación, semanal, resend) → usar `buildAutoLoginUrl`
   - OwnerBanner (`src/components/qr/carta/OwnerBanner.tsx`) → usar auto-login
   - /exito (`src/app/activar/[slug]/exito/ExitoClient.tsx`) → usar auto-login
   - Admin actividad (`src/app/(main)/admin/actividad/page.tsx`) → mantener (es admin)
4. Ya existe `src/lib/email/autoLoginUrl.ts` con HMAC firmado, usar eso

**Archivos afectados:** ver grep de `demo-auth` en `src/**/*.{ts,tsx}` — ~14 archivos

## Parte 2 — Banner owner logueado

Banner flotante para dueños logueados viendo su carta. Ya implementado (`OwnerBanner.tsx`).
Pendiente: usar auto-login en vez de demo-auth para el botón "Mi panel".

## Parte 3 — Panel sin datos ficticios

Cuando el dueño entra por primera vez al panel, mostrar datos reales (en cero) en vez de datos demo inventados.
Esto aplica a la página principal del panel (`src/app/(panel)/panel/page.tsx`) donde hay `DEMO_DATA` con números falsos.
