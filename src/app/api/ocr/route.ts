import { NextRequest, NextResponse } from 'next/server';
import { extractRecord } from '@/lib/extraction';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    }

    const result = await extractRecord(imageUrl);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[ocr]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
