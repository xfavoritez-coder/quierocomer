/**
 * Seed inicial para el módulo de Franquicias.
 * Crea: Marca KOJO → Local KOJO La Florida → Proyecto de apertura → 15 etapas con tareas.
 *
 * Ejecutar con: npx ts-node -r tsconfig-paths/register scripts/seed-franquicias.ts
 * (o con .env.prod: npx dotenv -e .env.prod -- npx ts-node -r tsconfig-paths/register scripts/seed-franquicias.ts)
 */
import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient, FranEstadoProyecto, FranEstadoLocal, FranPrioridad } from "@prisma/client";

const prisma = new PrismaClient();

const ETAPAS: { numero: number; nombre: string; tareas: string[] }[] = [
  {
    numero: 1,
    nombre: "01. Modelo de negocio",
    tareas: [
      "Definir inversión estimada total",
      "Establecer ventas objetivo mensuales",
      "Construir estructura de costos",
      "Calcular margen bruto esperado",
      "Calcular punto de equilibrio",
      "Definir estructura de royalty",
      "Proyectar retorno de inversión (ROI)",
    ],
  },
  {
    numero: 2,
    nombre: "02. Selección del local",
    tareas: [
      "Definir zona geográfica objetivo",
      "Analizar tráfico peatonal y vehicular",
      "Mapear competencia en el sector",
      "Verificar tamaño mínimo requerido",
      "Verificar sistema de extracción existente",
      "Verificar capacidad eléctrica disponible",
      "Verificar disponibilidad de agua y desagüe",
      "Evaluar estacionamientos disponibles",
      "Evaluar acceso para delivery",
      "Negociar condiciones de arriendo",
      "Aprobación final del local",
    ],
  },
  {
    numero: 3,
    nombre: "03. Legal",
    tareas: [
      "Constituir sociedad o definir estructura legal",
      "Redactar y firmar contrato de arriendo",
      "Tramitar patente municipal",
      "Obtener permisos sanitarios",
      "Registrar propiedad intelectual de la marca",
      "Revisar contratos con proveedores clave",
    ],
  },
  {
    numero: 4,
    nombre: "04. Arquitectura",
    tareas: [
      "Realizar levantamiento del local",
      "Diseñar layout operacional",
      "Validar flujo de cocina y servicio",
      "Aprobar planos arquitectónicos",
      "Definir diseño interior y materiales",
      "Diseñar fachada y letreros",
    ],
  },
  {
    numero: 5,
    nombre: "05. Construcción",
    tareas: [
      "Preparar presupuesto de obra",
      "Solicitar mínimo 3 cotizaciones de construcción",
      "Seleccionar y contratar contratista",
      "Instalación eléctrica",
      "Instalación sanitaria (agua y desagüe)",
      "Instalación de gas",
      "Sistema de extracción y ventilación",
      "Terminaciones (pisos, paredes, cielos)",
      "Inspección final de obra",
    ],
  },
  {
    numero: 6,
    nombre: "06. Equipamiento",
    tareas: [
      "Crear listado definitivo de equipos",
      "Solicitar cotizaciones de equipamiento",
      "Comprar equipos",
      "Coordinar instalación de equipos",
      "Realizar pruebas de funcionamiento",
    ],
  },
  {
    numero: 7,
    nombre: "07. Proveedores",
    tareas: [
      "Seleccionar proveedor de ingredientes principales",
      "Seleccionar proveedor de packaging",
      "Seleccionar proveedor de bebidas",
      "Seleccionar proveedor de artículos de aseo",
      "Definir proveedores tecnológicos",
      "Cerrar contratos con proveedores",
    ],
  },
  {
    numero: 8,
    nombre: "08. Producto",
    tareas: [
      "Definir carta definitiva",
      "Estandarizar recetas",
      "Definir gramajes por preparación",
      "Calcular costo unitario por plato",
      "Definir presentación de platos",
      "Fotografías para carta digital",
    ],
  },
  {
    numero: 9,
    nombre: "09. Recursos humanos",
    tareas: [
      "Definir organigrama del local",
      "Crear perfiles de cargo",
      "Realizar proceso de contratación",
      "Firmar contratos laborales",
      "Definir turnos y horarios",
    ],
  },
  {
    numero: 10,
    nombre: "10. Capacitación",
    tareas: [
      "Capacitación cocina (recetas y procesos)",
      "Capacitación atención y servicio",
      "Capacitación caja y pagos",
      "Capacitación delivery",
      "Capacitación limpieza y sanitización",
      "Capacitación seguridad y emergencias",
      "Inducción cultura de la marca",
    ],
  },
  {
    numero: 11,
    nombre: "11. Tecnología",
    tareas: [
      "Instalar y configurar POS",
      "Configurar ecommerce / pedidos online",
      "Integrar plataformas de delivery",
      "Instalar impresoras de cocina y caja",
      "Instalar internet y red interna",
      "Instalar cámaras de seguridad",
      "Configurar sistema de inventario",
      "Configurar QuieroComer",
    ],
  },
  {
    numero: 12,
    nombre: "12. Marketing",
    tareas: [
      "Diseñar plan de lanzamiento",
      "Crear perfiles en redes sociales",
      "Configurar Google Business Profile",
      "Definir promociones de apertura",
      "Producir contenido fotográfico y video",
      "Lanzar publicidad local previa a apertura",
    ],
  },
  {
    numero: 13,
    nombre: "13. Preapertura",
    tareas: [
      "Completar inventario inicial",
      "Prueba general de todos los equipos",
      "Simulaciones de servicio completo",
      "Marcha blanca con clientes invitados",
      "Completar checklist de apertura",
    ],
  },
  {
    numero: 14,
    nombre: "14. Apertura",
    tareas: [
      "Día de apertura oficial",
      "Seguimiento operacional día 1",
      "Seguimiento operacional día 2",
      "Seguimiento operacional día 3",
      "Registro y resolución de problemas iniciales",
      "Registro de ventas primera semana",
      "Recolección de feedback inicial",
    ],
  },
  {
    numero: 15,
    nombre: "15. Postapertura",
    tareas: [
      "Revisión operacional 30 días",
      "Revisión operacional 60 días",
      "Revisión operacional 90 días",
      "Análisis de ventas primer trimestre",
      "Análisis de costos y márgenes",
      "Evaluación de desempeño del personal",
      "Análisis de aceptación del producto",
      "Análisis de satisfacción de clientes",
      "Análisis de operación y procesos",
    ],
  },
];

async function main() {
  console.log("🌱 Iniciando seed de Franquicias...");

  // Upsert marca KOJO
  const marca = await prisma.franMarca.upsert({
    where: { slug: "kojo" },
    update: {},
    create: {
      slug: "kojo",
      nombre: "KOJO",
      descripcion: "Restaurante de cocina japonesa contemporánea.",
      version: "KOJO Franchise System v0.1",
      activa: true,
    },
  });
  console.log(`✅ Marca: ${marca.nombre} (${marca.id})`);

  // Upsert local KOJO La Florida
  const local = await prisma.franLocal.upsert({
    where: { slug: "kojo-la-florida" },
    update: {},
    create: {
      slug: "kojo-la-florida",
      nombre: "KOJO La Florida",
      marcaId: marca.id,
      estado: FranEstadoLocal.EN_PROYECTO,
    },
  });
  console.log(`✅ Local: ${local.nombre} (${local.id})`);

  // Upsert proyecto de apertura
  const proyecto = await prisma.franProyecto.upsert({
    where: { slug: "apertura-kojo-la-florida" },
    update: {},
    create: {
      slug: "apertura-kojo-la-florida",
      nombre: "Apertura KOJO La Florida",
      marcaId: marca.id,
      localId: local.id,
      estado: FranEstadoProyecto.EN_DESARROLLO,
      responsable: "Jaime",
    },
  });
  console.log(`✅ Proyecto: ${proyecto.nombre} (${proyecto.id})`);

  // Crear hitos clave
  const hitosExistentes = await prisma.franHito.count({ where: { proyectoId: proyecto.id } });
  if (hitosExistentes === 0) {
    const hitos = [
      { titulo: "Local firmado", orden: 1 },
      { titulo: "Planos aprobados", orden: 2 },
      { titulo: "Obra terminada", orden: 3 },
      { titulo: "Permisos obtenidos", orden: 4 },
      { titulo: "Marcha blanca", orden: 5 },
      { titulo: "Apertura oficial", orden: 6 },
    ];
    await prisma.franHito.createMany({
      data: hitos.map((h) => ({ ...h, proyectoId: proyecto.id })),
    });
    console.log(`✅ ${hitos.length} hitos creados`);
  }

  // Crear etapas y tareas
  for (const etapaData of ETAPAS) {
    const etapaExistente = await prisma.franEtapa.findFirst({
      where: { proyectoId: proyecto.id, numero: etapaData.numero },
    });

    let etapa = etapaExistente;
    if (!etapa) {
      etapa = await prisma.franEtapa.create({
        data: {
          proyectoId: proyecto.id,
          numero: etapaData.numero,
          nombre: etapaData.nombre,
          orden: etapaData.numero,
        },
      });
      console.log(`  📁 Etapa ${etapaData.numero}: ${etapaData.nombre}`);
    }

    const tareasExistentes = await prisma.franTarea.count({ where: { etapaId: etapa.id } });
    if (tareasExistentes === 0) {
      await prisma.franTarea.createMany({
        data: etapaData.tareas.map((titulo, i) => ({
          etapaId: etapa!.id,
          titulo,
          orden: i,
          prioridad: FranPrioridad.MEDIA,
          peso: 1,
        })),
      });
      console.log(`     └─ ${etapaData.tareas.length} tareas creadas`);
    }
  }

  console.log("\n✅ Seed completado.");
  console.log(`   Marca:    ${marca.nombre}`);
  console.log(`   Local:    ${local.nombre}`);
  console.log(`   Proyecto: ${proyecto.nombre}`);
  console.log(`   Etapas:   ${ETAPAS.length}`);
  console.log(`   Tareas:   ${ETAPAS.reduce((sum, e) => sum + e.tareas.length, 0)}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
