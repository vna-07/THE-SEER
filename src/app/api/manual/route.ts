import { NextRequest, NextResponse } from 'next/server';
import { ingestExtracted } from '@/lib/ingest';
import type { ExtractedRecord } from '@/lib/extraction';
import { DEFAULT_PROFILE } from '@/lib/layout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const recordDate: string = body.recordDate || new Date().toISOString().slice(0, 10);

    const products = Array.isArray(body.products) ? body.products : [];
    const sales = Array.isArray(body.sales) ? body.sales : [];
    const expenses = Array.isArray(body.expenses) ? body.expenses : [];
    const receivables = Array.isArray(body.receivables) ? body.receivables : [];

    if (!products.length && !sales.length && !expenses.length && !receivables.length) {
      return NextResponse.json({ ok: false, error: 'Nothing to save' }, { status: 400 });
    }

    const extracted: ExtractedRecord = {
      products: products.map((p: any) => ({
        name: String(p.name ?? '').trim(),
        quantity: Number(p.quantity) || 0,
        unit: p.unit ? String(p.unit) : undefined,
        price: p.price !== undefined && p.price !== '' ? Number(p.price) : null,
        confidence: 1,
      })),
      sales: sales.map((s: any) => ({
        date: s.date ? String(s.date) : undefined,
        item: String(s.item ?? '').trim(),
        quantity: Number(s.quantity) || 0,
        unitPrice: s.unitPrice !== undefined && s.unitPrice !== '' ? Number(s.unitPrice) : null,
        total: s.total !== undefined && s.total !== '' ? Number(s.total) : null,
        notes: undefined,
        confidence: 1,
      })),
      expenses: expenses.map((e: any) => ({
        date: e.date ? String(e.date) : undefined,
        description: String(e.description ?? '').trim(),
        amount: Number(e.amount) || 0,
        confidence: 1,
      })),
      suppliers: [],
      receivables: receivables.map((r: any) => ({
        customerName: String(r.customerName ?? '').trim(),
        amount: Number(r.amount) || 0,
        dueDate: r.dueDate ? String(r.dueDate) : undefined,
        phone: undefined,
        confidence: 1,
      })),
      orders: [],
      businessName: undefined,
      pageType: 'manual',
      entries: [],
      staged: [],
      profile: DEFAULT_PROFILE,
      pageIssues: [],
      profileChanges: [],
      rejects: [],
      ocr: { text: '[manual entry]', lines: [], language: 'en', confidence: 1 },
    };

    const result = await ingestExtracted(extracted, recordDate, 'manual');

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[manual] failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}