import { redirect } from 'next/navigation'

// Feed desactivado — el middleware ya redirige / → /qr/
// Esta página existe para que Next.js no genere errores en build.
// No ejecuta ninguna query de DB.
export default function HomePage() {
  redirect('/qr/')
}
