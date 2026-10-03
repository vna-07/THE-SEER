import { db, rowsOf } from './db';
import { askText } from './ai';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type DailyPoint = { date: string; revenue: number; count: number };

export type CategorySlice = {
  category: string;
  revenue: number;
  units: number;
  pct: number;
};

export type DOWPoint = {
  dow: number;      // 0 = Sunday
  label: string;
  avg: number;
  total: number;
  count: number;
};

export type MonthlyPoint = { month: string; revenue: number; count: number };

export type ForecastPoint = {
  date: string;
  predicted: number;
  low: number;
  high: number;
};

export type TopProduct = {
  name: string;
  units: number;
  revenue: number;
  avgPrice: number;
};

export type AnomalyDay = {
  date: string;
  revenue: number;
  expected: number;
  deviation: number;   // % above/below expected
  hint: string;        // "Heritage Day", "month-end", etc.
};

export type BusinessType = {
  type: string;
  confidence: number;
  reason: string;
};

export type Analytics = {
  generatedAt: string;
  totals: {
    revenue30: number;
    revenue90: number;
    orders30: number;
    avgOrderValue: number;
    uniqueProducts: number;
    tradingDays: number;
  };
  growth: {
    weekOverWeek: number;      // %
    monthOverMonth: number;    // %
    trend30: number;           // % slope direction
  };
  daily: DailyPoint[];         // last 90 days
  weekly: DailyPoint[];        // last 12 weeks
  monthly: MonthlyPoint[];     // last 12 months
  categories: CategorySlice[];
  dayOfWeek: DOWPoint[];
  forecast7: ForecastPoint[];
  forecast30: number;
  topProducts: TopProduct[];
  anomalies: AnomalyDay[];
  business: BusinessType;
};

// ═══════════════════════════════════════════════════════════════
// CATEGORY CLASSIFIER
// ═══════════════════════════════════════════════════════════════

export function categorise(name: string): string {
  const n = String(name ?? '').toLowerCase();

  if (/(bread|isinkwa|ubisi|milk|egg|amaqanda|dairy|cheese|yogurt|amasi)/.test(n)) {
    return 'Bread & Dairy';
  }
  if (/(mealie|maize|sugar|rice|flour|oil|cooking|groceries|polony|samp|beans|tinned)/.test(n)) {
    return 'Groceries';
  }
  if (/(coke|fanta|sprite|stoney|cooldrink|drink|chips|snack|sweets|simba|lays|pringles|nik ?nak|dorito|monster|red ?bull|water)/.test(n)) {
    return 'Drinks & Snacks';
  }
  if (/(smoke|cig|tobacco|malboro|peter|stuyvesant|rg|benson|dunhill)/.test(n)) {
    return 'Tobacco';
  }
  if (/(veg|fruit|banana|apple|tomato|onion|potato|carrot|spinach)/.test(n)) {
    return 'Veg & Fruit';
  }
  if (/(soap|jik|washing|detergent|household|candle|matches|blitz|sunlight|omo)/.test(n)) {
    return 'Household';
  }
  if (/(vetkoek|magwinya|hot|fried|food|slap ?chips|kotas|bunny)/.test(n)) {
    return 'Hot Food';
  }
  if (/(airtime|electricity|token|prepaid|vodacom|mtn|cell ?c|telkom)/.test(n)) {
    return 'Airtime & Tokens';
  }
  return 'Other';
}

// ═══════════════════════════════════════════════════════════════
// TIME SERIES
// ═══════════════════════════════════════════════════════════════

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

export async function getDailyRevenue(days = 90): Promise<DailyPoint[]> {
  const c = await db();
  const rows = await rowsOf<Record<string, any>>(
    c,
    `SELECT
       date(sold_at) AS date,
       COALESCE(SUM(quantity * COALESCE(p.price, 0)), 0) AS revenue,
       COUNT(*) AS count
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.sold_at >= datetime('now', ?)
     GROUP BY date(sold_at)
     ORDER BY date ASC`,
    [`-${days} days`]
  );

  // Fill gaps so the chart has a continuous x-axis.
  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    byDate.set(String(r.date), {
      date: String(r.date),
      revenue: Number(r.revenue ?? 0),
      count: Number(r.count ?? 0),
    });
  }

  const out: DailyPoint[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days);
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const k = isoDate(d);
    out.push(byDate.get(k) ?? { date: k, revenue: 0, count: 0 });
  }
  return out;
}

export async function getWeeklyRevenue(weeks = 12): Promise<DailyPoint[]> {
  const daily = await getDailyRevenue(weeks * 7 + 7);
  const buckets = new Map<string, DailyPoint>();

  for (const p of daily) {
    const d = new Date(p.date);
    // ISO week start = Monday
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1));
    const key = isoDate(d);
    const cur = buckets.get(key) ?? { date: key, revenue: 0, count: 0 };
    cur.revenue += p.revenue;
    cur.count += p.count;
    buckets.set(key, cur);
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMonthlyRevenue(months = 12): Promise<MonthlyPoint[]> {
  const c = await db();
  const rows = await rowsOf<Record<string, any>>(
    c,
    `SELECT
       strftime('%Y-%m', sold_at) AS month,
       COALESCE(SUM(quantity * COALESCE(p.price, 0)), 0) AS revenue,
       COUNT(*) AS count
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.sold_at >= datetime('now', ?)
     GROUP BY month
     ORDER BY month ASC`,
    [`-${months * 31} days`]
  );
  return rows.map((r) => ({
    month: String(r.month),
    revenue: Number(r.revenue ?? 0),
    count: Number(r.count ?? 0),
  }));
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY BREAKDOWN
// ═══════════════════════════════════════════════════════════════

export async function getRevenueByCategory(days = 30): Promise<CategorySlice[]> {
  const c = await db();
  const rows = await rowsOf<Record<string, any>>(
    c,
    `SELECT p.name AS name, s.quantity AS quantity, p.price AS price
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.sold_at >= datetime('now', ?)`,
    [`-${days} days`]
  );

  const map = new Map<string, { revenue: number; units: number }>();
  let total = 0;

  for (const r of rows) {
    const cat = categorise(String(r.name));
    const rev = Number(r.quantity) * Number(r.price ?? 0);
    const cur = map.get(cat) ?? { revenue: 0, units: 0 };
    cur.revenue += rev;
    cur.units += Number(r.quantity);
    map.set(cat, cur);
    total += rev;
  }

  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      revenue: v.revenue,
      units: v.units,
      pct: total > 0 ? (v.revenue / total) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ═══════════════════════════════════════════════════════════════
// DAY-OF-WEEK PATTERN
// ═══════════════════════════════════════════════════════════════

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function getDayOfWeekPattern(days = 90): Promise<DOWPoint[]> {
  const daily = await getDailyRevenue(days);
  const buckets: DOWPoint[] = DOW_LABELS.map((label, dow) => ({
    dow,
    label,
    avg: 0,
    total: 0,
    count: 0,
  }));

  for (const p of daily) {
    if (p.revenue === 0 && p.count === 0) continue;
    const d = new Date(p.date);
    const dow = d.getDay();
    buckets[dow].total += p.revenue;
    buckets[dow].count += 1;
  }

  for (const b of buckets) {
    b.avg = b.count > 0 ? b.total / b.count : 0;
  }
  return buckets;
}

// ═══════════════════════════════════════════════════════════════
// FORECAST — trend + day-of-week seasonality
// ═══════════════════════════════════════════════════════════════

function linearTrend(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };

  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept;
    ssTot += (values[i] - meanY) ** 2;
    ssRes += (values[i] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

export async function forecastNextDays(horizon = 7): Promise<ForecastPoint[]> {
  const daily = await getDailyRevenue(60);
  const recent = daily.filter((d) => d.count > 0 || d.revenue > 0);

  if (recent.length < 4) {
    return [];
  }

  const values = recent.map((d) => d.revenue);
  const { slope, intercept } = linearTrend(values);
  const dow = await getDayOfWeekPattern(90);
  const overallAvg = dow.reduce((s, d) => s + d.avg, 0) / dow.length;

  const out: ForecastPoint[] = [];
  const today = new Date();

  for (let i = 1; i <= horizon; i++) {
    const future = new Date(today);
    future.setDate(future.getDate() + i);
    const dowIdx = future.getDay();

    const trendValue = slope * (values.length + i) + intercept;
    const dowMultiplier = overallAvg > 0 ? dow[dowIdx].avg / overallAvg : 1;
    const predicted = Math.max(0, trendValue * dowMultiplier);

    out.push({
      date: isoDate(future),
      predicted: Math.round(predicted),
      low: Math.round(predicted * 0.7),
      high: Math.round(predicted * 1.3),
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════
// TOP PRODUCTS
// ═══════════════════════════════════════════════════════════════

export async function getTopProducts(limit = 10): Promise<TopProduct[]> {
  const c = await db();
  const rows = await rowsOf<Record<string, any>>(
    c,
    `SELECT p.name AS name,
            COALESCE(SUM(s.quantity), 0) AS units,
            COALESCE(SUM(s.quantity * COALESCE(p.price, 0)), 0) AS revenue,
            p.price AS avg_price
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.sold_at >= datetime('now', '-30 days')
     GROUP BY p.id
     ORDER BY revenue DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({
    name: String(r.name),
    units: Number(r.units ?? 0),
    revenue: Number(r.revenue ?? 0),
    avgPrice: Number(r.avg_price ?? 0),
  }));
}

// ═══════════════════════════════════════════════════════════════
// ANOMALY DETECTION (holiday, month-end, payday)
// ═══════════════════════════════════════════════════════════════

const SA_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'New Year',
  '2026-03-21': 'Human Rights Day',
  '2026-04-03': 'Good Friday',
  '2026-04-06': 'Family Day',
  '2026-04-27': 'Freedom Day',
  '2026-05-01': 'Workers Day',
  '2026-06-16': 'Youth Day',
  '2026-08-09': 'Womens Day',
  '2026-08-10': 'Womens Day (observed)',
  '2026-09-24': 'Heritage Day',
  '2026-12-16': 'Reconciliation Day',
  '2026-12-25': 'Christmas',
  '2026-12-26': 'Day of Goodwill',
};

export async function getAnomalies(days = 60): Promise<AnomalyDay[]> {
  const daily = await getDailyRevenue(days);
  const dow = await getDayOfWeekPattern(90);

  const flagged: AnomalyDay[] = [];

  for (const p of daily) {
    if (p.revenue === 0) continue;
    const d = new Date(p.date);
    const expected = dow[d.getDay()].avg;
    if (expected <= 0) continue;

    const dev = (p.revenue - expected) / expected;
    if (Math.abs(dev) < 0.35) continue;

    let hint = '';
    const holiday = SA_HOLIDAYS_2026[p.date];
    if (holiday) hint = holiday;
    else {
      const dom = d.getDate();
      if (dom <= 2) hint = 'Month-start — rent day, bills';
      else if (dom >= 28) hint = 'Month-end — grant/payday peak';
      else if (d.getDay() === 0 || d.getDay() === 6) hint = 'Weekend pattern';
      else hint = dev > 0 ? 'Unusually high — possible event' : 'Unusually low — weather or stockout?';
    }

    flagged.push({
      date: p.date,
      revenue: Math.round(p.revenue),
      expected: Math.round(expected),
      deviation: Math.round(dev * 100),
      hint,
    });
  }

  return flagged.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)).slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS TYPE INFERENCE
// ═══════════════════════════════════════════════════════════════

export async function inferBusinessType(): Promise<BusinessType> {
  const cats = await getRevenueByCategory(90);
  if (!cats.length) {
    return { type: 'unknown', confidence: 0, reason: 'Not enough data yet.' };
  }

  const total = cats.reduce((s, c) => s + c.revenue, 0);
  const pct = (name: string) =>
    ((cats.find((c) => c.category === name)?.revenue ?? 0) / total) * 100;

  const tobacco = pct('Tobacco');
  const hot = pct('Hot Food');
  const airtime = pct('Airtime & Tokens');
  const drinks = pct('Drinks & Snacks');
  const groceries = pct('Groceries');
  const dairy = pct('Bread & Dairy');

  if (hot >= 20) {
    return {
      type: 'Tavern / hot food counter',
      confidence: 0.85,
      reason: `Hot food is ${hot.toFixed(0)}% of revenue.`,
    };
  }
  if (tobacco >= 25 || drinks >= 40) {
    return {
      type: 'Liquor / beverage-led trader',
      confidence: 0.8,
      reason: `Tobacco ${tobacco.toFixed(0)}% · Drinks ${drinks.toFixed(0)}%.`,
    };
  }
  if (groceries + dairy >= 50) {
    return {
      type: 'Spaza / general dealer',
      confidence: 0.85,
      reason: `Groceries ${groceries.toFixed(0)}% + Bread & Dairy ${dairy.toFixed(0)}%.`,
    };
  }
  if (airtime >= 15) {
    return {
      type: 'Airtime-heavy convenience shop',
      confidence: 0.75,
      reason: `Airtime & Tokens is ${airtime.toFixed(0)}% of revenue.`,
    };
  }
  return {
    type: 'General trader',
    confidence: 0.6,
    reason: 'Mixed category spread, no dominant line.',
  };
}

// ═══════════════════════════════════════════════════════════════
// TOP-LEVEL AGGREGATION
// ═══════════════════════════════════════════════════════════════

export async function getAnalytics(): Promise<Analytics> {
  const [
    daily90,
    weekly,
    monthly,
    categories,
    dayOfWeek,
    forecast7,
    topProducts,
    anomalies,
    business,
  ] = await Promise.all([
    getDailyRevenue(90),
    getWeeklyRevenue(12),
    getMonthlyRevenue(12),
    getRevenueByCategory(30),
    getDayOfWeekPattern(90),
    forecastNextDays(7),
    getTopProducts(10),
    getAnomalies(60),
    inferBusinessType(),
  ]);

  const last30 = daily90.slice(-30);
  const prev30 = daily90.slice(-60, -30);
  const last7 = daily90.slice(-7);
  const prev7 = daily90.slice(-14, -7);

  const sum = (arr: DailyPoint[]) => arr.reduce((s, p) => s + p.revenue, 0);
  const orders30 = last30.reduce((s, p) => s + p.count, 0);
  const revenue30 = sum(last30);
  const revenue90 = sum(daily90);

  const wow = sum(prev7) > 0 ? ((sum(last7) - sum(prev7)) / sum(prev7)) * 100 : 0;
  const mom = sum(prev30) > 0 ? ((revenue30 - sum(prev30)) / sum(prev30)) * 100 : 0;

  // Simple slope on 30-day values
  const { slope } = linearTrend(last30.map((p) => p.revenue));
  const trend30 = revenue30 > 0 ? (slope / (revenue30 / 30)) * 100 : 0;

  const tradingDays = last30.filter((p) => p.count > 0).length;
  const uniqueProducts = topProducts.length;

  const forecast30 = forecast7.length
    ? Math.round((forecast7.reduce((s, f) => s + f.predicted, 0) / forecast7.length) * 30)
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      revenue30: Math.round(revenue30),
      revenue90: Math.round(revenue90),
      orders30,
      avgOrderValue: orders30 > 0 ? Math.round((revenue30 / orders30) * 100) / 100 : 0,
      uniqueProducts,
      tradingDays,
    },
    growth: {
      weekOverWeek: Math.round(wow * 10) / 10,
      monthOverMonth: Math.round(mom * 10) / 10,
      trend30: Math.round(trend30 * 10) / 10,
    },
    daily: daily90,
    weekly,
    monthly,
    categories,
    dayOfWeek,
    forecast7,
    forecast30,
    topProducts,
    anomalies,
    business,
  };
}

// ═══════════════════════════════════════════════════════════════
// SERA INSIGHTS
// ═══════════════════════════════════════════════════════════════

const SERA_ANALYTICS_SYSTEM = `You are SERA, the business analyst built into SEER.

You receive structured sales analytics for a South African small shop.
Return a short, plain-language analysis. Structure it EXACTLY like this,
with the headings in caps on their own line:

WHAT THE PATTERNS SAY
2-3 sentences about the trend, growth or decline, and visible seasonality.

LIKELY CAUSES
1-3 short bullets, one line each. Refer to day-of-week, month-end, payday,
weather, holidays, or events only if the data supports it.

OPPORTUNITIES
2-3 short bullets, one line each. Concrete actions the owner could take,
grounded in the numbers you were given.

RISKS TO WATCH
1-2 short bullets, one line each.

BUSINESS TYPE
One sentence naming the shop type (spaza, tavern, general dealer, mixed)
and why.

RULES:
- Never invent numbers. Cite only figures from the analytics you receive.
- Use R for rand. Round to whole rand.
- No emoji. No markdown. No tables.
- Total response under 220 words.
- End with a single line: Not financial advice — verify with your own records.`;

export async function generateInsights(a: Analytics): Promise<string> {
  const compact = {
    business: a.business,
    totals: a.totals,
    growth: a.growth,
    categories: a.categories.slice(0, 8),
    dayOfWeek: a.dayOfWeek,
    forecast7: a.forecast7,
    forecast30: a.forecast30,
    topProducts: a.topProducts.slice(0, 8),
    anomalies: a.anomalies.slice(0, 6),
    last30Daily: a.daily.slice(-30).map((p) => ({ date: p.date, revenue: Math.round(p.revenue) })),
  };

  try {
    const text = await askText(
      SERA_ANALYTICS_SYSTEM,
      'ANALYTICS DATA:\n' + JSON.stringify(compact, null, 2),
      false
    );
    return text.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[analytics] insights failed:', msg);
    return 'SERA could not generate insights right now. Try again in a moment.';
  }
}