import { NextRequest, NextResponse } from 'next/server';
import { getAnalytics, generateInsights } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const withInsights = req.nextUrl.searchParams.get('insights') === '1';

    const analytics = await getAnalytics();

    let insights: string | null = null;
    if (withInsights) {
      insights = await generateInsights(analytics);
    }

    return NextResponse.json({ ok: true, analytics, insights });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[analytics] failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}