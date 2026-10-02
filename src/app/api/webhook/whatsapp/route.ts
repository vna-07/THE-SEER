import { NextRequest, NextResponse } from 'next/server';
import { db, persist } from '@/lib/db';
import { log } from '@/lib/activity';
import { sendWhatsApp, parseApproval } from '@/lib/whatsapp';
import { extractRecord } from '@/lib/extraction';
import { computeRisks } from '@/lib/engine';
import { imagesToPdf, pdfToDataUrl } from '@/lib/pdf-builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = payload.messages ?? [];
  if (!messages.length) return NextResponse.json({ ok: true });

  const msg = messages[0];
  if (msg.from_me === true) return NextResponse.json({ ok: true });

  const from = String(msg.from ?? '');
  const body = String(msg.text?.body ?? msg.image?.caption ?? msg.body ?? '');
  const isImage = msg.type === 'image' || !!msg.image;
  const toNumber = from.split('@')[0];

  const c = await db();

  c.run('INSERT INTO messages (direction, body) VALUES (?, ?)', [
    'in',
    isImage ? '[image]' : body,
  ]);
  persist(c);

  await log('message.in', { from: toNumber, body, hasImage: isImage });

  // ─── Buffer incoming images ───────────────────────────────────────
  if (isImage) {
    const url = msg.image?.link ?? msg.image?.url;
    if (!url) {
      await sendWhatsApp(toNumber, 'I could not access that image. Try sending again.');
      return NextResponse.json({ ok: true });
    }

    c.run('INSERT INTO pending_images (sender, url) VALUES (?, ?)', [toNumber, url]);
    persist(c);

    const count = rowsOf(c, 'SELECT COUNT(*) AS n FROM pending_images WHERE sender = ?', [toNumber])[0]?.n ?? 0;

    await log('image.buffered', { from: toNumber, count });
    await sendWhatsApp(
      toNumber,
      `Page ${count} received. Send more pages, or reply "done" to read them all.`
    );
    return NextResponse.json({ ok: true });
  }

  // ─── "done" triggers batch processing ─────────────────────────────
  if (body.trim().toLowerCase() === 'done' || body.trim().toLowerCase() === 'scan') {
    const images = rowsOf(
      c,
      'SELECT url FROM pending_images WHERE sender = ? ORDER BY id ASC',
      [toNumber]
    );

    if (!images.length) {
      await sendWhatsApp(toNumber, 'No pages waiting. Send photos first, then reply "done".');
      return NextResponse.json({ ok: true });
    }

    try {
      await log('batch.processing', { count: images.length });
      await sendWhatsApp(toNumber, `Reading ${images.length} page(s), please wait…`);

      const pdfBytes = await imagesToPdf(images.map((i: any) => i.url));
      const dataUrl = pdfToDataUrl(pdfBytes);
      const extracted = await extractRecord(dataUrl);

      c.run(
        'INSERT INTO records (image_path, extracted_json, confidence_json, ocr_text) VALUES (?, ?, ?, ?)',
        [
          `${images.length} pages`,
          JSON.stringify({
            products: extracted.products,
            suppliers: extracted.suppliers,
            receivables: extracted.receivables,
          }),
          JSON.stringify({
            products: extracted.products.map((p) => p.confidence),
            suppliers: extracted.suppliers.map((s) => s.confidence),
            receivables: extracted.receivables.map((r) => r.confidence),
            ocr: extracted.ocr.confidence,
          }),
          extracted.ocr.text,
        ]
      );

      c.run('DELETE FROM pending_images WHERE sender = ?', [toNumber]);
      persist(c);

      await log('batch.extracted', {
        pages: images.length,
        products: extracted.products.length,
        receivables: extracted.receivables.length,
      });

      const risks = await computeRisks();
      for (const risk of risks) {
        c.run(
          'INSERT INTO actions (type, payload_json, status) VALUES (?, ?, ?)',
          [String(risk.actionDraft.type), JSON.stringify(risk.actionDraft), 'pending']
        );
      }
      persist(c);

      await log('risks.updated', { count: risks.length });

      const uncertain = extracted.products.filter((p) => p.confidence < 0.8);
      const summary =
        `Read ${images.length} page(s). ${extracted.products.length} items, ${extracted.receivables.length} debts. ` +
        (uncertain.length
          ? `Please confirm: ${uncertain.map((p) => `${p.name} x${p.quantity}`).join(', ')}.`
          : `${risks.length} risks found. Reply 1 to approve the top action.`);

      await sendWhatsApp(toNumber, summary);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[webhook] batch failed:', message);
      await log('batch.failed', { error: message });
      await sendWhatsApp(
        toNumber,
        'I could not read those pages. Reply "clear" to reset, or try again with better lighting.'
      );
      return NextResponse.json({ ok: true });
    }
  }

  // ─── "clear" resets the buffer ────────────────────────────────────
  if (body.trim().toLowerCase() === 'clear') {
    c.run('DELETE FROM pending_images WHERE sender = ?', [toNumber]);
    persist(c);
    await sendWhatsApp(toNumber, 'Cleared. Send new photos when ready.');
    return NextResponse.json({ ok: true });
  }

  // ─── Approval / report commands ───────────────────────────────────
  const approval = parseApproval(body);
  if (approval) {
    if (approval.type === 'approve') {
      const all = approval.ids.includes('ALL');
      if (all) {
        c.run(
          "UPDATE actions SET status = 'approved', approved_at = datetime('now') WHERE status = 'pending'"
        );
      } else {
        const placeholders = approval.ids.map(() => '?').join(',');
        c.run(
          `UPDATE actions SET status = 'approved', approved_at = datetime('now') WHERE id IN (${placeholders})`,
          approval.ids.map(Number)
        );
      }
      persist(c);
      await log('action.approved', { ids: approval.ids });
      await sendWhatsApp(toNumber, 'Approved. SEER has sent the action(s).');
      return NextResponse.json({ ok: true });
    }
    if (approval.type === 'report') {
      await log('report.requested', {});
      await sendWhatsApp(toNumber, 'Weekly report generated. Check the command centre.');
      return NextResponse.json({ ok: true });
    }
    if (approval.type === 'edit') {
      await sendWhatsApp(toNumber, `Edit requested for action ${approval.id}. Reply with the new quantity.`);
      return NextResponse.json({ ok: true });
    }
  }

  // ─── Fallback ─────────────────────────────────────────────────────
  await sendWhatsApp(
    toNumber,
    'Send photos of your ledger. Reply "done" when finished, or type "report".'
  );
  return NextResponse.json({ ok: true });
}