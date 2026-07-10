import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { prisma } from '@/lib/prisma'

const TO = 'favoritez@gmail.com'

export async function POST(req: Request) {
  try {
    const { nombre, nombreLocal, ciudad, email, whatsapp, mensaje } = await req.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    if (!nombreLocal?.trim()) return NextResponse.json({ error: 'Nombre del local requerido' }, { status: 400 })
    if (!ciudad?.trim()) return NextResponse.json({ error: 'Ciudad requerida' }, { status: 400 })
    if (!email?.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

    const html = [
      `<p><strong>🍽️ Solicitud de publicación de local — QuieroComer</strong></p>`,
      `<p><strong>Nombre:</strong> ${nombre}</p>`,
      `<p><strong>Local:</strong> ${nombreLocal}</p>`,
      `<p><strong>Ciudad:</strong> ${ciudad}</p>`,
      `<p><strong>Email:</strong> ${email}</p>`,
      whatsapp ? `<p><strong>WhatsApp:</strong> ${whatsapp}</p>` : '',
      mensaje ? `<p><strong>Mensaje:</strong> ${mensaje}</p>` : '',
      `<p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>`,
    ].filter(Boolean).join('')

    const { error: resendError } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'QuieroComer <soporte@quierocomer.com>',
      to: TO,
      replyTo: email,
      subject: `Publicar local — ${nombreLocal} (${ciudad})`,
      html,
    })

    if (resendError) {
      console.error('[feed/publicar-local] Resend error:', resendError)
      return NextResponse.json({ error: `Resend: ${resendError.message || JSON.stringify(resendError)}` }, { status: 500 })
    }

    await prisma.supportMessage.create({
      data: {
        source: 'publicar_local',
        name: nombre,
        email,
        message: `Local: ${nombreLocal} | Ciudad: ${ciudad}${whatsapp ? ` | WA: ${whatsapp}` : ''}${mensaje ? ` | Mensaje: ${mensaje}` : ''}`,
      },
    }).catch(e => console.error('[feed/publicar-local] DB error (non-fatal):', e))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[feed/publicar-local]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
