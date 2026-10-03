import { NextRequest, NextResponse } from 'next/server';
import { extractRecord } from '@/lib/extraction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const extracted = await extractRecord(dataUrl);

    return NextResponse.json({
      ok: true,
      products: extracted.products,
      sales: (extracted as any).sales ?? [],
      expenses: (extracted as any).expenses ?? [],
      receivables: extracted.receivables,
      orders: (extracted as any).orders ?? [],
      ocrSnippet: extracted.ocr.text.slice(0, 800),
      ocrConfidence: extracted.ocr.confidence,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[extract] failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}