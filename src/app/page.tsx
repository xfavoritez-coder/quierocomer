import { redirect } from 'next/navigation'

// Fallback: middleware rewrites / → /a, but if it doesn't reach, redirect
export default function HomePage() {
  redirect('/a')
}
