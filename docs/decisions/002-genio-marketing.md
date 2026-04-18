# ADR-002: Genio Marketing como modulo separado

**Fecha**: Abril 2026
**Estado**: En implementacion

## Contexto

QuieroComer ya captura datos valiosos de cada comensal a traves del Genio: dieta, restricciones, platos preferidos, horarios, clima. Estos datos estan subutilizados — solo se usan para la recomendacion inmediata.

Los duenos de local quieren saber quienes son sus clientes, que buscan, y como traerlos de vuelta. Hoy no tienen herramientas para esto.

## Decision

Crear "Genio Marketing" como modulo premium separado del plan base:
- Se cobra aparte (2-4 UF/mes adicionales)
- Incluye: segmentacion, promos IA, email marketing, dashboard avanzado
- Se construye en fases incrementales (6 fases, ~7 semanas)

La infraestructura de captura (GuestProfile, Sessions, tracking) se implementa para TODOS los locales desde el dia 1, incluso los que no pagan el modulo. Asi se acumulan datos desde antes de que el dueno active Marketing.

## Consecuencias

**Positivas:**
- Revenue adicional significativo por local
- Los datos ya se capturan, solo falta explotarlos
- El rollout por fases reduce riesgo
- La captura universal permite demos convincentes ("mira cuantos vegetarianos tienes")

**Negativas:**
- Complejidad de multi-tenancy en el admin (owner vs superadmin)
- Costo de Resend escala con volumen de emails
- Necesita contenido de calidad (templates, copy) para que los emails no sean spam
- Claude API tiene costo por cada generacion de promo

## Alternativas consideradas

1. **Todo incluido en el plan base**: descartado porque el valor de marketing justifica precio aparte y no todos los locales lo necesitan.
2. **Solo dashboard sin email**: descartado porque el email es el canal de mayor ROI para restaurantes.
3. **Integracion con Mailchimp/etc**: descartado porque perdemos control de la segmentacion y datos del Genio.
