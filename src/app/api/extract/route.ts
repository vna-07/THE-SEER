import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { extractRecord } from '@/lib/extraction';
import { getShopKey, loadProfile } from '@/lib/profile-store';
import type { LayoutProfile } from '@/lib/layout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAGES = 6;
const PARALLEL_LIMIT = 3;

async function splitPdf(dataUrl: string): Promise<string[]> {
  const [meta, b64] = dataUrl.split(',');
  if (!meta.includes('pdf')) return [dataUrl];

  const bytes = Buffer.from(b64, 'base64');
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const count = Math.min(total, MAX_PAGES);

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(src, [i]);
    single.addPage(copied);
    const buf = await single.save();
    out.push(`data:application/pdf;base64,${Buffer.from(buf).toString('base64')}`);
  }
  return out;
}

async function processInChunks<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((item, j) => fn(item, i + j)));
    results.push(...chunkResults);
  }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const pages = await splitPdf(dataUrl);
    const isPdf = mime === 'application/pdf';

    console.log(`[extract] file=${file.name} mime=${mime} pages=${pages.length}`);

    // ─── Resolve the shop key and any cached profile ONCE ───
    let shopKey: string | undefined;
    let profile: LayoutProfile | null = null;

    try {
      shopKey = await getShopKey();
      if (shopKey) profile = await loadProfile(shopKey);
    } catch (e) {
      console.warn('[extract] profile lookup failed:', e);
    }

    const hasCachedProfile =
      profile !== null && (profile.layout_confidence ?? 0) >= 0.5;

    console.log(
      `[extract] shopKey=${shopKey ?? '(none)'} cachedProfile=${hasCachedProfile}`
    );

    type PageResult =
      | { ok: true; r: any; idx: number }
      | { ok: false; error: string; idx: number };

    // ─── First pass: page 1 alone if no cached profile ───
    // This is the ONLY page that pays discovery cost. Its saved profile
    // is then loaded by every subsequent page.
    let firstResult: PageResult | null = null;
    let remainingPages = pages;

    if (pages.length > 0) {
      const firstPageUrl = pages[0];
      try {
        const opts = shopKey ? { shopKey } : undefined;
        const r = await extractRecord(firstPageUrl, opts);
        firstResult = { ok: true, r, idx: 0 };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[extract] page 0 failed:', msg);
        firstResult = { ok: false, error: msg, idx: 0 };
      }
      remainingPages = pages.slice(1);
    }

    // ─── Second pass: remaining pages in chunks, using the cached profile ───
    // Re-load from DB so we get whatever page 1 just saved.
    let sharedProfile: LayoutProfile | null = null;
    if (shopKey) {
      try {
        sharedProfile = await loadProfile(shopKey);
      } catch {}
    }

    const restResults = await processInChunks(
      remainingPages,
      PARALLEL_LIMIT,
      async (pageUrl, idx) => {
        try {
          const opts = {
            shopKey,
            profile: sharedProfile ?? undefined,
            saveProfile: false,     // never overwrite from a parallel page
          };
          const r = await extractRecord(pageUrl, shopKey ? opts : undefined);
          return { ok: true as const, r, idx: idx + 1 };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[extract] page ${idx + 1} failed:`, msg);
          return { ok: false as const, error: msg, idx: idx + 1 };
        }
      }
    );

    const allResults: PageResult[] = firstResult
      ? [firstResult, ...restResults]
      : restResults;

    const good = allResults.filter((r) => r.ok).map((r: any) => r.r);
    const failed = allResults.filter((r) => !r.ok);

    // ─── Aggregate ───
    const products = good.flatMap((r: any) => r.products ?? []);
    const sales = good.flatMap((r: any) => r.sales ?? []);
    const expenses = good.flatMap((r: any) => r.expenses ?? []);
    const receivables = good.flatMap((r: any) => r.receivables ?? []);
    const orders = good.flatMap((r: any) => r.orders ?? []);
    const staged = good.flatMap((r: any) => r.staged ?? []);

    const ocrSnippet = good
      .map((r: any) => r.ocr?.text ?? '')
      .join('\n--- PAGE BREAK ---\n')
      .slice(0, 800);

    return NextResponse.json({
      ok: true,
      pagesProcessed: allResults.length,
      pagesFailed: failed.length,
      isPdf,
      cachedProfile: hasCachedProfile,
      products,
      sales,
      expenses,
      receivables,
      orders,
      staged,
      ocrSnippet,
      ocrConfidence: 0.9,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[extract] failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}