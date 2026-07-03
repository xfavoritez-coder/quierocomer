# QuieroComer Control — Plan Maestro

## Qué es

Módulo de control operacional para restaurantes gastronómicos. Vive dentro del monorepo de QuieroComer (Next.js + Prisma + Supabase + Vercel), comparte auth y panel de dueños existentes.

**Objetivo comercial:** venderlo como módulo adicional a la base de locales de Carta QR Viva.
**Piloto:** Horus Vegan.
**Estado actual:** schema en DB ✅ (migrado el 2026-07-03).

---

## Filosofía

- **No es un kardex perpetuo.** No hay stock en tiempo real ni descuento automático por venta.
- **Modelo contable y periódico:** `Consumo real = Inventario inicial + Compras − Inventario final` comparado contra ventas del POS.
- **Todo lo de cocina pasa por PAPEL → FOTO → IA → CONFIRMACIÓN HUMANA.** Los cocineros nunca tocan un celular.
- **Valor incremental por nivel.** El local que solo registra compras ya obtiene historial de precios y alertas. El que agrega conteo semanal obtiene food cost real. El que carga ventas cierra el loop.
- **Fricción mínima gana a precisión máxima.** Un dato aproximado ingresado > un dato perfecto que nadie ingresa.

---

## El loop completo

```
COMPRAS → PRODUCCIÓN/RECETARIO → VENTAS → MERMA → FOOD COST
```

Fase 1 cubre todo excepto recetario. Fase 2 cierra el loop con fichas técnicas y consumo teórico.

---

## Decisiones de diseño tomadas

### Ventas: upload de archivo, no integración API

Los POS (Toteat, Fudo, Bsale, etc.) todos exportan un reporte diario de ventas por producto. El flujo es:
1. Dueño descarga el reporte de su POS al cierre del día (PDF, Excel, CSV)
2. Lo sube al sistema
3. IA parsea el archivo → extrae productos vendidos + cantidades + totales
4. Se puebla `VentaDia` + `VentaLinea` con el detalle por producto

**Por qué no integración API directa:** cero fricción de onboarding, funciona con cualquier POS, no requiere que el local comparta credenciales. Cuando el volumen lo justifique, se agrega el adaptador API de cada POS como capa adicional sobre la misma arquitectura.

El modelo tiene `PosProveedor.MANUAL` y `VentaDia.origen` listos para esto. El detalle por producto en `VentaLinea` es lo que permite calcular consumo teórico con el recetario en Fase 2.

### El recetario no es opcional a largo plazo

Sin detalle de productos vendidos + recetario, el food cost es aproximado. Con ambos, el sistema puede decir: "vendiste 50 Hamburguesas Horus → teóricamente consumiste 7.5 kg de carne → compraste 9 kg → merma esperada 1.5 kg". Eso es el control real.

### POS propio como visión de largo plazo

QuieroComer Carta ya tiene carta digital, sistema de mesas, llamada al garzón y auth de clientes. El gap hacia un POS ligero es: toma de pedido por garzón → estado de cocina → cierre de cuenta. Si ese POS existe algún día, el módulo Control se alimenta automáticamente sin subir nada.

---

## Schema (ya en DB)

Modelos creados:

| Modelo | Descripción |
|--------|-------------|
| `InsumoMaestro` | Catálogo maestro chileno compartido (~120 insumos con aliases para matching IA) |
| `Insumo` | Insumo por restaurante, vinculado opcionalmente al maestro |
| `Compra` | Cabecera de compra (boleta, factura, hoja de feria, manual) |
| `CompraLinea` | Línea de compra: insumo, cantidad, precio unitario |
| `Conteo` | Conteo de inventario (semanal, apertura, cierre de mes) |
| `ConteoLinea` | Línea de conteo: insumo + cantidad + valorizado |
| `Merma` | Registro de merma diaria |
| `MermaLinea` | Línea de merma: insumo, cantidad, motivo, valorizado |
| `VentaDia` | Agregado diario de ventas (único por restaurante+fecha) |
| `VentaLinea` | Detalle de productos vendidos en el día (base del consumo teórico) |
| `HojaImpresa` | Hoja imprimible con snapshot + QR para ingreso por foto |

Campo `controlEnabled Boolean @default(false)` en Restaurant para activar el módulo por local.

---

## Fase 1 — MVP (lo que construimos)

### 1. Catálogo de insumos

- Seed con ~120 insumos chilenos organizados por categoría (proteína, verdura/fruta, abarrote, lácteo, panadería, bebida, desechable, limpieza)
- Cada insumo maestro tiene aliases para matching de IA ("palta", "palta hass", "aguacate")
- Wizard de onboarding: el local selecciona los insumos que usa de una lista agrupada + puede agregar los que falten
- Los insumos críticos (los que van al conteo semanal) se marcan y se ordenan como están físicamente en la cocina/refrigerador
- CRUD de insumos en el panel

### 2. Registro de compras

El workflow más frecuente (2-5 veces/semana):

1. Dueño o encargado saca foto de la boleta/factura/hoja de feria
2. Se sube a Supabase Storage
3. API route llama a Claude Vision con la imagen + catálogo de insumos del restaurante (nombres + aliases) como contexto
4. Claude devuelve JSON estructurado: proveedor, total, líneas con `textoOriginal / cantidad / unidad / precioTotal / insumoSugeridoId / confianza`
5. Pantalla de confirmación: foto al lado de las líneas extraídas. Match en verde si confianza alta, dropdown para corregir, opción "crear insumo nuevo" inline (3 campos: nombre, categoría, unidad)
6. Confirmar → estado `CONFIRMADA`, se calculan precios unitarios, se actualiza `Insumo.ultimoPrecio`

**Regla de oro UX:** confirmar una boleta de 15 líneas debe tomar < 60 segundos cuando la IA acierta.

Fallback siempre disponible: si la foto es ilegible, el dueño digita las líneas manualmente en la misma pantalla.

### 3. Registro de ventas (upload de reporte POS)

1. Dueño descarga el reporte de ventas del día desde su POS
2. Lo sube en el panel (PDF, imagen, Excel, CSV)
3. Claude lo parsea → extrae productos vendidos + cantidades + totales
4. Pantalla de confirmación: productos extraídos con su cantidad y total
5. Confirmar → se crea `VentaDia` + `VentaLinea[]` con el detalle

**Alternativa si no tienen POS:** formulario manual para ingresar solo el total del día (sin detalle de productos). El food cost queda aproximado hasta que haya recetario, pero al menos tiene el denominador.

### 4. Hojas imprimibles con QR

Tres hojas para el trabajo de cocina en papel:

**Hoja de Conteo Semanal**
- Pre-poblada con insumos `esCritico=true` en el orden definido por el dueño
- Columnas: Insumo | Unidad | Cantidad (casilla grande para lápiz)
- Máx 25 filas por página

**Hoja de Merma Diaria**
- Filas vacías (~15)
- Columnas: Qué | Cantidad | Motivo (casillas: Vencido / Quemado / Devolución / Sobró / Colación / Derrame / Otro) | Nota
- Instrucción al pie: "Anota al tiro, foto al cierre"

**Hoja de Compras de Feria**
- Filas vacías
- Columnas: Insumo | Cantidad | Unidad | Precio pagado
- Header: dónde compraste + efectivo/transferencia

Cada hoja tiene QR (~2.5cm) que codifica `hojaId`. Cuando el dueño fotografía la hoja llena, el sistema lee el QR, carga el `snapshot` (lista de insumos y orden exacto al momento de imprimir) y lo entrega a Claude como contexto → matching casi automático.

**Generación:** panel → "Imprimir hojas" → seleccionar tipo → se crea `HojaImpresa` con snapshot → vista de impresión. Sugerir imprimir el stock de la semana de una vez (7 hojas de merma + 1 conteo + N feria).

### 5. Conteo semanal y merma

Mismo pipeline que compras (foto → IA → confirmación), con el contexto del snapshot vía QR.

**Conteo:** al confirmar, se valorizan las líneas (cantidad × `ultimoPrecio` del insumo en ese momento, snapshotado — no se recalcula si el precio cambia después).

**Merma:** ídem. Se registra el motivo por línea.

### 6. Dashboard

**Número héroe — Food cost % semanal:**
```
foodCost% = (valorConteoAnterior + comprasSemana − valorConteoActual) / ventasNetasSemana
```
- Solo se calcula con dos conteos consecutivos confirmados
- Sin conteos: versión aproximada `comprasSemana / ventasNetas` con etiqueta "aproximado"
- Semáforo configurable: verde <32%, amarillo 32-38%, rojo >38%
- DESECHABLE y LIMPIEZA se excluyen del food cost y se muestran aparte como "otros costos operacionales"

**Merma valorizada:** total semanal en $, desglose por motivo y por insumo top.
Frase generada: *"Esta semana se perdieron $47.200, principalmente pollo por vencimiento."*

**Alertas de precio:** al confirmar una compra, se compara `precioUnitario` vs promedio de las últimas 3 compras del mismo insumo. Si |delta| > 10% → alerta en dashboard: "🔺 Aceite subió 15% vs tu último precio".

**Historial de precios por insumo:** gráfico de línea simple con un punto por compra, `proveedorNombre` en tooltip. No necesita tabla propia — se deriva de `CompraLinea` ordenado por fecha.

**Tira de ventas:** ventas diarias de los últimos 14 días para que el dueño confíe en que el sistema está al día.

### 7. Onboarding del módulo (wizard 4 pasos)

1. **Insumos:** catálogo maestro agrupado por categoría con checkboxes. Botón "agregar otro" inline.
2. **Críticos:** de los seleccionados, marcar 15-25 como críticos y ordenarlos con drag & drop ("ordénalos como están físicamente en tu cocina/refri").
3. **Ventas:** elegir cómo ingresarán ventas (upload de reporte POS o ingreso manual de total).
4. **Imprimir:** genera e imprime el primer set de hojas. Fin.

---

## Fase 2 (documentado, NO construir aún)

### Recetario / Fichas técnicas
- Solo para el top 20 de platos vendidos (el detalle de ventas ya dice cuáles son)
- Cada receta: lista de insumos + cantidad por porción + rendimiento (el salmón rinde 60%)
- Con recetario: consumo teórico → brecha por insumo → "te faltaron 4 kg de salmón vs lo vendido"
- Esto cierra el loop completo del control

### Consumo teórico vs real
- `VentaLinea` ya tiene el detalle de productos vendidos
- Receta × unidades vendidas = consumo teórico
- Consumo teórico vs (compras − conteo) = brecha real por insumo

### Integración API con POS
- Una vez validado el modelo con upload manual, agregar adaptadores API para Toteat, Fudo, Bsale
- La arquitectura de adaptadores ya está prevista en el schema (`PosProveedor` enum)
- El sync automático reemplaza el upload manual, el resto del sistema no cambia

### Integración SII
- Recepción de DTE para que las compras con factura entren automáticamente
- Elimina el paso de fotografiar facturas electrónicas

### Conexión con Carta QR Viva
- Mapeo `VentaLinea.productoExterno` → platos de la carta
- Si el food cost de un plato sube por alza de insumos → sugerir ajuste de precio en la carta
- El Genio puede priorizar platos de mejor margen

### POS propio
- QuieroComer Carta ya tiene: carta digital, mesas, llamada al garzón, auth de clientes
- Gap: toma de pedido por garzón → estado cocina → cierre de cuenta → pago en mesa
- Si se construye: `VentaDia` se alimenta automáticamente sin subir nada

### Benchmark anónimo
- "Tu food cost está 4 puntos sobre locales similares de QuieroComer"
- Dato que nadie más en Chile puede ofrecer con esta base de restaurantes

---

## Secuencia de construcción

### Etapa 0 — Schema ✅ COMPLETO
Schema en DB. Todos los modelos creados con relaciones, índices y convenciones del repo.

### Etapa 1 — Catálogo + onboarding ✅ COMPLETO (2026-07-03)
- 113 InsumoMaestro chilenos en DB (con aliases para matching IA)
- CRUD de insumos en panel: `/panel/control/insumos`
- Wizard onboarding 4 pasos: `/panel/control/onboarding`
- `controlEnabled = true` para Horus Vegan en DB
- Nav "Control" en sidebar cuando `controlEnabled` activo
- Hub en `/panel/control`: muestra estado del módulo y accesos

### Etapa 2 — Registro de compras
- Upload foto a Supabase Storage
- API route extracción con Claude Vision
- Pantalla de confirmación con matching y creación inline de insumos
- Actualización de `ultimoPrecio` en Insumo al confirmar

### Etapa 3 — Registro de ventas
- Upload de reporte POS (PDF/imagen/CSV)
- Parse con IA → `VentaDia` + `VentaLinea`
- Alternativa: formulario de total diario manual (sin detalle)

### Etapa 4 — Hojas imprimibles
- Las tres hojas con QR + snapshot
- Página "Imprimir hojas" en el panel
- Mockup visual antes de implementar

### Etapa 5 — Conteo y merma
- Pipeline foto + contexto de snapshot vía QR
- Pantallas de confirmación específicas para conteo y merma
- Valorización al confirmar

### Etapa 6 — Dashboard
- Food cost % (versión real + versión aproximada)
- Merma valorizada + desglose
- Alertas de precio
- Historial de precios por insumo
- Tira de ventas diaria

### Etapa 7 — Piloto Horus Vegan
- 2-3 semanas de operación real
- Ajustar prompts de Claude con boletas reales que fallen
- Ajustar hojas según feedback de cocina
- **Criterio de éxito:** food cost % real en dashboard, ingreso semanal de datos < 30 minutos acumulados

---

## Criterio comercial de éxito del piloto

Al final de la semana 3 con Horus Vegan:
- Dashboard muestra food cost % real (con dos conteos confirmados)
- El dueño puede decir "esta semana gasté $X en insumos, vendí $Y, mi food cost fue Z%"
- El ingreso total de datos de la semana tomó < 30 minutos de trabajo humano acumulado
- Al menos 1 alerta de precio útil generada ("el tomate subió X%")

Ese resultado es lo que se le muestra al siguiente cliente para vender el módulo.
