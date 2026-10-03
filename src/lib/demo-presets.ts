// ═══════════════════════════════════════════════════════════════
// Presentation mode presets.
// Stage 0 = empty (nothing scanned yet)
// Stage 1 = one day of trading (Mon 28/09)
// Stage 2 = full month (6 days of trading)
// ═══════════════════════════════════════════════════════════════

export type DemoPreset = {
  label: string;
  recordDate: string;
  products: Array<{ name: string; quantity: number; unit: string; price: number }>;
  sales: Array<{ date: string; item: string; quantity: number; unitPrice: number; total: number }>;
  expenses: Array<{ date: string; description: string; amount: number }>;
  receivables: Array<{ customerName: string; amount: number; dueDate: string }>;
};

// ─── STAGE 1 · Monday 28 September ─────────────────────────────
export const STAGE_1: DemoPreset = {
  label: 'Monday 28 September 2026',
  recordDate: '2026-09-28',
  products: [
    { name: 'Milk 2L',        quantity: 8,  unit: 'carton', price: 22 },
    { name: 'Maize meal 5kg', quantity: 10, unit: 'bag',    price: 65 },
    { name: 'Bread (white)',  quantity: 14, unit: 'loaf',   price: 15 },
    { name: 'Coke 500ml',     quantity: 24, unit: 'bottle', price: 15 },
    { name: 'Fanta 500ml',    quantity: 18, unit: 'bottle', price: 15 },
  ],
  sales: [
    { date: '2026-09-28', item: 'isinkwa + ubisi + eggs',           quantity: 1, unitPrice: 520, total: 520 },
    { date: '2026-09-28', item: 'mealie meal, sugar, rice, oil',    quantity: 1, unitPrice: 780, total: 780 },
    { date: '2026-09-28', item: 'cooldrink / chips / sweets',       quantity: 1, unitPrice: 610, total: 610 },
    { date: '2026-09-28', item: 'smokes',                            quantity: 1, unitPrice: 340, total: 340 },
    { date: '2026-09-28', item: 'veg & fruit',                      quantity: 1, unitPrice: 190, total: 190 },
    { date: '2026-09-28', item: 'soap, washing pwd, jik',           quantity: 1, unitPrice: 150, total: 150 },
    { date: '2026-09-28', item: 'vetkoek & chips (hot)',            quantity: 1, unitPrice: 260, total: 260 },
  ],
  expenses: [
    { date: '2026-09-28', description: 'Cash & Carry groceries',    amount: 3850 },
    { date: '2026-09-28', description: 'Makhanda Bakery (on acc)',   amount: 620  },
    { date: '2026-09-28', description: 'Petrol bakkie',              amount: 240  },
    { date: '2026-09-28', description: 'Phone data bundle',          amount: 45   },
  ],
  receivables: [
    { customerName: 'Mrs Ndlovu', amount: 45, dueDate: '2026-09-28' },
    { customerName: 'Dlamini',    amount: 850, dueDate: '2026-09-10' },
  ],
};

// ─── STAGE 2 · Full month — 6 trading days ─────────────────────
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

function dailySales() {
  const rows: DemoPreset['sales'] = [];
  const values = [
    [520, 780, 610, 340, 190, 150, 260],
    [480, 710, 540, 300, 220, 170, 240],
    [610, 1040, 720, 410, 260, 230, 310],
    [640, 1180, 690, 450, 240, 260, 300],
    [560, 820, 780, 380, 210, 180, 340],
    [590, 760, 840, 360, 200, 140, 380],
  ];
  const labels = [
    'bread / milk / eggs',
    'groceries',
    'cooldrink / chips',
    'smokes',
    'veg',
    'household',
    'hot food',
  ];
  for (let d = 0; d < 6; d++) {
    for (let i = 0; i < 7; i++) {
      rows.push({
        date: DAYS[d],
        item: labels[i],
        quantity: 1,
        unitPrice: values[d][i],
        total: values[d][i],
      });
    }
  }
  return rows;
}

export const STAGE_2: DemoPreset = {
  label: 'Full month — 6 trading days',
  recordDate: '2026-10-03',
  products: [
    { name: 'Milk 2L',         quantity: 8,   unit: 'carton', price: 22 },
    { name: 'Maize meal 5kg',  quantity: 10,  unit: 'bag',    price: 65 },
    { name: 'Bread (white)',   quantity: 14,  unit: 'loaf',   price: 15 },
    { name: 'Coke 500ml',      quantity: 24,  unit: 'bottle', price: 15 },
    { name: 'Fanta 500ml',     quantity: 18,  unit: 'bottle', price: 15 },
    { name: 'Sprite 500ml',    quantity: 12,  unit: 'bottle', price: 15 },
    { name: 'Simba chips',     quantity: 20,  unit: 'pack',   price: 12 },
    { name: 'Nik Naks',        quantity: 16,  unit: 'pack',   price: 12 },
    { name: 'Monster energy',  quantity: 3,   unit: 'can',    price: 25 },
    { name: 'Red Bull',        quantity: 5,   unit: 'can',    price: 28 },
    { name: 'Soap (Sunlight)', quantity: 8,   unit: 'bar',    price: 12 },
    { name: 'Egg 6-pack',      quantity: 6,   unit: 'pack',   price: 25 },
  ],
  sales: dailySales(),
  expenses: [
    { date: '2026-09-28', description: 'Cash & Carry groceries',   amount: 3850 },
    { date: '2026-09-29', description: 'Cooldrink dist. CD-5521',  amount: 2380 },
    { date: '2026-09-30', description: 'Tobacco dist. TB-771',     amount: 2100 },
    { date: '2026-10-01', description: 'Cash & Carry CC-88307',    amount: 2160 },
    { date: '2026-10-01', description: 'Rent — October',           amount: 3200 },
    { date: '2026-10-01', description: 'Rates debit order',        amount: 480  },
    { date: '2026-10-02', description: 'Petrol bakkie',            amount: 240  },
    { date: '2026-10-03', description: 'Wages — Thandeka',         amount: 1500 },
    { date: '2026-10-03', description: 'Wages — Sipho',            amount: 480  },
  ],
  receivables: [
    { customerName: 'Dlamini',     amount: 850, dueDate: '2026-09-15' },
    { customerName: 'Mrs Ndlovu',  amount: 71,  dueDate: '2026-09-28' },
    { customerName: 'Thabo M',     amount: 120, dueDate: '2026-09-14' },
    { customerName: 'Lerato',      amount: 85,  dueDate: '2026-09-13' },
    { customerName: 'Sipho D',     amount: 60,  dueDate: '2026-09-12' },
    { customerName: 'Dineo',       amount: 150, dueDate: '2026-09-11' },
    { customerName: 'Musa',        amount: 90,  dueDate: '2026-09-10' },
    { customerName: 'Mr Jacobs',   amount: 230, dueDate: '2026-09-18' },
    { customerName: 'Bhut Mzi',    amount: 180, dueDate: '2026-09-12' },
    { customerName: 'Zodwa N',     amount: 45,  dueDate: '2026-09-30' },
  ],
};

export const PRESETS: Record<number, DemoPreset> = {
  1: STAGE_1,
  2: STAGE_2,
};