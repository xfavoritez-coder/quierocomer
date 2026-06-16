import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { prisma } from '@/lib/prisma'

const TO = 'favoritez@gmail.com'

export async function POST(req: Request) {
  try {
    const { nombre, email, mensaje } = await req.json()
    if (!email?.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    if (!mensaje?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

    const html = [
      `<p><strong>Mensaje desde QuieroComer feed (usuario B2C)</strong></p>`,
      nombre ? `<p><strong>Nombre:</strong> ${nombre}</p>` : '',
      `<p><strong>Email:</strong> ${email}</p>`,
      `<p><strong>Mensaje:</strong> ${mensaje}</p>`,
      `<p><strong>Fecha:</strong> ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>`,
    ].filter(Boolean).join('')

    await Promise.all([
      resend.emails.send({
        from: process.env.FROM_EMAIL || 'QuieroComer <soporte@quierocomer.cl>',
        to: TO,
        subject: `Contacto feed — ${nombre || email}`,
        html,
      }),
      prisma.supportMessage.create({
        data: { source: 'feed_contact', name: nombre || null, email, message: mensaje },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[feed/contact]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
