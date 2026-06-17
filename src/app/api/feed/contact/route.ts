import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { prisma } from '@/lib/prisma'

const TO = 'favoritez@gmail.com'

export async function POST(req: Request) {
  try {
    const { nombre, email, mensaje } = await req.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    if (!email?.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    if (!mensaje?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

    const html = [
      `<p><strong>Mensaje desde QuieroComer feed (usuario B2C)</strong></p>`,
      `<p><strong>Nombre:</strong> ${nombre}</p>`,
      `<p><strong>Email:</strong> ${email}</p>`,
      `<p><strong>Mensaje:</strong> ${mensaje}</p>`,
      `<p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>`,
    ].join('')

    const { error: resendError } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'QuieroComer <soporte@quierocomer.cl>',
      to: TO,
      replyTo: email,
      subject: `Contacto feed — ${nombre}`,
      html,
    })

    if (resendError) {
      console.error('[feed/contact] Resend error:', resendError)
      return NextResponse.json({ error: 'Error al enviar el correo' }, { status: 500 })
    }

    await prisma.supportMessage.create({
      data: { source: 'feed_contact', name: nombre, email, message: mensaje },
    }).catch(e => console.error('[feed/contact] DB error (non-fatal):', e))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[feed/contact]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
