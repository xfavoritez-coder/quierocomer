'use client'

import { useRouter } from 'next/navigation'
import PosHeader from '../components/PosHeader'
import PosCartaPanel from '../components/panels/PosCartaPanel'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosCartaPage() {
  const router = useRouter()
  const { restaurantId } = usePosRestaurant()
  return (
    <div className="pos-shell">
      <PosHeader mode="back" eyebrow="Carta" onBack={() => router.back()} />
      <PosCartaPanel restaurantId={restaurantId} />
    </div>
  )
}
