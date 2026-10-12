/**
 * Meilisearch removed — service no longer in use.
 * All functions are no-ops; search falls back to Postgres.
 */

export const MEILI_INDEX = 'dishes'
export type MeiliDish = Record<string, unknown>

export function getMeiliClient(): never {
  throw new Error('Meilisearch not configured')
}

export function isMeiliConfigured(): boolean {
  return false
}

export function buildMeiliDoc(..._args: unknown[]): unknown {
  return {}
}

export async function syncDishToMeilisearch(_dishId: string): Promise<void> {}

export async function syncRestaurantToMeilisearch(_restaurantId: string): Promise<void> {}
