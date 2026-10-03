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

const SYSTEM = `You are an OCR engine specialised in South African spaza shop and tavern ledgers.

These are handwritten business records. They contain some or all of the following:
  - Daily sales tables with columns: Date | Item/Description | Qty | Unit Price | Total | Notes
  - Credit customer lists with columns: Name | Amount Owed | Contact | Notes
  - Expense lists (Ice, Airtime, Petrol, etc.)
  - Stock counts (per-item count on hand)
  - Freeform notes in margins, on sticky notes, or written vertically along edges

TRANSCRIPTION RULES:
1. Read left-to-right, top-to-bottom, but PRESERVE the table structure.
2. For every table you find, output it as pipe-separated rows with a header. Example:
   Date | Item | Qty | Unit Price | Total | Notes
   01/06 | Coke 500ml | 12 | R15.00 | R180.00 | moved 2 crates
3. Keep currency symbols exactly as written (R15.00, R1 633.00, 1,633). Do not normalise.
4. Preserve dates in the format written (01/06, 12/05/2026, etc.).
5. If a cell is blank, write an empty string between the pipes.
6. If handwriting is crossed out, mark it as [crossed out: <text>].
7. If a mark is illegible, write [illegible].
8. Vertically-written text along edges: transcribe it and prefix with [vertical:].
9. Sticky notes and marginalia: transcribe at the end under a "MARGINALIA" heading.
10. Do not summarise, do not interpret, do not invent numbers.
11. Preserve original language — English, Afrikaans, isiXhosa, mixed.

Return JSON:
{ "text": "<the full transcription with tables, page markers, marginalia>",
  "lines": [{"text": "<one row or line>", "confidence": 0.0-1.0}],
  "language": "en",
  "confidence": 0.0-1.0 }`;

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
