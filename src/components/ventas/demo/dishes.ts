// Helpers de platos de la demo (sin "use client": se usan en servidor y en cliente).
import type { DemoData, DemoDish } from "./types";

/** Platos destacados: primero los con foto, luego el resto. */
export function featuredDishes(data: DemoData, n: number): DemoDish[] {
  const all = data.categories.flatMap((c) => c.dishes);
  return [...all.filter((d) => d.photo), ...all.filter((d) => !d.photo)].slice(0, n);
}

export function avgTicket(data: DemoData): number {
  const prices = data.categories.flatMap((c) => c.dishes.map((d) => d.price)).filter((p) => p > 0).sort((a, b) => a - b);
  if (!prices.length) return 15000;
  const median = prices[Math.floor(prices.length / 2)];
  return Math.round((median * 1.8) / 100) * 100; // ~ un fondo + bebida
}

/** Plato que se usa como premio de la tarjeta de fidelidad (mismo en la demo y en el programa real). */
export function demoPrize(data: DemoData): DemoDish | undefined {
  return featuredDishes(data, 4).find((d) => d.price > 0 && d.price < 12000) ?? featuredDishes(data, 1)[0];
}
