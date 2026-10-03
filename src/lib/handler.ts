import { db, run, insert, rowsOf } from './db';
import { log } from './activity';
import { sendOnChannel, type InboundMessage } from './channels';
import { extractRecord } from './extraction';
import { computeRisks } from './engine';
import { ingestExtracted } from './ingest';
import { buildStatementPdf } from './statement-pdf';
import {
  verifyPasscode,
  passcodeHint,
  getSession,
  setSession,
  clearSession,
  runSeed,
  wipeAll,
  tailLogs,
  lastRecordJson,
  overrideStock,
  devMenu,
} from './dev';

function fmtRand(n: number): string {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

function urlKind(url: string): 'image' | 'pdf' | 'unknown' {
  const clean = String(url).toLowerCase().split('?')[0];
  if (clean.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|webp|bmp|tif|tiff|gif|heic)$/.test(clean)) return 'image';
  return 'unknown';
}

function marker(daysLeft: number | null, overdue?: boolean): string {
  if (overdue) {
    const d = daysLeft ?? 0;
    if (d >= 14) return '[!]';
    if (d >= 7) return '[~]';
    return '[ok]';
  }
  const d = daysLeft ?? 999;
  if (d <= 2) return '[!]';
  if (d <= 4) return '[~]';
  return '[ok]';
}

function parseApproval(body: string):
  | { type: 'approve'; ids: string[] }
  | { type: 'edit'; id: string }
  | { type: 'report' }
  | null {
  const t = (body || '').trim().toUpperCase();
  if (!t) return null;
  if (t === 'ALL') return { type: 'approve', ids: ['ALL'] };
  if (t === 'REPORT') return { type: 'report' };
  if (/^EDIT\s+\d+$/.test(t)) return { type: 'edit', id: t.split(/\s+/)[1] };
  if (/^\d+(\s*,\s*\d+)*$/.test(t)) return { type: 'approve', ids: t.split(/\s*,\s*/) };
  return null;
}

function isGreeting(body: string): boolean {
  const t = body.trim().toLowerCase().replace(/[!?.,;:]+$/g, '');
  return [
    'hello', 'hi', 'hey', 'hekko', 'helo', 'hei', 'sup', 'yo',
    'howzit', 'hallo', 'start', 'morning', 'evening',
    'good morning', 'good evening', 'good afternoon',
    'molo', 'sawubona',
  ].includes(t);
}

const MENU_COMMANDS = ['today', 'stock', 'owed', 'report', 'statement', 'csv', 'help', 'review'];

function previewStagedRow(section: string, payload: any): string {
  try {
    const p = payload ?? {};

    if (section === 'note' || p.kind === 'note') {
      const raw = String(p.raw_text ?? '').replace(/\s+/g, ' ').trim();
      const cls = p.note_class ? `[${p.note_class}] ` : '';
      return `${cls}${raw.slice(0, 70)}`;
    }
    if (section === 'total' || p.kind === 'total') {
      const amt = p.amount !== null && p.amount !== undefined ? `R${p.amount}` : 'R?';
      const scope = p.total_scope ? ` (${p.total_scope})` : '';
      const raw = String(p.raw_text ?? '').replace(/\s+/g, ' ').trim();
      return `${amt}${scope} — ${raw.slice(0, 50)}`;
    }
    if (section === 'sales' || p.kind === 'sale') {
      const item = p.item ?? p.raw_text ?? 'sale';
      const qty = p.quantity ?? p.qty ?? '?';
      const price = p.unitPrice ?? p.unit_price;
      return `${item} × ${qty}${price ? ` @ R${price}` : ''}`;
    }
    if (section === 'products' || p.kind === 'stock_count' || p.kind === 'stock_in') {
      const name = p.name ?? p.item ?? 'item';
      const qty = p.quantity ?? '?';
      return `${name} — qty unread (${qty})`;
    }
    if (section === 'credit_repaid') return `repaid: ${p.party ?? '?'} — R${p.amount ?? '?'}`;
    if (section === 'wage') return `wage: ${p.item ?? p.raw_text ?? '?'} — R${p.amount ?? '?'}`;
    if (section === 'receivables' || p.kind === 'credit_given') {
      return `${p.customerName ?? p.party ?? '?'} — R${p.amount ?? '?'}`;
    }
    if (section === 'expenses' || p.kind === 'expense' || p.kind === 'purchase') {
      return `${p.description ?? p.item ?? '?'} — R${p.amount ?? '?'}`;
    }
    const raw = String(p.raw_text ?? '').replace(/\s+/g, ' ').trim();
    if (raw) return raw.slice(0, 70);
    const keys = Object.keys(p).slice(0, 3);
    return keys.map((k) => `${k}=${JSON.stringify(p[k])}`).join(' ').slice(0, 70);
  } catch {
    return '(unreadable)';
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleInbound(msg: InboundMessage): Promise<void> {
  const { channel, from, body, mediaUrl } = msg;
  const c = await db();
  const sessionKey = `${channel}:${from}`;
  const send = async (text: string) => {
    try {
      await sendOnChannel(channel, from, text);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('[handler] send failed:', m);
    }
  };

  await run(
    c,
    'INSERT INTO messages (direction, body, channel, sender) VALUES (?, ?, ?, ?)',
    ['in', mediaUrl ? '[media]' : body, channel, from]
  );
  await log('message.in', { channel, from, body: body.slice(0, 120), hasMedia: !!mediaUrl });

  const state = await getSession(c, sessionKey);
  const bodyTrim = body.trim();
  const kw = bodyTrim.toLowerCase();

  // ═══ DEV MODE ═══

  if (kw === 'chat ovrd') {
    await setSession(c, sessionKey, 'AWAITING_DEV_PIN');
    await send(
      [
        'SECURITY CHALLENGE REQUIRED',
        '',
        `Node: Makhanda-Spaza-01 [${passcodeHint()}]`,
        '',
        'Enter 4-digit dev passcode:',
      ].join('\n')
    );
    return;
  }

  if (state === 'AWAITING_DEV_PIN') {
    if (verifyPasscode(bodyTrim)) {
      await setSession(c, sessionKey, 'DEV_MODE_ACTIVE');
      await log('dev.auth_success', { channel, from });
      await send(
        [
          'DEV MODE ACTIVATED',
          'Root Access Granted. Welcome, Developer.',
          '',
          devMenu(),
        ].join('\n')
      );
    } else {
      await clearSession(c, sessionKey);
      await log('dev.auth_failed', { channel, from });
      await send('AUTHENTICATION FAILED. Access logged. Returning to standard mode.');
    }
    return;
  }

  if (state === 'AWAITING_WIPE_CONFIRM') {
    if (bodyTrim.toUpperCase() === 'CONFIRM WIPE') {
      await wipeAll();
      await clearSession(c, sessionKey);
      await log('dev.wipe', { channel, from });
      await send('Business node reset. Ready for fresh onboarding.');
    } else {
      await clearSession(c, sessionKey);
      await send('Wipe cancelled. Returning to standard mode.');
    }
    return;
  }

  if (state === 'DEV_MODE_ACTIVE') {
    if (kw === 'exit') {
      await clearSession(c, sessionKey);
      await send(
        [
          'Exited dev mode.',
          '',
          'SEER — send a photo of your ledger, or type:',
          'today · report · statement · stock · owed · help',
        ].join('\n')
      );
      return;
    }
    if (kw === 'dev help' || kw === 'dev menu') {
      await send(devMenu());
      return;
    }
    if (kw === 'dev logs') {
      const lines = await tailLogs(c, 15);
      await send(['SEER — Recent activity logs', '', ...lines].join('\n'));
      return;
    }
    if (kw === 'dev raw') {
      const raw = await lastRecordJson(c);
      await send(raw);
      return;
    }
    if (kw === 'dev reset') {
      await run(c, 'DELETE FROM pending_images WHERE sender = ?', [from]);
      await run(c, "DELETE FROM actions WHERE status = 'pending'");
      await send('Photo buffer and pending queue cleared. Database untouched.');
      return;
    }
    if (kw === 'dev seed') {
      const r = await runSeed();
      await send(`Demo dataset loaded: ${r.products} products, ${r.receivables} open debt.`);
      return;
    }
    if (kw === 'dev wipeall') {
      await setSession(c, sessionKey, 'AWAITING_WIPE_CONFIRM');
      await send(
        [
          'WARNING: This will permanently purge all business data.',
          '',
          'Reply "CONFIRM WIPE" to proceed.',
        ].join('\n')
      );
      return;
    }
    if (kw.startsWith('dev override')) {
      const m = bodyTrim.match(/^dev override\s+(.+?)\s+(\d+)$/i);
      if (!m) {
        await send('Usage: dev override <item> <qty>   e.g. dev override milk 50');
        return;
      }
      const result = await overrideStock(c, m[1], Number(m[2]));
      await send(result);
      return;
    }
    await send('Unknown dev command. Type "dev help" for the list, or "exit" to leave.');
    return;
  }

  // ═══ REVIEW QUEUE ACTIONS ═══

  if (/^(keep|drop)\s+(all|[\d,\s]+)$/i.test(bodyTrim)) {
    const isDrop = kw.startsWith('drop');
    const isAll = /\ball\b/i.test(bodyTrim);

    const rows = await rowsOf<Record<string, any>>(
      c,
      "SELECT id, section, payload_json FROM staging_rows WHERE status = 'pending' ORDER BY id ASC"
    );

    if (!rows.length) {
      await send('Nothing in the review queue.');
      return;
    }

    let indices: number[];
    if (isAll) {
      indices = rows.map((_: any, i: number) => i + 1);
    } else {
      indices = bodyTrim
        .replace(/^(keep|drop)\s+/i, '')
        .split(/[\s,]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= rows.length);
    }

    if (!indices.length) {
      await send('Which rows? e.g. "keep 1,2" or "drop 3" or "keep all".');
      return;
    }

    const selected = indices.map((n) => rows[n - 1]);
    const newStatus = isDrop ? 'discarded' : 'accepted';

    for (const r of selected) {
      await run(
        c,
        "UPDATE staging_rows SET status = ?, reviewed_at = datetime('now') WHERE id = ?",
        [newStatus, r.id]
      );
    }

    const remainingRows = await rowsOf<{ n: number }>(
      c,
      "SELECT COUNT(*) AS n FROM staging_rows WHERE status = 'pending'"
    );
    const remaining = Number(remainingRows[0]?.n ?? 0);

    await log(isDrop ? 'staging.discarded' : 'staging.accepted', {
      count: selected.length,
      remaining,
      channel,
    });

    if (isDrop) {
      await send(`Discarded ${selected.length} row(s).\n${remaining} still pending.`);
    } else {
      await send(
        [
          `Accepted ${selected.length} row(s).`,
          `${remaining} still pending.`,
          '',
          remaining > 0 ? 'Type "review" to see the rest, or "keep all" to clear.' : 'Review queue is empty.',
        ].join('\n')
      );
    }
    return;
  }

  // ═══ NORMAL FLOW ═══

  const pcRows = await rowsOf<{ n: number }>(
    c,
    "SELECT COUNT(*) AS n FROM actions WHERE status = 'pending'"
  );
  const pendingCount = Number(pcRows[0]?.n ?? 0);

  if (pendingCount > 0) {
    const approval = parseApproval(bodyTrim);
    if (approval && approval.type === 'approve') {
      const all = approval.ids.includes('ALL');
      const pending = await rowsOf<Record<string, any>>(
        c,
        "SELECT id, type, payload_json FROM actions WHERE status = 'pending' ORDER BY id ASC"
      );

      const approved: any[] = all
        ? pending
        : approval.ids.reduce<any[]>((selected, nStr) => {
            const n = Number(nStr);
            if (Number.isFinite(n) && n >= 1 && n <= pending.length) {
              selected.push(pending[n - 1]);
            }
            return selected;
          }, []);

      if (!approved.length) {
        await send(
          `I couldn't match that. You have ${pendingCount} pending action(s) — reply 1 to ${pendingCount}, or ALL.`
        );
        return;
      }

      for (const action of approved) {
        await run(
          c,
          "UPDATE actions SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
          [action.id]
        );
      }
      await log('action.approved', { ids: approved.map((action) => action.id), channel });

      try {
        const { appendToChain } = await import('./chain');
        await appendToChain('action.approved', {
          ids: approved.map((action) => action.id),
          approved,
          channel,
          actor: from,
        });
      } catch (e) {
        console.error('[handler] chain append failed:', e);
      }

      const summary = approved.map((a, i) => {
        const p = safeParse(a.payload_json);
        const pos = all ? i + 1 : approval.ids[i];
        if (a.type === 'purchase_order') {
          return `[ok] #${pos} Order ${p.quantity} ${p.productName ?? ''} from ${p.supplier ?? 'supplier'} — queued.`;
        }
        return `[ok] #${pos} Reminder to ${p.customerName ?? 'customer'} — queued.`;
      });

      await send(
        [
          `Approved ${approved.length} action(s):`,
          '',
          ...summary,
          '',
          'Send another page, or type "today" for remaining risks.',
        ].join('\n')
      );
      return;
    }

    if (approval && approval.type === 'edit') {
      await send(`Edit action ${approval.id} — reply with the new value (e.g. "edit ${approval.id} 24").`);
      return;
    }

    const isShortAmbiguous =
      bodyTrim.length <= 3 &&
      !mediaUrl &&
      !MENU_COMMANDS.includes(kw) &&
      !isGreeting(bodyTrim) &&
      !['clear', 'done', 'scan', 'exit', 'sera'].includes(kw);

    if (isShortAmbiguous && !approval) {
      await send(
        [
          `You have ${pendingCount} pending action(s).`,
          '',
          'Reply 1, 2, 3 or ALL to approve.',
          'Or type a command: today · stock · owed · report · help',
        ].join('\n')
      );
      return;
    }
  }

  if (pendingCount === 0 && /^[1-8]$/.test(kw)) {
    const idx = Number(kw) - 1;
    const cmd = MENU_COMMANDS[idx];
    if (cmd) {
      await handleMenuCommand(c, cmd, send, from);
      return;
    }
  }

  if (isGreeting(bodyTrim)) {
    const lines = [
      'SEER',
      '',
      'Ready. Send a photo of your ledger, or ask me anything.',
      '',
      'Commands: today · stock · owed · report · statement · csv · review · help',
    ];
    if (pendingCount > 0) {
      lines.push('');
      lines.push(`You have ${pendingCount} pending action(s) — reply 1, 2, 3 or ALL to approve.`);
    }
    await send(lines.join('\n'));
    return;
  }

  if (MENU_COMMANDS.includes(kw)) {
    await handleMenuCommand(c, kw, send, from);
    return;
  }

  if (kw === 'clear') {
    await run(c, 'DELETE FROM pending_images WHERE sender = ?', [from]);
    await send('Cleared. Send new photos when ready.');
    return;
  }

  if (kw === 'done' || kw === 'scan') {
    await handleBatch(c, send, from, channel);
    return;
  }

  if (mediaUrl) {
    try {
      const existingRows = await rowsOf<{ n: number }>(
        c,
        'SELECT COUNT(*) AS n FROM pending_images WHERE sender = ?',
        [from]
      );
      const existingCount = Number(existingRows[0]?.n ?? 0);
      if (existingCount > 20) {
        await run(c, 'DELETE FROM pending_images WHERE sender = ?', [from]);
      }

      await run(c, 'INSERT INTO pending_images (sender, url) VALUES (?, ?)', [from, mediaUrl]);

      const countRows = await rowsOf<{ n: number }>(
        c,
        'SELECT COUNT(*) AS n FROM pending_images WHERE sender = ?',
        [from]
      );
      const count = Number(countRows[0]?.n ?? 0);
      await log('image.buffered', { from, count, channel });
      await send(`Page ${count} received. Send more, or reply "done" to read them all.`);
      return;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('[handler] media failed:', m);
      await send('Could not access that image. Try again.');
      return;
    }
  }

  if (bodyTrim.length >= 4 && !mediaUrl) {
    try {
      await log('sera.asked', { from, question: bodyTrim.slice(0, 120) });
      await send('…');

      const { askSera } = await import('./sera');

      const history = await rowsOf<Record<string, any>>(
        c,
        `SELECT direction, body, channel, sender, created_at
         FROM messages
         WHERE channel = ? AND (sender = ? OR direction = 'out')
         ORDER BY id DESC
         LIMIT 8`,
        [channel, from]
      );

      const ordered = history.reverse();

      const conversation = ordered
        .filter((m: any) => m.body && m.body !== '…')
        .map((m: any) => ({
          role: (m.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: String(m.body),
        }));

      const lastMsg = conversation[conversation.length - 1];
      if (!lastMsg || lastMsg.content !== bodyTrim) {
        conversation.push({ role: 'user', content: bodyTrim });
      }

      const reply = await askSera(conversation);
      await log('sera.answered', { from });
      await send(reply);
      return;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('[handler] SERA failed:', m);
      await log('sera.failed', { error: m });
    }
  }

  await send(
    [
      'SEER',
      '',
      'Send a photo of your ledger, or type:',
      'today · stock · owed · report · statement · csv · review · help',
      '',
      'Or ask a question — e.g. "What should I reorder this week?"',
    ].join('\n')
  );
}

// ═══════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleMenuCommand(
  c: any,
  cmd: string,
  send: (text: string) => Promise<void>,
  from: string
): Promise<void> {
  if (cmd === 'help') {
    await send(
      [
        'SEER — Menu',
        '',
        '1  today      top 3 risks',
        '2  stock      current stock',
        '3  owed       who owes you',
        '4  report     7-day summary',
        '5  statement  PDF statement',
        '6  csv        export to Excel',
        '7  help       this menu',
        '',
        'Also:',
        '   review     rows held back from the last upload',
        '   keep N     accept rows from review',
        '   drop N     discard rows from review',
        '   keep all   accept everything pending',
        '',
        'Reply with the number or the word.',
      ].join('\n')
    );
    return;
  }

  if (cmd === 'review') {
    const rows = await rowsOf<Record<string, any>>(
      c,
      `SELECT id, section, payload_json, confidence, reason, created_at
       FROM staging_rows
       WHERE status = 'pending'
       ORDER BY id ASC
       LIMIT 20`
    );

    if (!rows.length) {
      await send('Nothing waiting for review. Every extracted row was committed.');
      return;
    }

    const totalRows = await rowsOf<{ n: number }>(
      c,
      "SELECT COUNT(*) AS n FROM staging_rows WHERE status = 'pending'"
    );
    const total = Number(totalRows[0]?.n ?? 0);

    const lines = [`SEER — ${total} row(s) need review`, ''];

    rows.slice(0, 10).forEach((r: any, i: number) => {
      const p = safeParse(r.payload_json);
      const section = String(r.section);
      const conf = r.confidence !== null && r.confidence !== undefined
        ? ` (${Math.round(Number(r.confidence) * 100)}%)`
        : '';
      const preview = previewStagedRow(section, p);
      lines.push(`${i + 1}. [${section}]${conf} ${preview}`);
    });

    if (rows.length > 10) {
      lines.push('');
      lines.push(`… and ${rows.length - 10} more`);
    }

    lines.push('');
    lines.push('Reply:');
    lines.push('  keep 1,2    accept those rows');
    lines.push('  drop 1,2    discard them');
    lines.push('  keep all    accept everything');
    lines.push('  drop all    clear the queue');

    await send(lines.join('\n'));
    return;
  }

  if (cmd === 'stock') {
    const products = await rowsOf<Record<string, any>>(
      c,
      'SELECT id, name, unit FROM products'
    );
    if (!products.length) {
      await send('No products tracked yet. Send a photo of your ledger.');
      return;
    }
    const lines = ['SEER — Stock Status', ''];
    for (const p of products) {
      const s = await rowsOf<{ stock: number }>(
        c,
        'SELECT COALESCE(SUM(quantity),0) AS stock FROM stock_events WHERE product_id = ?',
        [p.id]
      );
      const d = await rowsOf<{ demand: number }>(
        c,
        `SELECT COALESCE(SUM(quantity),0)/7.0 AS demand FROM sales
         WHERE product_id = ? AND sold_at >= datetime('now','-7 days')`,
        [p.id]
      );
      const stock = Number(s[0]?.stock ?? 0);
      const demand = Number(d[0]?.demand ?? 0);
      const days = demand > 0 ? stock / demand : 999;
      const daysStr = demand > 0 ? `${days.toFixed(1)} days left` : 'no recent sales';
      lines.push(`${marker(days)} ${p.name} — ${stock} ${p.unit} · ${daysStr}`);
    }
    lines.push('');
    lines.push('[!] urgent · [~] watch · [ok] healthy');
    await send(lines.join('\n'));
    return;
  }

  if (cmd === 'owed') {
    const rows = await rowsOf<Record<string, any>>(
      c,
      `SELECT r.amount, r.due_date, r.recorded_at, cu.name AS customer_name
       FROM receivables r JOIN customers cu ON cu.id = r.customer_id
       WHERE r.status = 'open'
       ORDER BY r.due_date ASC`
    );

    if (!rows.length) {
      await send('No outstanding debts. Everyone is paid up.');
      return;
    }

    // Group by customer, sum amounts, take the oldest age.
    const byCustomer = new Map<string, { total: number; oldestAge: number }>();

    for (const r of rows) {
      const name = String(r.customer_name);
      const amount = Number(r.amount);
      const dateStr = r.due_date || r.recorded_at;
      let age = 0;
      if (dateStr) {
        const t = new Date(String(dateStr).slice(0, 10)).getTime();
        if (Number.isFinite(t)) {
          age = Math.max(0, Math.floor((Date.now() - t) / 86400000));
        }
      }

      const existing = byCustomer.get(name);
      if (existing) {
        existing.total += amount;
        existing.oldestAge = Math.max(existing.oldestAge, age);
      } else {
        byCustomer.set(name, { total: amount, oldestAge: age });
      }
    }

    const lines = ['SEER — Owed to you', ''];
    let grand = 0;
    const sorted = Array.from(byCustomer.entries()).sort(
      (a, b) => b[1].oldestAge - a[1].oldestAge
    );

    for (const [name, info] of sorted) {
      grand += info.total;
      lines.push(
        `${marker(info.oldestAge, true)} ${name} — ${fmtRand(info.total)} · ${info.oldestAge}d`
      );
    }

    lines.push('');
    lines.push(`Total: ${fmtRand(grand)}`);
    await send(lines.join('\n'));
    return;
  }

  if (cmd === 'today') {
    const risks = (await computeRisks()).slice(0, 3);
    if (!risks.length) {
      await send('No active risks. Send a photo to seed data.');
      return;
    }
    const lines = ['SEER — Today', ''];
    risks.forEach((r, i) => {
      const sev = r.exposure.prevented >= 600 ? '[!]' : r.exposure.prevented >= 300 ? '[~]' : '[ok]';
      lines.push(`${i + 1}. ${sev} ${r.title}`);
      lines.push(`   ${r.reason}`);
      lines.push(`   → ${r.recommendation}`);
      lines.push('');
    });
    lines.push('Reply 1, 2, 3 or ALL to approve.');
    await send(lines.join('\n'));
    await log('today.sent', { count: risks.length });
    return;
  }

  if (cmd === 'report') {
    const risks = await computeRisks();
    const totals = risks.reduce(
      (s, r) => ({
        without: s.without + r.exposure.without,
        with: s.with + r.exposure.with,
        prevented: s.prevented + r.exposure.prevented,
      }),
      { without: 0, with: 0, prevented: 0 }
    );
    await send(
      [
        'SEER — 7-Day Impact',
        '',
        `Prevented:    ${fmtRand(totals.prevented)}`,
        `Without SEER: ${fmtRand(totals.without)}`,
        `With SEER:    ${fmtRand(totals.with)}`,
        '',
        `Active risks: ${risks.length}`,
        '',
        'Type statement for full PDF, or csv for raw data.',
      ].join('\n')
    );
    await log('report.sent', { total: totals.prevented });
    return;
  }

  if (cmd === 'statement') {
    try {
      await log('statement.requested', {});
      await send('Generating statement PDF…');

      const { bytes, hash } = await buildStatementPdf();

      const b64 = Buffer.from(bytes).toString('base64');
      const filename = `statement-${hash.slice(0, 8)}.pdf`;
      const c2 = await db();
      await run(
        c2,
        'INSERT OR REPLACE INTO statement_files (hash, filename, bytes_b64) VALUES (?, ?, ?)',
        [hash, filename, b64]
      );

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
      const pdfUrl = `${baseUrl}/api/statements/${hash}`;
      const verifyUrl = `${baseUrl}/verify/${hash}`;

      await send(
        [
          'SEER — Financial Statement',
          '',
          `Hash:   ${hash.slice(0, 16)}…`,
          '',
          `PDF:    ${pdfUrl}`,
          `Verify: ${verifyUrl}`,
          '',
          'Signed with HMAC-SHA256. Any alteration breaks the signature.',
        ].join('\n')
      );
      await log('statement.sent', { hash });
      return;
    } catch (e) {
      console.error('[handler] statement failed:', e);
      await send('Could not generate statement. Try again.');
      return;
    }
  }

  if (cmd === 'csv') {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    await send(
      [
        'SEER — Data Export',
        '',
        'Products (with popularity, stock, sales):',
        `${baseUrl}/api/export?type=products`,
        '',
        'Sales (raw transactions):',
        `${baseUrl}/api/export?type=sales`,
        '',
        'Expenses:',
        `${baseUrl}/api/export?type=expenses`,
        '',
        'Receivables:',
        `${baseUrl}/api/export?type=receivables`,
        '',
        'Each opens in Excel or Google Sheets.',
      ].join('\n')
    );
    return;
  }

  if (cmd === 'history') {
    const events = await rowsOf<Record<string, any>>(
      c,
      'SELECT type, created_at FROM activity ORDER BY id DESC LIMIT 10'
    );
    if (!events.length) {
      await send('No activity yet.');
      return;
    }
    const lines = ['SEER — Recent activity', ''];
    for (const e of events) lines.push(`[${String(e.created_at).slice(11, 16)}] ${e.type}`);
    await send(lines.join('\n'));
    return;
  }
}

async function handleBatch(
  c: any,
  send: (text: string) => Promise<void>,
  from: string,
  channel: string
): Promise<void> {
  const images = await rowsOf<Record<string, any>>(
    c,
    'SELECT url FROM pending_images WHERE sender = ? ORDER BY id ASC',
    [from]
  );
  if (!images.length) {
    await send('No pages waiting. Send photos first, then reply "done".');
    return;
  }

  const urls: string[] = images.map((i: any) => String(i.url));
  const kinds = urls.map(urlKind);
  const pdfCount = kinds.filter((k) => k === 'pdf').length;
  const imageCount = kinds.filter((k) => k === 'image').length;

  if (pdfCount > 0 && imageCount > 0) {
    await send(
      "You've sent both PDFs and photos in one batch. Reply 'clear', then send either all photos or a single PDF."
    );
    return;
  }

  if (pdfCount > 1) {
    await send(`You've sent ${pdfCount} PDFs. Send one PDF at a time, or send photos instead.`);
    return;
  }

  try {
    await log('batch.processing', { count: urls.length, channel, kind: pdfCount ? 'pdf' : 'images' });
    await send(`Reading ${urls.length} page(s), please wait…`);

    let dataUrl: string;
    if (pdfCount === 1) {
      const res = await fetch(urls[0]);
      if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
    } else {
      const { imagesToPdf, pdfToDataUrl } = await import('./pdf-builder');
      const pdfBytes = await imagesToPdf(urls);
      dataUrl = pdfToDataUrl(pdfBytes);
    }

    let shopKey: string | undefined;
    try {
      const { getShopKey } = await import('./profile-store');
      shopKey = await getShopKey();
    } catch (e) {
      console.warn('[handler] shopKey lookup failed:', e);
    }

    const extracted = await extractRecord(dataUrl, shopKey ? { shopKey } : undefined);

    const rawStaged = (extracted as any).staged ?? [];
    const seen = new Set<string>();
    const staged: any[] = [];
    for (const s of rawStaged) {
      const e = s.entry ?? {};
      const key = [
        e.kind ?? '',
        e.item ?? e.name ?? '',
        e.qty ?? '',
        e.amount ?? '',
        e.raw_text ?? '',
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      staged.push(s);
    }

    if (staged.length) {
      const crypto = await import('crypto');
      const batchHash = crypto
        .createHash('sha256')
        .update(`${channel}:${from}:${Date.now()}`)
        .digest('hex')
        .slice(0, 32);

      for (let i = 0; i < staged.length; i++) {
        const s = staged[i];
        try {
          await run(
            c,
            `INSERT INTO staging_rows
             (batch_hash, source_label, section, row_index, payload_json, confidence, flags_json, status, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [
              batchHash,
              `${channel}:batch`,
              s.entry?.kind ?? 'unknown',
              i,
              JSON.stringify(s.entry ?? {}),
              s.entry?.confidence ?? null,
              JSON.stringify({ issues: s.entry?.issues ?? [] }),
              s.reason ?? 'unclassified',
            ]
          );
        } catch (e) {
          console.warn('[handler] staged insert failed:', e);
        }
      }
      await log('staged.saved', { count: staged.length, channel });
    }

    const result = await ingestExtracted(
      extracted,
      new Date().toISOString().slice(0, 10),
      `${channel}:batch`
    );

    await run(c, 'DELETE FROM pending_images WHERE sender = ?', [from]);

    const lines = [
      `Read ${images.length} page(s).`,
      '',
      `Products:     ${result.productsAdded}`,
      `Sales:        ${result.salesAdded ?? 0}`,
      `Expenses:     ${result.expensesAdded ?? 0}`,
      `Debts:        ${result.receivablesAdded}`,
      `Risks:        ${result.risksQueued}`,
    ];

    if (staged.length > 0) {
      lines.push(`Held back:    ${staged.length} (notes, totals, unclassified)`);
    }

    if (result.productsAdded > 15 && (result.salesAdded ?? 0) === 0) {
      lines.push('');
      lines.push('Note: I read stock items but no sales rows on these pages.');
      lines.push('If those pages list sales, type "clear" and send them again one at a time.');
    } else if (staged.length > 0) {
      lines.push('');
      lines.push('Type "review" to see what was held back.');
    } else if (result.risksQueued > 0) {
      lines.push('');
      lines.push('Reply 1, 2, 3 or ALL to approve actions.');
    }

    await send(lines.join('\n'));
    return;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('[handler] batch failed:', m);
    await log('batch.failed', { error: m, channel });
    await send('Could not read those pages. Reply "clear" to reset.');
    return;
  }
}

function safeParse(s: string): any {
  try { return JSON.parse(s ?? '{}'); } catch { return {}; }
}