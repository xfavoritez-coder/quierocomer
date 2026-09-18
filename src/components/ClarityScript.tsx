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
  const pathname = usePathname();
  const slug = pathname.split('/')[1];

  useEffect(() => {
    if (EXCLUDED_SLUGS.has(slug)) return;
    if ((window as any).clarity) return; // ya cargado
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.clarity.ms/tag/ykbsgbbc68';
    document.head.appendChild(s);
    (window as any).clarity = (window as any).clarity || function(...args: unknown[]) {
      ((window as any).clarity.q = (window as any).clarity.q || []).push(args);
    };
  }, [slug]);

  return null;
}
