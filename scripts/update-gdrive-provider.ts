import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const provider = await p.menuProvider.findFirst({
    where: { name: 'GoogleDrive' },
  });

  if (!provider) {
    console.error('GoogleDrive provider not found');
    return;
  }

  console.log('Current notes:', provider.notes);

  await p.menuProvider.update({
    where: { id: provider.id },
    data: {
      notes: `PDFs compartidos por Google Drive. Descarga directa via /uc?export=download&id={FILE_ID}. Maneja confirmación de archivos grandes (virus scan) automáticamente. El PDF se sube temporalmente a Supabase Storage y se pasa a extractFromDocument. Estrategia de extracción por tamaño: (1) PDF ≤3.3MB → se envía completo como documento base64 a Claude PDF Vision (beta pdfs-2024-09-25). (2) PDF >3.3MB → intenta renderizar páginas a JPEG con pdfjs-dist+@napi-rs/canvas. (3) Si el render falla (ej: paths vectoriales incompatibles como Misceláneo Bar 42.5MB) → fallback a split por página con pdf-lib, envía cada página individualmente a Claude. Caso exitoso: La Fábrica 16pp/182 platos, Misceláneo Bar 15pp/151 platos (post-fix mayo 2026). NO usar pdf-lib para manipular el PDF completo en memoria si es muy grande — solo copiar páginas individuales.`,
      lastFailReason: null,
    },
  });

  console.log('Updated GoogleDrive provider notes');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
