import { askVision } from './ai';
import { z } from 'zod';

export const OcrResultSchema = z.object({
  text: z.string(),
  lines: z.array(
    z.object({
      text: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  language: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;

const SYSTEM = `You are an OCR engine. Transcribe every handwritten or printed mark in the image exactly as written.
Do not interpret, correct, or summarise. Preserve line breaks. If a line is illegible, transcribe it as [illegible].
For each line, give a confidence 0-1. Give the overall document language (e.g. "en", "xh", "af", "mixed").
Return JSON matching this shape:
{ "text": "...", "lines": [{"text": "...", "confidence": 0.0-1.0}], "language": "en", "confidence": 0.0-1.0 }`;

export async function ocr(imageUrl: string): Promise<OcrResult> {
  const raw = await askVision(SYSTEM, 'Transcribe this page.', imageUrl, true);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OCR returned non-JSON: ${raw.slice(0, 200)}`);
  }

  return OcrResultSchema.parse(parsed);
}
