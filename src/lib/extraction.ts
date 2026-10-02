import { askText } from './ai';
import { ocr, type OcrResult } from './ocr';
import { z } from 'zod';

// Tolerant schemas — Gemini returns strings for numbers and nulls for missing fields.
const num = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  });

const optNum = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'number') return v;
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? undefined : n;
  });

const optStr = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? undefined : v));

const confidence = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return 0.5;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? 0.5 : Math.min(1, Math.max(0, n));
  });

const ExtractedSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      quantity: num,
      unit: optStr,
      price: optNum,
      confidence: confidence,
    })
  ).default([]),
  suppliers: z.array(
    z.object({
      name: z.string(),
      phone: optStr,
      leadTimeDays: optNum,
      confidence: confidence,
    })
  ).default([]),
  receivables: z.array(
    z.object({
      customerName: z.string(),
      amount: num,
      dueDate: optStr,
      confidence: confidence,
    })
  ).default([]),
});

export type ExtractedRecord = z.infer<typeof ExtractedSchema> & {
  ocr: OcrResult;
};

const SYSTEM = `Extract products, prices, quantities, suppliers, lead times, customer debts and due dates from this handwritten page transcription.
Return JSON. Include a confidence 0-1 per field.
Never invent numbers. If a field is unclear or illegible, set its confidence below 0.5.
IMPORTANT: Numbers must be JSON numbers, not strings. Missing optional fields must be omitted or null, never the string "null".
Shape:
{
  "products": [{"name": "string", "quantity": 0, "unit": "string or null", "price": 0, "confidence": 0.0}],
  "suppliers": [{"name": "string", "phone": null, "leadTimeDays": 0, "confidence": 0.0}],
  "receivables": [{"customerName": "string", "amount": 0, "dueDate": "YYYY-MM-DD or null", "confidence": 0.0}]
}`;

export async function extractRecord(imageUrl: string): Promise<ExtractedRecord> {
  const o = await ocr(imageUrl);

  const raw = await askText(SYSTEM, o.text, true);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Extraction returned non-JSON: ${raw.slice(0, 300)}`);
  }

  const structured = ExtractedSchema.parse(parsed);
  return { ...structured, ocr: o };
}