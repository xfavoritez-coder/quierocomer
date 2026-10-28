import type { MetadataRoute } from 'next'
import { currentHost, isMainHost } from '@/lib/seo/requestHost'

// Sensible al host: en dominios propios (handroll.cl) apunta a su propio sitemap.
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await currentHost()

  // Dominio propio de un local (tienda ecommerce o carta): su propio sitemap,
  // sin las reglas de /panel, /admin, etc. (esas rutas redirigen al principal).
  if (host && !isMainHost(host)) {
    return {
      rules: [{ userAgent: '*', allow: '/' }],
      sitemap: `https://${host}/sitemap.xml`,
    }
  }

  // Dominio principal.
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/panel/', '/admin/', '/api/', '/email-preview', '/imprimirqr'],
      },
    ],
    sitemap: 'https://quierocomer.com/sitemap.xml',
  }
}
