import { NextResponse } from 'next/server'

// Meilisearch removed — cron is a no-op
export async function GET() {
  return NextResponse.json({ skipped: true, reason: 'Meilisearch removed' })
}
