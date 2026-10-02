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
  ocr: OcrResult;
};
