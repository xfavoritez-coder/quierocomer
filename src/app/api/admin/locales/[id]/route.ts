import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const body = await req.json();
    const { accion, motivoRechazo } = body;

    const local = await prisma.local.findUnique({ where: { id }, select: { nombre: true, email: true, activo: true, id: true } });
    if (!local) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (accion === "reenviar-activacion") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.com";
      await resend.emails.send({
        from: `QuieroComer <${process.env.FROM_EMAIL || "noreply@quierocomer.com"}>`,
        to: [local.email],
        subject: "Activa tu local en QuieroComer",
        html: `<div style="background:#1a0e05;font-family:Georgia,serif;padding:40px;max-width:560px;margin:0 auto"><div style="text-align:center;margin-bottom:32px"><p style="font-size:28px;margin:0 0 8px">🧞</p><h1 style="color:#e8a84c;font-size:20px;letter-spacing:0.3em;text-transform:uppercase;margin:0">QuieroComer</h1></div><div style="background:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:40px 32px"><h2 style="color:#e8a84c;font-size:22px;margin-top:0;margin-bottom:16px">¡Tu local fue activado!</h2><p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px">Hola ${local.nombre}, tu local ya está visible en QuieroComer. Ingresa a tu panel para completar tu perfil y empezar a publicar.</p><div style="text-align:center"><a href="${appUrl}/login-local" style="background:#e8a84c;color:#1a0e05;font-size:14px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:16px 40px;border-radius:12px;display:inline-block">Ir a mi panel →</a></div></div></div>`,
      }).catch(err => console.error("[Email reenviar-activacion]", err));
      return NextResponse.json({ ok: true });
    }

    if (accion === "aprobar") {
      await prisma.local.update({ where: { id }, data: { activo: true, activadoAt: new Date() } });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.com";
      const from = `QuieroComer <${process.env.FROM_EMAIL || "noreply@quierocomer.com"}>`;

      // Check if local has complete data for the "local activo" email
      const localCompleto = await prisma.local.findUnique({ where: { id }, select: { nombre: true, email: true, slug: true, comuna: true, direccion: true, categorias: true, logoUrl: true } });
      const tieneDataCompleta = localCompleto && localCompleto.nombre && localCompleto.direccion && localCompleto.comuna && (localCompleto.categorias as string[])?.length > 0;
      const fichaUrl = `${appUrl}/locales/${localCompleto?.slug || id}`;

      await resend.emails.send({
        from,
        to: [local.email],
        subject: "¡Felicidades! Tu local ya está activo en QuieroComer",
        html: `<div style="background:#1a0e05;color:#f0ead6;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto"><div style="text-align:center;margin-bottom:24px"><p style="font-size:28px;margin:0 0 8px">🧞</p><h1 style="color:#e8a84c;font-size:20px;letter-spacing:0.3em;text-transform:uppercase;margin:0">QuieroComer</h1></div><div style="background:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:32px"><h2 style="color:#e8a84c;font-size:22px;margin:0 0 16px">¡Felicidades, ${local.nombre}! 🎉</h2><p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px">${tieneDataCompleta ? `Tu perfil está completo y tu local ya aparece en QuieroComer. Personas en ${localCompleto.comuna} ya pueden descubrirte. <a href="${fichaUrl}" style="color:#e8a84c;text-decoration:underline">Ver mi ficha en QuieroComer →</a>` : "Tu local fue revisado y aprobado. Ya apareces en QuieroComer y miles de personas pueden encontrarte."}</p><p style="color:#f5d080;font-size:17px;font-weight:bold;margin-bottom:8px">Ahora es momento de llegar a más personas</p><p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:20px">Crea tu <strong style="color:#f5d080">primer concurso viral</strong> y deja que cientos de personas compartan tu local con sus amigos. Los concursos son gratis para ti y generan alcance real.</p><div style="text-align:center;margin-bottom:20px"><a href="${appUrl}/panel/concursos" style="background:#e8a84c;color:#1a0e05;font-size:14px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:16px 40px;border-radius:12px;display:inline-block">Crear mi primer concurso →</a></div><p style="color:#c0a060;font-size:15px;line-height:1.7;margin-bottom:16px">¿Tienes algún descuento o promoción activa en tu local? Publícala en QuieroComer para que más personas la vean. Toma menos de 2 minutos.</p><div style="text-align:center"><a href="${appUrl}/panel/promociones" style="background:transparent;color:#e8a84c;font-size:14px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 36px;border-radius:12px;display:inline-block;border:1px solid rgba(232,168,76,0.4)">Publicar una promoción →</a></div></div></div>`,
      }).catch(err => console.error("[Email aprobar]", err));

      // Notify captador if local was referred
      try {
        const localFull = await prisma.local.findUnique({ where: { id }, include: { captador: true } });
        if (localFull?.captadorId && localFull.captador) {
          await resend.emails.send({
            from,
            to: localFull.captador.email,
            subject: "✅ Local activado — $10.000 a tu favor",
            html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;border-radius:12px"><div style="text-align:center;padding:20px;background:linear-gradient(135deg,#e8a84c,#d4922a);border-radius:12px;margin-bottom:24px"><p style="font-size:28px;margin:0 0 8px">✅</p><h1 style="color:#fff;font-size:18px;margin:0">¡Local activado!</h1></div><p style="font-size:15px;color:#333;line-height:1.6">Hola <strong>${localFull.captador.nombre}</strong>,</p><p style="font-size:15px;color:#333;line-height:1.6">El local <strong>"${localFull.nombre}"</strong> que registraste acaba de ser verificado y activado en QuieroComer.</p><div style="background:#f0faf5;border:1px solid #3db89e;border-radius:10px;padding:16px;margin:16px 0;text-align:center"><p style="font-size:14px;color:#333;margin:0">Tienes <strong style="color:#c47f1a;font-size:18px">$10.000</strong> a favor en tu cuenta.</p></div><p style="font-size:14px;color:#555;line-height:1.6">Recuerda que si este local publica su primer concurso, ganarás <strong>$5.000 adicionales</strong>.</p><p style="text-align:center;margin:24px 0"><a href="https://quierocomer.com/captador" style="background:#e8a84c;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Revisa tu panel →</a></p><p style="font-size:14px;color:#555">¡Sigue captando!</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0" /><p style="font-size:13px;color:#aaa;text-align:center">El equipo de QuieroComer 🧞</p></div>`,
          });
        }
      } catch (e) { console.error("[Email captador activacion]", e); }

      return NextResponse.json({ ok: true, accion: "aprobado" });
    }

    if (accion === "rechazar") {
      await prisma.local.update({ where: { id }, data: { activo: false } });
      const motivoHtml = motivoRechazo ? `<div style="background:rgba(255,255,255,0.05);border-left:3px solid #e8a84c;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px"><p style="font-size:14px;color:#c0a060;margin:0;line-height:1.6"><strong style="color:#f5d080">Motivo:</strong> ${motivoRechazo}</p></div>` : "";
      await resend.emails.send({
        from: `QuieroComer <${process.env.FROM_EMAIL || "noreply@quierocomer.com"}>`,
        to: [local.email],
        subject: "Actualización sobre tu solicitud en QuieroComer",
        html: `<div style="background:#1a0e05;color:#f0ead6;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto"><div style="text-align:center;margin-bottom:24px"><p style="font-size:28px;margin:0 0 8px">🧞</p><h1 style="color:#e8a84c;font-size:20px;letter-spacing:0.3em;text-transform:uppercase;margin:0">QuieroComer</h1></div><div style="background:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:32px"><h2 style="color:#e8a84c;font-size:20px;margin:0 0 16px">Sobre tu solicitud</h2><p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:16px">Hola <strong style="color:#f5d080">${local.nombre}</strong>, revisamos tu solicitud y por el momento no pudimos aprobarla.</p>${motivoHtml}<p style="color:#7a5a30;font-size:14px;line-height:1.7">Si tienes dudas puedes escribirnos a <a href="mailto:hola@quierocomer.com" style="color:#3db89e">hola@quierocomer.com</a></p></div></div>`,
      }).catch(err => console.error("[Email rechazar]", err));
      return NextResponse.json({ ok: true, accion: "rechazado" });
    }

    if (accion === "cambiar-password") {
      const bcrypt = await import("bcryptjs");
      if (!body.nuevaPassword || body.nuevaPassword.length < 8) return NextResponse.json({ error: "Mínimo 8 caracteres" }, { status: 400 });
      const hash = await bcrypt.hash(body.nuevaPassword, 10);
      await prisma.local.update({ where: { id }, data: { password: hash } });
      return NextResponse.json({ ok: true, accion: "password-cambiada" });
    }

    if (accion === "editar") {
      const updated = await prisma.local.update({
        where: { id },
        data: {
          ...(body.nombre !== undefined && { nombre: body.nombre }),
          ...(body.nombreDueno !== undefined && { nombreDueno: body.nombreDueno }),
          ...(body.celularDueno !== undefined && { celularDueno: body.celularDueno }),
          ...(body.categorias !== undefined && { categorias: Array.isArray(body.categorias) ? body.categorias.slice(0, 3) : [] }),
          ...(body.ciudad !== undefined && { ciudad: body.ciudad }),
          ...(body.comuna !== undefined && { comuna: body.comuna }),
          ...(body.direccion !== undefined && { direccion: body.direccion }),
          ...(body.telefono !== undefined && { telefono: body.telefono }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
          ...(body.portadaUrl !== undefined && { portadaUrl: body.portadaUrl || null }),
          ...(body.lat !== undefined && { lat: body.lat ? Number(body.lat) : null }),
          ...(body.lng !== undefined && { lng: body.lng ? Number(body.lng) : null }),
          ...(body.instagram !== undefined && { instagram: body.instagram || null }),
          ...(body.sitioWeb !== undefined && { sitioWeb: body.sitioWeb || null }),
          ...(body.descripcion !== undefined && { descripcion: body.descripcion || null }),
          ...(body.historia !== undefined && { historia: body.historia || null }),
          ...(body.sirveEnMesa !== undefined && { sirveEnMesa: Boolean(body.sirveEnMesa) }),
          ...(body.tieneDelivery !== undefined && { tieneDelivery: Boolean(body.tieneDelivery) }),
          ...(body.comunasDelivery !== undefined && { comunasDelivery: body.comunasDelivery }),
          ...(body.tieneRetiro !== undefined && { tieneRetiro: Boolean(body.tieneRetiro) }),
          ...(body.linkPedido !== undefined && { linkPedido: body.linkPedido }),
          ...(body.horarios !== undefined && { horarios: body.horarios }),
        },
      });
      const { password: _, ...safe } = updated;
      return NextResponse.json({ ok: true, data: safe });
    }

    // Fallback: update genérico (toggle activo)
    const { activo } = body;
    const updated = await prisma.local.update({ where: { id }, data: { ...(activo !== undefined && { activo }) } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Admin locales PUT]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    // Delete related records first
    await prisma.participanteConcurso.deleteMany({ where: { concurso: { localId: id } } });
    await prisma.concurso.deleteMany({ where: { localId: id } });
    await prisma.promocion.deleteMany({ where: { localId: id } });
    await prisma.favorito.deleteMany({ where: { localId: id } });
    await prisma.resena.deleteMany({ where: { localId: id } });
    await prisma.menuItem.deleteMany({ where: { localId: id } });
    await prisma.local.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Admin locales DELETE]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
