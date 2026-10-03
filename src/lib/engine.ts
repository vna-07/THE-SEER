import { db, rowsOf } from './db';
import type { Risk } from './types';

export const HORIZON_DAYS = 7;

const daysLeft = (stock: number, demand: number): number =>
  demand > 0 ? stock / demand : Infinity;

const gap = (d: number, lead: number): number => Math.max(0, lead - d);

const reorderQty = (
  demand: number,
  lead: number,
  safety: number,
  stock: number,
  horizon = HORIZON_DAYS
): number =>
  Math.max(
    0,
    Math.ceil(
      demand * (horizon - lead) + safety - Math.max(0, stock - demand * lead)
    )
  );

export async function computeRisks(recoveryRate = 0.6): Promise<Risk[]> {
  const c = await db();
  const risks: Risk[] = [];

  // ─── Single query for all products + stock + demand + supplier ───
  const products = await rowsOf<Record<string, any>>(
    c,
    `SELECT
       p.*,
       COALESCE(st.stock, 0) AS stock,
       COALESCE(dm.demand, 0) AS demand,
       s.name AS supplier_name,
       s.lead_time_days AS lead_time_days
     FROM products p
     LEFT JOIN (
       SELECT product_id, SUM(quantity) AS stock
       FROM stock_events
       GROUP BY product_id
     ) st ON st.product_id = p.id
     LEFT JOIN (
       SELECT product_id, SUM(quantity) / 7.0 AS demand
       FROM sales
       WHERE sold_at >= datetime('now', '-7 days')
       GROUP BY product_id
     ) dm ON dm.product_id = p.id
     LEFT JOIN suppliers s ON s.id = p.supplier_id`
  );

  for (const p of products) {
    const demand = Number(p.demand ?? 0);
    if (demand <= 0) continue;

    const stock = Number(p.stock ?? 0);
    const lead = Number(p.lead_time_days ?? 1);
    const price = Number(p.price);

    const d = daysLeft(stock, demand);
    const g = gap(d, lead);
    const qty = reorderQty(demand, lead, demand, stock);

    const without = Math.max(0, HORIZON_DAYS - d) * demand * price;
    const withSeer = g * demand * price;
    const prevented = without - withSeer;

    if (prevented > 0 || g > 0) {
      risks.push({
        id: `stock-${p.id}`,
        type: 'stockout',
        title: `${p.name} stockout`,
        reason: `Stock ${stock}, demand ${demand.toFixed(1)}/day, lead time ${lead} days. Runs out in about ${d.toFixed(1)} days.`,
        severity: prevented,
        exposure: { without, with: withSeer, prevented },
        inputs: {
          stock,
          demand,
          leadTime: lead,
          price,
          daysLeft: d,
          gap: g,
          reorderQty: qty,
        },
        recommendation: `Reorder ${qty} ${p.unit}`,
        actionDraft: {
          type: 'purchase_order',
          productId: p.id,
          productName: p.name,
          quantity: qty,
          supplier: p.supplier_name,
          message: `Please supply ${qty} ${p.unit} of ${p.name}.`,
        },
      });
    }
  }

  // ─── Single query for all open receivables ───
  const recv = await rowsOf<Record<string, any>>(
    c,
    `SELECT r.*, c.name AS customer_name
     FROM receivables r
     JOIN customers c ON c.id = r.customer_id
     WHERE r.status = 'open'`
  );

  for (const r of recv) {
    const amount = Number(r.amount);
    const age = Math.floor(
      (Date.now() - new Date(r.due_date as string).getTime()) / 86400000
    );
    if (age <= 0) continue;

    const without = amount;
    const withSeer = (1 - recoveryRate) * amount;
    const prevented = without - withSeer;

    risks.push({
      id: `recv-${r.id}`,
      type: 'receivable',
      title: `${r.customer_name} overdue`,
      reason: `R${amount} owed, ${age} days overdue.`,
      severity: prevented,
      exposure: { without, with: withSeer, prevented },
      inputs: { amount, ageDays: age, recoveryRate },
      recommendation: `Send reminder to ${r.customer_name}`,
      actionDraft: {
        type: 'reminder',
        receivableId: r.id,
        customerName: r.customer_name,
        amount,
        message: `Hi ${r.customer_name}, your account of R${amount} is ${age} days overdue. Please arrange payment.`,
      },
    });
  }

  return risks.sort((a, b) => b.severity - a.severity);
}