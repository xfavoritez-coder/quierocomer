import FeedLayout from '../a/layout'
import DescubrirClient from './DescubrirClient'

export const metadata = {
  title: 'Tus recomendaciones | QuieroComer',
  description: 'Platos recomendados basados en tus gustos.',
}

export default function DescubrirPage() {
  return (
    <FeedLayout>
      <DescubrirClient />
    </FeedLayout>
  )
}
