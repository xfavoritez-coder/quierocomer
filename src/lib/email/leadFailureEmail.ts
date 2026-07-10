/**
 * Automatic email sent to leads when their carta processing fails.
 * Diagnoses the error type and provides specific help + suggests uploading a photo as alternative.
 */

import { sendAdminEmail, adminEmailTemplate } from "./sendAdminEmail";
import { prisma } from "@/lib/prisma";

const GOLD = "#e8930a";
const SUBIR_URL = "https://quierocomer.com";

interface FailureEmailOptions {
  leadId: string;
  to: string;
  ownerName: string;
  restaurantName: string;
  errorMsg: string;
  cartaUrl?: string;
}

type FailureType = "gdrive_permisos" | "pdf_grande" | "link_no_carta" | "acceso" | "generico";

function classifyError(errorMsg: string, cartaUrl?: string): FailureType {
  const lower = errorMsg.toLowerCase();
  if (lower.includes("restricted") || lower.includes("restringido") || (lower.includes("google drive") && lower.includes("html page"))) return "gdrive_permisos";
  if (lower.includes("too large") || lower.includes("muy grande") || lower.includes("exceeds") || lower.includes("size limit")) return "pdf_grande";
  if (lower.includes("no parece ser una carta") || lower.includes("no dishes extracted")) return "link_no_carta";
  if (lower.includes("no se pudo acceder") || lower.includes("failed to fetch") || lower.includes("timeout")) return "acceso";
  return "generico";
}

function getHelpContent(type: FailureType, restaurantName: string, cartaUrl?: string): { title: string; explanation: string; steps: string } {
  switch (type) {
    case "gdrive_permisos":
      return {
        title: "No pudimos acceder a tu archivo de Google Drive",
        explanation: `Intentamos crear la carta digital de <strong>${restaurantName}</strong>, pero el archivo de Google Drive tiene acceso restringido.`,
        steps: `1. Abre tu archivo en Google Drive<br/>
          2. Haz clic en <strong>Compartir</strong> (arriba a la derecha)<br/>
          3. En "Acceso general", cambia de <em>Restringido</em> a <strong>Cualquier persona con el enlace</strong><br/>
          4. Haz clic en <strong>Listo</strong>`,
      };
    case "pdf_grande":
      return {
        title: "Tu archivo es demasiado grande",
        explanation: `El archivo que subiste para <strong>${restaurantName}</strong> es muy pesado para procesarlo. Esto pasa con PDFs de alta resolución o con muchas páginas.`,
        steps: `1. Intenta comprimir el PDF (puedes usar ilovepdf.com)<br/>
          2. O exporta solo las páginas de la carta (sin portada ni contraportada)<br/>
          3. Si prefieres, puedes subir fotos de cada página`,
      };
    case "link_no_carta":
      return {
        title: "No encontramos la carta en el link",
        explanation: `Visitamos el link que nos compartiste para <strong>${restaurantName}</strong>, pero no pudimos encontrar los platos y precios de tu carta.`,
        steps: `1. Revisa que el link lleve directamente a tu menú con precios<br/>
          2. Si tu carta está en un PDF o imagen dentro de la página, descárgala y súbela directamente<br/>
          3. Si tu menú requiere login o está detrás de una app, sube fotos de la carta`,
      };
    case "acceso":
      return {
        title: "No pudimos acceder al link",
        explanation: `Intentamos acceder al link que nos compartiste para <strong>${restaurantName}</strong>, pero el sitio no respondió o bloqueó el acceso.`,
        steps: `1. Revisa que el link funcione abriendo una ventana de incógnito<br/>
          2. Si el link necesita contraseña, comparte la carta como PDF o foto<br/>
          3. Si el sitio está temporalmente caído, puedes volver a intentar más tarde`,
      };
    default:
      return {
        title: "No pudimos procesar tu carta",
        explanation: `Tuvimos un problema al crear la carta digital de <strong>${restaurantName}</strong>. Nuestro equipo ya fue notificado.`,
        steps: `1. Puedes volver a intentar subiendo tu carta nuevamente<br/>
          2. Si tienes la carta en otro formato (PDF, foto, link diferente), prueba con ese`,
      };
  }
}

/** Max failure emails per person before we stop asking them to retry */
const MAX_FAILURE_EMAILS = 2;

export async function sendLeadFailureEmail({ leadId, to, ownerName, restaurantName, errorMsg, cartaUrl }: FailureEmailOptions) {
  // Anti-loop: don't send if we already sent a failure email to THIS lead
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { events: true } });
  const events = (lead?.events as any[]) || [];
  if (events.some((e: any) => e.action === "email_failure_sent" || e.action === "email_escalated_sent")) return;

  // Count how many failure emails this person has received across ALL their leads
  const recentLeads = await prisma.lead.findMany({
    where: { email: to, cartaStatus: "FAILED" },
    select: { events: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const totalFailEmails = recentLeads.reduce((count, l) => {
    const evts = (Array.isArray(l.events) ? l.events : []) as any[];
    return count + evts.filter((e: any) => e.action === "email_failure_sent").length;
  }, 0);

  const isEscalation = totalFailEmails >= MAX_FAILURE_EMAILS;

  let html: string;
  let subject: string;

  if (isEscalation) {
    // 3rd+ attempt: stop asking to retry, tell them a human will handle it
    html = adminEmailTemplate(`
      <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;text-align:center;">
        ${ownerName}, ya estamos en esto
      </h1>
      <div style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
        Vemos que has intentado subir la carta de <strong>${restaurantName}</strong> varias veces sin éxito.
        No te preocupes — <strong>alguien de nuestro equipo va a revisar tu caso personalmente</strong> y te contactará pronto para ayudarte.
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:14px;margin-bottom:20px;">
        <tr><td style="padding:16px 18px;text-align:center;">
          <div style="font-size:14px;color:#7a6547;line-height:1.8;">
            No necesitas hacer nada más. Nosotros nos encargamos desde aquí.
          </div>
        </td></tr>
      </table>
      <div style="font-size:13px;color:#b8a888;text-align:center;line-height:1.6;padding-top:16px;">
        Si mientras tanto quieres contarnos algo, simplemente responde este email.
      </div>
    `);
    subject = `${ownerName}, ya estamos revisando tu carta`;
  } else {
    const type = classifyError(errorMsg, cartaUrl);
    const help = getHelpContent(type, restaurantName, cartaUrl);

    html = adminEmailTemplate(`
      <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;text-align:center;">
        ${ownerName}, falta un paso para tu carta
      </h1>
      <div style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;">
        ${help.explanation}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:14px;margin-bottom:20px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Cómo solucionarlo</div>
          <div style="font-size:14px;color:#7a6547;line-height:1.8;">
            ${help.steps}
          </div>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid ${GOLD}33;border-radius:14px;margin-bottom:20px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Opción más fácil</div>
          <div style="font-size:14px;color:#7a6547;line-height:1.7;">
            Si prefieres algo más rápido, puedes <strong>sacarle una foto a tu carta</strong> y subirla directamente. Aceptamos fotos en JPG o PNG y nuestro sistema las procesa automáticamente.
          </div>
        </td></tr>
      </table>
      <div style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
        Una vez que soluciones esto, nosotros nos encargamos del resto. Tu carta estará lista en minutos.
      </div>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0;">
        <a href="${SUBIR_URL}" style="display:inline-block;background:${GOLD};color:#fff;font-size:15px;font-weight:800;padding:14px 32px;border-radius:14px;text-decoration:none;">Volver a subir mi carta</a>
      </td></tr></table>
      <div style="font-size:13px;color:#b8a888;text-align:center;line-height:1.6;padding-top:16px;">
        Si tienes dudas, simplemente responde este email y te ayudamos.
      </div>
    `);
    subject = `${ownerName}, tu carta de ${restaurantName} está casi lista`;
  }

  await sendAdminEmail({
    to,
    subject,
    html,
    purpose: isEscalation ? "lead_failure_escalated" : "lead_failure_help",
  });

  // Track in lead events
  const action = isEscalation ? "email_escalated_sent" : "email_failure_sent";
  events.push({ ts: new Date().toISOString(), action, type: isEscalation ? "escalated" : classifyError(errorMsg, cartaUrl) });
  await prisma.lead.update({
    where: { id: leadId },
    data: { events: events as any },
  });

  if (isEscalation) {
    console.log(`[FailureEmail] Escalated to human review for ${to} (${totalFailEmails + 1} failed attempts)`);
  }
}
