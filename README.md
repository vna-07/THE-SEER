# SEER — Small Enterprise Early-Warning & Response

> **Paper in. Decisions out. Nothing sent without approval.**

**DevSoc Hackathon 2026** · Track 5 (AI & Automation) · Rhodes University, Hamilton Building · 2–4 October 2026

---

## Authors

**Ayolela M. M. Vena** — Technical Lead
- Core decision engine, two-pass vision extraction pipeline, channel routing (Telegram/WhatsApp), Turso + Vercel deployment.
- Deterministic calculation correctness, HMAC-SHA256 statement signing, hash-chained audit log, dynamic TOTP dev authentication.

**Inga Jikijela** — Business & Product Lead
- Trader interviews and ground-truth timing metrics, financial impact model, strategic product launch roadmap.
- Command Centre UX choreography, pitch narrative, written audit statements, PCR/SPL optimization, system stress testing.

Both members contributed equally to the problem formulation, impact modeling, domain stress testing, and live presentation.

---

## Institution

**Rhodes University** — Department of Computer Science & Department of Information Systems  
Makhanda, Eastern Cape, South Africa

## Event

**DevSoc Hackathon 2026** — *"Intelligence for Tomorrow"*  
3-day sprint (2–4 October 2026). Track 5: AI & Automation, incorporating core elements of Track 1 (Business Operations), Track 2 (Finance & Admin), and Track 4 (Data & Business Intelligence).

Prize: R5 000 for the winning submission.

---

## The Problem

Small township retailers run stock, credit, and supplier records in **paper notebooks**. Critical operational problems surface only after financial loss has already occurred:

- The shelf is empty during peak hours.
- A customer debt is 18 days overdue.
- A key dairy supplier misses a delivery without warning.

Three recurring failure modes drain operating capital:

1. **Stockouts** — high-demand items run out because inventory velocity is invisible on paper.
2. **Unchased Credit (*Makhaza*)** — customer credit balances accumulate unmonitored until recovery becomes impossible.
3. **Reactive Purchasing** — inventory orders are placed from memory, locking capital in slow-moving items while fast-moving stock depletes.

The core cost is not manual bookkeeping time. It is the **compounded revenue loss caused by delayed operational decisions**. SEER targets and eliminates that decision delay.

---

## What SEER Does

SEER executes a closed-loop, five-step decision cycle where the shop owner retains total administrative control:

1. **Capture** — the owner snaps a photo of a handwritten ledger page via Telegram/WhatsApp or uploads it to the Web Command Centre.
2. **Extract** — a two-pass vision engine parses the image into structured data:
   - **Pass 1 (Discover):** classifies page structure, detects column headers, and constructs a reusable `LayoutProfile`.
   - **Pass 2 (Extract):** parses line items using the generated profile, outputting strict JSON with per-field confidence scores and quality flags.
   - **Cache:** stores the `LayoutProfile` per spaza node in Turso, bypassing Pass 1 for subsequent uploads from the same shop.
3. **Calculate** — deterministic TypeScript code computes daily sales velocity, days of stock remaining, optimal reorder triggers, credit aging, and financial risk exposure.
4. **Recommend** — risks are prioritized by exposure value and explained in plain language.
5. **Approve & Act** — SEER drafts supplier purchase orders and customer debt reminders. The owner approves actions by replying `1`, `ALL`, or tapping **Approve** in the dashboard. **Zero messages are sent without explicit owner authorization.**

> **Core Architectural Rule:** The AI vision model reads and explains, deterministic code calculates, and the shop owner decides.

---

## The Headline Metric

$$\text{Exposure Prevented} = \text{Projected Loss Without Intervention} - \text{Projected Loss With Intervention}$$

For the default seed data set:

> **R2 102** in financial risk exposure prevented over a 7-day period.

To prevent ambiguity, every financial figure displays an explicit **Measured**, **Calculated**, or **Projected** data badge across the platform.

---

## Live Deployment

| Service | Endpoint / Link |
|---|---|
| **Command Centre** | [https://seer-silk.vercel.app](https://seer-silk.vercel.app) |
| **Signed Statement (Sample)** | `https://seer-silk.vercel.app/api/statements/<hash>` |
| **Public Verification Page** | `https://seer-silk.vercel.app/verify/<hash>` |
| **Telegram Bot** | [@seer_demo_bot](https://t.me/seer_demo_bot) |

### Technical Architecture & Production Stack

- **Frontend & API:** Next.js 16 (App Router) on Vercel — Serverless & Edge-ready
- **Database:** Turso (Distributed cloud SQLite powered by `@libsql/client`)
- **Vision & Intelligence:** Google Gemini (`gemini-2.5-flash`) for multimodal extraction & natural language interaction; Groq API maintained as an automated fallback gateway
- **Channel Gateway:** Telegram Bot API (Production), with Twilio & Whapi Cloud adapters for WhatsApp messaging

---

## Repository Layout

| Path | Purpose |
|---|---|
| `src/lib/engine.ts` | Core decision engine — mathematical formulas, single-query risk evaluation |
| `src/lib/layout.ts` | Two-pass layout discovery engine, prompts, and extraction schemas |
| `src/lib/profile-store.ts` | Per-shop layout profile store backed by Turso |
| `src/lib/extraction.ts` | Unified extraction pipeline connecting discovery and line-item parsing |
| `src/lib/ocr.ts` | Raw vision transcription fallback module |
| `src/lib/ai.ts` | Gemini SDK wrapper featuring exponential backoff and retry handling |
| `src/lib/ingest.ts` | Transactional ingestion pipeline: date normalization, deduplication, provenance tracking |
| `src/lib/signature.ts` | Cryptographic HMAC-SHA256 signature generator for financial audit statements |
| `src/lib/chain.ts` | Append-only, tamper-evident hash-chained audit log |
| `src/lib/sera.ts` | SERA — built-in AI business analyst with strict compliance and advisory guardrails |
| `src/lib/statement-pdf.ts` | 4-page signed financial statement PDF engine (Income Statement, Balance Sheet, Risk Schedules) |
| `src/lib/handler.ts` | Channel-agnostic inbound message router |
| `src/lib/channels.ts` | Messaging adapters for Telegram, WhatsApp, and Email |
| `src/lib/security.ts` | IP/Dev allowlists, dynamic TOTP passcode lockout, SSRF protection, message deduplication |
| `src/lib/dev.ts` | Developer Control Center CLI handler (`chat ovrd`, seed, reset, wipe) |
| `src/lib/db.ts` | Centralized `@libsql/client` instance and async query helper library |
| `src/lib/migrations.ts` | Idempotent database migration harness for schema updates |
| `src/app/api/*` | Serverless API routes (State, Statements, Audit Chain, SERA, Webhooks, Data Exports) |
| `src/app/verify/[hash]/` | Public cryptographic signature verification engine |
| `src/app/page.tsx` | Next.js Command Centre dashboard |
| `src/components/*` | UI Modules: Overview, Risks, Actions, Records, Simulation, Upload, SERA Chat, Audit Chain |
| `scripts/*` | Database seeding, schema migration, and system diagnostic scripts |

---

## Local Development & Setup

### 1. Installation

```bash
# Clone the repository
git clone [https://github.com/ayolela-vena/seer.git](https://github.com/ayolela-vena/seer.git)
cd seer

# Install node dependencies
npm install
