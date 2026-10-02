import { askText } from './ai';
import { ocr, type OcrResult } from './ocr';
import { z } from 'zod';

const ExtractedSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string().optional(),
      price: z.number().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
  suppliers: z.array(
    z.object({
      name: z.string(),
      phone: z.string().optional(),
      leadTimeDays: z.number().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
  receivables: z.array(
    z.object({
      customerName: z.string(),
      amount: z.number(),
      dueDate: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export type ExtractedRecord = z.infer<typeof ExtractedSchema> & {
  ocr: OcrResult;
};

const SYSTEM = `Extract products, prices, quantities, suppliers, lead times, customer debts and due dates from this handwritten page transcription.
Return JSON. Include a confidence 0-1 per field.
Never invent numbers. If a field is unclear or illegible, set its confidence below 0.5.
Shape: { "products": [{"name","quantity","unit?","price?","confidence"}], "suppliers": [{"name","phone?","leadTimeDays?","confidence"}], "receivables": [{"customerName","amount","dueDate?","confidence"}] }`;

export async function extractRecord(imageUrl: string): Promise<ExtractedRecord> {
  const o = await ocr(imageUrl);

  const raw = await askText(SYSTEM, o.text, true);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Extraction returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const structured = ExtractedSchema.parse(parsed);
  return { ...structured, ocr: o };
}
