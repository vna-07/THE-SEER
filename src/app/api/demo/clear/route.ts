import { NextResponse } from 'next/server';
import { db, persist } from '@/lib/db';
import { log } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const c = await db();

  const tables = [
    'sales',
    'stock_events',
    'receivables',
    'customers',
    'products',
    'suppliers',
    'actions',
    'records',
    'messages',
    'activity',
    'audit_log',
    'pending_images',
    'signed_statements',
    'settings',
  ];

  for (const t of tables) {
    try {
      c.run(`DELETE FROM ${t}`);
    } catch {
      // table may not exist — ignore
    }
  }

  persist(c);

  // Re-log after wipe so the activity feed isn't empty on first reload
  await log('demo.cleared', { at: new Date().toISOString() });

  return NextResponse.json({ ok: true, cleared: tables });
}