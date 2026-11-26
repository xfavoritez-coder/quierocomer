// Registro del dueño (/alta/[token]) y promoción del local demo a local real.
// Solo servidor.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { createPanelMagicToken } from "@/lib/magicLink";
import { hmac } from "@/lib/ventas/session";

export const REGISTRATION_DAYS = 14;
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** El token se deriva del lead + vencimiento con el secreto del servidor: así el recordatorio
 *  de 48 h puede reenviar el MISMO enlace (en la base solo queda su hash). */
export const registrationToken = (leadId: string, expiresAt: Date) => hmac(`alta:${leadId}:${expiresAt.getTime()}`);

/** Crea (o renueva) el enlace de registro del lead. Devuelve el token en claro UNA vez. */
export async function createRegistration(leadId: string, sentTo: string | null): Promise<{ token: string; expiresAt: Date }> {
  const existing = await prisma.leadRegistration.findUnique({ where: { leadId }, select: { completedAt: true } });
  if (existing?.completedAt) throw new Error("Este local ya completó su registro");
  const expiresAt = new Date(Date.now() + REGISTRATION_DAYS * 86400000 + crypto.randomInt(1000));
  const token = registrationToken(leadId, expiresAt);
  await prisma.leadRegistration.upsert({
    where: { leadId },
    create: { leadId, tokenHash: hash(token), expiresAt, sentTo },
    update: { tokenHash: hash(token), expiresAt, sentTo: sentTo ?? undefined, remindedAt: null },
  });
  return { token, expiresAt };
}

export const registrationUrl = (origin: string, token: string) => `${origin}/alta/${encodeURIComponent(token)}`;

/** Registro vigente para el token (null si no existe o venció). */
export async function findRegistration(token: string) {
  if (!token || token.length > 100) return null;
  const reg = await prisma.leadRegistration.findUnique({
    where: { tokenHash: hash(token) },
    include: {
      lead: {
        select: {
          id: true, localName: true, ownerName: true, email: true, whatsapp: true, cuisine: true, commune: true, generatedSlug: true, recommendedPlan: true,
          interestModules: true, crmStatus: true, crmStatusHistory: true, crmNotes: true, sellerId: true, createdAt: true,
          detectedProvider: { select: { name: true } }, seller: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!reg) return null;
  if (!reg.completedAt && reg.expiresAt.getTime() < Date.now()) return { ...reg, expired: true as const };
  return { ...reg, expired: false as const };
}

export async function sendRegistrationEmail(to: string, url: string, localName: string, sellerName: string | null) {
  await sendAdminEmail({
    to,
    subject: `${localName}: completa tu registro en QuieroComer`,
    purpose: "ventas_registro",
    html: `<!DOCTYPE html><html><body style="margin:0;background:#fbfaf7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<div style="max-width:460px;margin:0 auto;padding:40px 24px;text-align:center">
  <div style="font-size:22px;font-weight:800;color:#111">¡Bienvenido a QuieroComer!</div>
  <p style="font-size:15px;color:#555;line-height:1.6;margin:14px 0 26px">${sellerName ? `${esc(sellerName)} ya dejó` : "Ya dejamos"} <b>${esc(localName)}</b> listo con tu carta. Solo falta que confirmes tus datos: toma 2 minutos.</p>
  <a href="${esc(url)}" style="display:inline-block;background:#DE7C00;color:#fff;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;text-decoration:none">Completar mi registro</a>
  <p style="font-size:12px;color:#999;margin-top:26px">El enlace vence en ${REGISTRATION_DAYS} días. Si se te pasa, pídele uno nuevo a tu ejecutivo.</p>
</div></body></html>`,
  });
}

/** Mensaje de WhatsApp (wa.me) con el enlace de registro. */
export function whatsappLink(phone: string | null, localName: string, url: string) {
  const digits = (phone || "").replace(/\D/g, "");
  const to = digits.length === 9 ? `56${digits}` : digits; // celular chileno sin código de país
  const text = `¡Hola! Aquí está el enlace para dejar ${localName} funcionando en QuieroComer: ${url}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// ── Formulario ──────────────────────────────────────────────────────────────
export type RegistrationForm = {
  localName?: string; address?: string; commune?: string; localPhone?: string;
  ownerName?: string; ownerPhone?: string; email?: string; rut?: string; businessName?: string;
  currentSystem?: string; currentSystemLink?: string;
  cartaNote?: string;
  planId?: string;
  acceptTerms?: boolean;
  step?: number;
};

const str = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
export function cleanForm(o: unknown): RegistrationForm {
  const r = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
  return {
    localName: str(r.localName, 80), address: str(r.address, 200), commune: str(r.commune, 60), localPhone: str(r.localPhone, 30),
    ownerName: str(r.ownerName, 80), ownerPhone: str(r.ownerPhone, 30), email: str(r.email, 120)?.toLowerCase(), rut: str(r.rut, 20), businessName: str(r.businessName, 120),
    currentSystem: str(r.currentSystem, 40), currentSystemLink: str(r.currentSystemLink, 500),
    cartaNote: str(r.cartaNote, 500), planId: str(r.planId, 60),
    acceptTerms: r.acceptTerms === true, step: Number.isFinite(Number(r.step)) ? Math.max(0, Math.min(5, Number(r.step))) : undefined,
  };
}

/** RUT válido escrito con o sin puntos/guion (ej: 76.123.456-7, 761234567, 12.345.678-k). */
export const rutOk = (rut: string) => /^\d{7,8}[\dk]$/i.test(rut.replace(/[\s.\-]/g, ""));
export function validateForm(f: RegistrationForm): string | null {
  if (!f.localName) return "Falta el nombre del local";
  if (!f.ownerName) return "Falta tu nombre";
  if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Revisa tu correo";
  if (!f.ownerPhone || f.ownerPhone.replace(/\D/g, "").length < 8) return "Revisa tu teléfono o WhatsApp";
  if (f.rut && !rutOk(f.rut)) return "Revisa el RUT (ej: 76.123.456-7)";
  if (!f.planId) return "Elige un plan";
  if (!f.acceptTerms) return "Debes aceptar los términos";
  return null;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "local";

/**
 * Promueve el lead a local real:
 *  - cuenta del dueño (nueva, o se reutiliza si el correo ya tiene cuenta),
 *  - el local demo pasa a real (isDemo=false) y se limpian los datos de la demo
 *    (pedidos de prueba, llamadas al garzón, inscritos de la tarjeta, tienda/tarjeta de demo);
 *    si no había local demo (sin carta), se crea uno nuevo sin carta,
 *  - lead → "registrado", registro completado.
 * La facturación (plan, cobro, prueba) NO se toca: queda para el onboarding.
 */
export async function promoteRegistration(regId: string, f: RegistrationForm): Promise<{ ownerId: string; restaurantId: string; slug: string; createdOwner: boolean }> {
  const reg = await prisma.leadRegistration.findUnique({ where: { id: regId }, include: { lead: true } });
  if (!reg) throw new Error("Registro no encontrado");
  if (reg.completedAt) throw new Error("Este registro ya está completo");
  const lead = reg.lead;
  const email = f.email!.toLowerCase();

  return prisma.$transaction(async (tx) => {
    // 1) Cuenta del dueño
    let owner = await tx.restaurantOwner.findUnique({ where: { email }, select: { id: true } });
    let createdOwner = false;
    if (!owner) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 10); // entra por enlace; puede crear su clave con "olvidé mi contraseña"
      owner = await tx.restaurantOwner.create({ data: { email, name: f.ownerName!, passwordHash, role: "OWNER", whatsapp: f.ownerPhone || null }, select: { id: true } });
      createdOwner = true;
    }

    // 2) Local
    const demo = lead.generatedSlug ? await tx.restaurant.findUnique({ where: { slug: lead.generatedSlug }, select: { id: true, slug: true, isDemo: true, ecommerceStoreConfig: true } }) : null;
    let restaurantId: string; let slug: string;
    if (demo?.isDemo) {
      const { count } = await tx.restaurant.updateMany({
        where: { id: demo.id, isDemo: true },
        data: { isDemo: false, ownerId: owner.id, name: f.localName!, address: f.address || null, phone: f.localPhone || null, ecommerceEnabled: false },
      });
      if (count === 0) throw new Error("El local ya fue activado");
      // Quitar la configuración de la tienda de prueba
      const cfg = (demo.ecommerceStoreConfig && typeof demo.ecommerceStoreConfig === "object" && !Array.isArray(demo.ecommerceStoreConfig)) ? { ...(demo.ecommerceStoreConfig as Record<string, unknown>) } : null;
      if (cfg?.demoStore) {
        for (const k of ["demoStore", "paymentMethods", "pickupEnabled", "deliveryEnabled"]) delete cfg[k];
        await tx.restaurant.update({ where: { id: demo.id }, data: { ecommerceStoreConfig: cfg as object } });
      }
      // Limpiar lo que se hizo durante la demo (datos de prueba)
      const since = lead.createdAt;
      await tx.posOrder.deleteMany({ where: { restaurantId: demo.id, createdAt: { gte: since } } });
      await tx.onlineOrder.deleteMany({ where: { restaurantId: demo.id, createdAt: { gte: since } } });
      await tx.waiterCall.deleteMany({ where: { restaurantId: demo.id, createdAt: { gte: since } } });
      await tx.loyaltyMember.deleteMany({ where: { restaurantId: demo.id, enrolledAt: { gte: since } } });
      await tx.loyaltyProgram.updateMany({ where: { restaurantId: demo.id }, data: { active: false } });
      restaurantId = demo.id; slug = demo.slug;
    } else {
      const base = slugify(f.localName!);
      slug = base;
      for (let n = 2; await tx.restaurant.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`;
      const r = await tx.restaurant.create({
        data: { name: f.localName!, slug, ownerId: owner.id, isActive: true, isDemo: false, address: f.address || null, phone: f.localPhone || null, plan: "PREMIUM", billingExempt: true, qrActivatedAt: new Date() },
        select: { id: true },
      });
      restaurantId = r.id;
    }

    // 3) Lead y registro
    const now = new Date();
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        localName: f.localName!, ownerName: f.ownerName!, email, whatsapp: f.ownerPhone || null, commune: f.commune || lead.commune,
        recommendedPlan: f.planId || lead.recommendedPlan, convertedToOwnerId: owner.id, activated: true, activatedAt: now,
        generatedSlug: slug, crmStatus: "registrado", crmStatusHistory: { push: { status: "registrado", ts: now.toISOString() } },
      },
    });
    await tx.leadRegistration.update({ where: { id: regId }, data: { completedAt: now, formData: f as object } });
    await tx.leadEvent.createMany({
      data: [
        { leadId: lead.id, type: "registered", actor: "owner", payload: { planId: f.planId, currentSystem: f.currentSystem ?? null, createdOwner } as object },
        { leadId: lead.id, type: "onboarding_task", actor: "system", payload: { tasks: ["Configurar plan y cobro", f.currentSystem && f.currentSystem !== "ninguno" ? `Importar datos de ${f.currentSystem}` : null, "Imprimir QR", "Capacitación"].filter(Boolean) } as object },
      ],
    });
    return { ownerId: owner.id, restaurantId, slug, createdOwner };
  });
}

/** Correos después del registro: bienvenida al dueño y aviso al vendedor + administradores. */
export async function sendRegistrationFollowups(opts: { origin: string; ownerId: string; ownerEmail: string; ownerName: string; localName: string; slug: string; planName: string | null; seller: { name: string; email: string } | null; leadId: string; currentSystem?: string }) {
  const panelLink = `${opts.origin}/api/panel/magic-entry?t=${encodeURIComponent(createPanelMagicToken(opts.ownerId))}&r=${encodeURIComponent("/panel")}`;
  await sendAdminEmail({
    to: opts.ownerEmail,
    subject: `¡${opts.localName} ya está en QuieroComer!`,
    purpose: "ventas_bienvenida",
    html: `<!DOCTYPE html><html><body style="margin:0;background:#fbfaf7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<div style="max-width:460px;margin:0 auto;padding:40px 24px;text-align:center">
  <div style="font-size:24px;font-weight:800;color:#111">¡Listo, ${esc(opts.ownerName.split(" ")[0])}!</div>
  <p style="font-size:15px;color:#555;line-height:1.6;margin:14px 0 24px"><b>${esc(opts.localName)}</b> ya está en QuieroComer. Desde tu panel puedes editar tu carta, ver tus clientes y más.</p>
  <a href="${esc(panelLink)}" style="display:inline-block;background:#DE7C00;color:#fff;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;text-decoration:none">Entrar a mi panel</a>
  <p style="font-size:14px;color:#555;margin:24px 0 0">Tu carta: <a href="${esc(`${opts.origin}/qr/${opts.slug}`)}" style="color:#DE7C00">${esc(`${opts.origin.replace(/^https?:\/\//, "")}/qr/${opts.slug}`)}</a></p>
  <p style="font-size:12px;color:#999;margin-top:22px">En los próximos días te contactamos para dejar todo funcionando: plan, QR impresos y capacitación.</p>
</div></body></html>`,
  }).catch((e) => console.error("[ventas] bienvenida", e));

  const admins = await prisma.seller.findMany({ where: { role: "ADMIN", active: true }, select: { email: true } });
  const to = [...new Set([opts.seller?.email, ...admins.map((a) => a.email)].filter(Boolean) as string[])];
  for (const addr of to) {
    await sendAdminEmail({
      to: addr,
      subject: `🎉 ${opts.localName} se registró`,
      purpose: "ventas_registrado",
      skipLog: true,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px"><b>${esc(opts.localName)}</b> completó su registro${opts.seller ? ` (vendedor: ${esc(opts.seller.name)})` : ""}.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#555">Plan elegido: ${esc(opts.planName || "—")}<br>Dueño: ${esc(opts.ownerName)} · ${esc(opts.ownerEmail)}${opts.currentSystem ? `<br>Sistema actual: ${esc(opts.currentSystem)}` : ""}</p>
<p style="font-family:Arial,sans-serif;font-size:14px">Tarea de onboarding: configurar plan y cobro, importar datos si corresponde, imprimir QR y capacitación.</p>
<p><a href="${esc(`${opts.origin}/ventas/${opts.leadId}`)}">Ver en QuieroComer Ventas</a></p>`,
    }).catch((e) => console.error("[ventas] aviso registro", e));
  }
}
