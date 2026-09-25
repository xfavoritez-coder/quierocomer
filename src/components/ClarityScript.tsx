'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const EXCLUDED_SLUGS = new Set([
  'alleria-pizza',
  'alleria-delivery',
  'hand-roll',
  'horusvegan',
  'el-menu-de-la-esquina',
  'guffsushi',
  'nascosto-pizzeria',
  'la-oveja-negra-restaurante',
  'cuartel-50-restaurante',
]);

export default function ClarityScript() {
  // Clarity desactivado temporalmente
  return null;
}
