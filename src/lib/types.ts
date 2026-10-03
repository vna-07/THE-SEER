export type RiskType = 'stockout' | 'receivable';

export type Exposure = {
  without: number;
  with: number;
  prevented: number;
};

export type Risk = {
  id: string;
  type: RiskType;
  title: string;
  reason: string;
  severity: number;
  exposure: Exposure;
  inputs: Record<string, number | string>;
  recommendation: string;
  actionDraft: Record<string, unknown>;
};

export type ExtractedProduct = {
  name: string;
  quantity: number;
  unit?: string;
  price?: number;
  confidence: number;
};

export type ExtractedSupplier = {
  name: string;
  phone?: string;
  leadTimeDays?: number;
  confidence: number;
};

export type ExtractedReceivable = {
  customerName: string;
  amount: number;
  dueDate?: string;
  phone?: string;
  confidence: number;
};

export type ExtractedSale = {
  date?: string;
  item: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  notes?: string;
  confidence: number;
};

export type ExtractedExpense = {
  date?: string;
  description: string;
  amount: number;
  confidence: number;
};

export type ExtractedOrder = {
  item: string;
  quantity: number;
  confidence: number;
};

export type OcrLine = {
  text: string;
  confidence: number;
};

export type OcrResult = {
  text: string;
  lines: OcrLine[];
  language?: string;
  confidence: number;
};

export type ExtractedRecord = {
  products: ExtractedProduct[];
  suppliers: ExtractedSupplier[];
  receivables: ExtractedReceivable[];
  sales?: ExtractedSale[];
  expenses?: ExtractedExpense[];
  orders?: ExtractedOrder[];
  ocr: OcrResult;
};
