import { NextRequest, NextResponse } from 'next/server';
import { db, persist } from '@/lib/db';
import { log } from '@/lib/activity';
import { sendWhatsApp, parseApproval } from '@/lib/whatsapp';
import { extractRecord } from '@/lib/extraction';
import { computeRisks } from '@/lib/engine';
import { imagesToPdf, pdfToDataUrl } from '@/lib/pdf-builder';
import { buildStatementPdf } from '@/lib/statement-pdf';


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

  // ─── "help" — main menu ───────────────────────────────────────────
  const keyword = body.trim().toLowerCase();
  if (keyword === 'help' || keyword === 'menu' || keyword === 'hi' || keyword === 'hello') {
    await sendWhatsApp(
      toNumber,
      [
        'SEER — choose an option:',
        '',
        '📊 today      top 3 risks and actions',
        '📈 report     7-day summary',
        '🧾 statement  full PDF statement',
        '📦 stock      current stock on hand',
        '📁 history    recent activity',
        '🛒 owed       who owes you money',
        '',
        '1, 2, ALL     approve actions',
        'clear         reset photo buffer',
        'help          this menu',
      ].join('\n')
    );
    return NextResponse.json({ ok: true });
  }

  // ─── "stock" — current stock ──────────────────────────────────────
  if (keyword === 'stock') {
    const products = rowsOf(c, 'SELECT id, name, unit FROM products');
    if (!products.length) {
      await sendWhatsApp(toNumber, 'No products tracked yet. Send a photo of your ledger.');
      return NextResponse.json({ ok: true });
    }
    const lines = ['SEER — Stock on hand', ''];
    for (const p of products) {
      const s = rowsOf(c, 'SELECT COALESCE(SUM(quantity),0) AS stock FROM stock_events WHERE product_id = ?', [p.id]);
      const d = rowsOf(
        c,
        `SELECT COALESCE(SUM(quantity),0)/7.0 AS demand FROM sales
         WHERE product_id = ? AND sold_at >= datetime('now','-7 days')`,
        [p.id]
      );
      const stock = Number(s[0]?.stock ?? 0);
      const demand = Number(d[0]?.demand ?? 0);
      const days = demand > 0 ? (stock / demand).toFixed(1) : '∞';
      lines.push(`• ${p.name}: ${stock} ${p.unit} (${demand.toFixed(1)}/day · ${days}d left)`);
    }
    await sendWhatsApp(toNumber, lines.join('\n'));
    return NextResponse.json({ ok: true });
  }

  // ─── "owed" — open receivables ────────────────────────────────────
  if (keyword === 'owed' || keyword === 'receivables') {
    const rows = rowsOf(
      c,
      `SELECT r.amount, r.due_date, c.name AS customer_name
       FROM receivables r JOIN customers c ON c.id = r.customer_id
       WHERE r.status = 'open' ORDER BY r.due_date ASC`
    );
    if (!rows.length) {
      await sendWhatsApp(toNumber, 'No outstanding debts. Everyone is paid up.');
      return NextResponse.json({ ok: true });
    }
    const lines = ['SEER — Owed to you', ''];
    let total = 0;
    for (const r of rows) {
      const age = Math.max(
        0,
        Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000)
      );
      total += Number(r.amount);
      lines.push(`• ${r.customer_name}: R${r.amount} (${age}d overdue)`);
    }
    lines.push('', `Total owed: R${total}`);
    await sendWhatsApp(toNumber, lines.join('\n'));
    return NextResponse.json({ ok: true });
  }

  // ─── "history" — recent activity ──────────────────────────────────
  if (keyword === 'history' || keyword === 'activity') {
    const events = rowsOf(
      c,
      'SELECT type, detail, created_at FROM activity ORDER BY id DESC LIMIT 10'
    );
    if (!events.length) {
      await sendWhatsApp(toNumber, 'No activity yet.');
      return NextResponse.json({ ok: true });
    }
    const lines = ['SEER — Recent activity', ''];
    for (const e of events) {
      const t = String(e.created_at).slice(11, 16);
      lines.push(`${t}  ${e.type}`);
    }
    await sendWhatsApp(toNumber, lines.join('\n'));
    return NextResponse.json({ ok: true });
  }

  // ─── "report" — 7-day summary ─────────────────────────────────────
  if (keyword === 'report' || keyword === 'growth') {
    const risks = await computeRisks();
    const totals = risks.reduce(
      (s, r) => ({
        without: s.without + r.exposure.without,
        with: s.with + r.exposure.with,
        prevented: s.prevented + r.exposure.prevented,
      }),
      { without: 0, with: 0, prevented: 0 }
    );
    const lines = [
      'SEER — 7-Day Report',
      '',
      `Exposure without SEER: R${Math.round(totals.without)}`,
      `Exposure with SEER:    R${Math.round(totals.with)}`,
      `Prevented:             R${Math.round(totals.prevented)}`,
      '',
      `Active risks: ${risks.length}`,
      'Reply "statement" for the full PDF.',
    ];
    await sendWhatsApp(toNumber, lines.join('\n'));
    await log('report.sent', { total: totals.prevented });
    return NextResponse.json({ ok: true });
  }

  // ─── "today" — top 3 risks ────────────────────────────────────────
  if (keyword === 'today') {
    const risks = (await computeRisks()).slice(0, 3);
    if (!risks.length) {
      await sendWhatsApp(toNumber, 'No active risks. Send a photo to seed data.');
      return NextResponse.json({ ok: true });
    }
    const lines = risks.map((r, i) => `${i + 1}. ${r.title} — ${r.reason} → ${r.recommendation}`);
    await sendWhatsApp(
      toNumber,
      ['SEER — Today', '', ...lines, '', 'Reply 1, 2, 3 or ALL to approve.'].join('\n')
    );
    await log('today.sent', { count: risks.length });
    return NextResponse.json({ ok: true });
  }

  // ─── "statement" — PDF ────────────────────────────────────────────
  if (keyword === 'statement') {
    try {
      await log('statement.requested', {});
      await sendWhatsApp(toNumber, 'Generating statement PDF, one moment…');

      const pdfBytes = await buildStatementPdf();

      const fs = await import('fs');
      const path = await import('path');
      const dir = path.join(process.cwd(), 'public', 'statements');
      fs.mkdirSync(dir, { recursive: true });
      const filename = `statement-${Date.now()}.pdf`;
      fs.writeFileSync(path.join(dir, filename), Buffer.from(pdfBytes));

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
      const url = `${baseUrl}/statements/${filename}`;

      await sendWhatsApp(
        toNumber,
        `Statement ready:\n${url}\n\nEvery figure traces to a source record. Nothing sent without your approval.`
      );
      await log('statement.sent', { url });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[webhook] statement failed:', msg);
      await sendWhatsApp(toNumber, 'I could not generate the statement. Try again.');
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