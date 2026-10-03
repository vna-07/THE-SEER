# SEER — Small Enterprise Early-Warning & Response

> Paper in. Decisions out. Nothing sent without approval.

DevSoc Hackathon 2026 · Track 5 (AI & Automation) · Rhodes University

Team: **Ayanda M. M. Vena** (technical lead) · **[Teammate]** (business & product lead)

---

## The problem

Small retailers run stock, credit and supplier records in notebooks. Problems
surface only after the money is lost: the shelf is empty, the debt is 18 days
old, the supplier is late. SEER attacks that delay rather than simply
digitising the notebook.

## What SEER does

1. **Capture** — the owner photographs a handwritten page on WhatsApp, or uploads it in the web app.
2. **Extract** — a vision model reads the page; structured data comes back with per-field confidence.
3. **Calculate** — deterministic TypeScript computes daily demand, days of stock left, reorder points and receivable ageing.
4. **Recommend** — risks are ranked with reasons in plain language.
5. **Approve & act** — SEER drafts supplier messages and reminders. The owner replies `1`, `ALL` or clicks Approve. Nothing is sent without that approval.

**Design rule:** the language model reads and explains, the code calculates, the owner decides.

## The headline metric

**Exposure Prevented** = projected loss without intervention − projected loss with it.

For the illustrative seed data: **R2 102 prevented over 7 days**.

Every figure in the app carries a **Measured**, **Calculated** or **Projected** badge, so its origin is never ambiguous.

## Repository layout

| Path | Purpose |
|---|---|
| `src/lib/engine.ts` | Decision engine — all formulas live here |
| `src/lib/ocr.ts` + `extraction.ts` | Vision + structuring pipeline (Gemini) |
| `src/lib/ingest.ts` | Writes extracted data into the DB, runs the engine |
| `src/lib/statement-pdf.ts` | Signed statement PDF generator |
| `src/lib/signature.ts` | HMAC-SHA256 signing + verification |
| `src/lib/sera.ts` | SERA — the built-in business analyst |
| `src/app/api/webhook/whatsapp` | Inbound WhatsApp (photo, approval, keyword menu) |
| `src/app/api/upload` + `manual` | Web upload and manual entry |
| `src/app/api/statement` | Signed statement PDF |
| `src/app/api/sera` | SERA chat endpoint |
| `src/app/verify/[hash]` | Public signature verification page |
| `src/app/page.tsx` | Command centre |
| `src/components/*` | Overview · Risks · Actions · Records · Simulation · Upload · SERA |

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate
npm run db:seed              # optional: loads the illustrative seed
npm run dev