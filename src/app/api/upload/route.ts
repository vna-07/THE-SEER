import { NextRequest, NextResponse } from 'next/server';
import { extractRecord } from '@/lib/extraction';
import { ingestExtracted } from '@/lib/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const recordDate =
      (form.get('recordDate') as string) || new Date().toISOString().slice(0, 10);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const extracted = await extractRecord(dataUrl);
    const result = await ingestExtracted(extracted, recordDate, `upload:${file.name}`);

    return NextResponse.json({
      ok: true,
      ...result,
      ocrSnippet: extracted.ocr?.text?.slice(0, 200) ?? '',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[upload] failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}