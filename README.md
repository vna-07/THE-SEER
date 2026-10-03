# SEER — Small Enterprise Early-Warning & Response

> **Paper in. Decisions out. Nothing sent without approval.**

![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)
![Turso](https://img.shields.io/badge/Turso-libSQL-4FF8D2?logo=turso)
![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-4285F4?logo=google)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

**DevSoc Hackathon 2026** · Track 5 (AI & Automation) · Rhodes University, Hamilton Building · 2–4 October 2026

---

## Table of Contents

- [Authors](#authors)
- [Institution & Event](#institution--event)
- [The Problem](#the-problem)
- [What SEER Does](#what-seer-does)
- [The Headline Metric](#the-headline-metric)
- [Use Cases](#use-cases)
- [Live Deployment](#live-deployment)
- [Technical Architecture & Production Stack](#technical-architecture--production-stack)
- [System Architecture Diagram](#system-architecture-diagram)
- [Repository Layout](#repository-layout)
- [How SEER Works Internally](#how-seer-works-internally)
- [The Extraction Pipeline](#the-extraction-pipeline)
- [The Decision Engine](#the-decision-engine)
- [SERA — The Conversational Analyst](#sera--the-conversational-analyst)
- [The Audit Chain](#the-audit-chain)
- [Security Model](#security-model)
- [Local Development & Setup](#local-development--setup)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [License](#license)
- [Closing Note](#closing-note)

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

## Institution & Event

**Rhodes University** — Department of Computer Science & Department of Information Systems  
Makhanda, Eastern Cape, South Africa

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

**Deliberately hard inputs.** The ledgers used to test SEER are not clean. They contain:

- Wrong additions and overwritten totals
- Smudged digits and faded ballpoint
- Duplicate invoices recorded twice
- Personal spending mixed with business expenses
- Whole-month bills that need proration across days
- Airtime and electricity pass-throughs that are *not* shop income
- Margin notes written in a second pen colour
- Struck-through lines with corrections written beside them

The system is designed to survive all of that.

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

The breakdown:

| Risk | Category | Exposure Prevented |
|---|---|---:|
| Maize meal 5 kg stockout | Stockout | **R 910** |
| Milk 2 L stockout | Stockout | **R 682** |
| Dlamini overdue | Receivable | **R 510** |
| | **Total** | **R 2 102** |

To prevent ambiguity, every financial figure displays an explicit **Measured**, **Calculated**, or **Projected** data badge across the platform.

---

## Use Cases

| Scenario | What SEER does |
|---|---|
| **Stockout warning** | Milk runs out in 31 hours. Supplier needs 2 days. SEER recalculates the reorder to 38 cartons and drafts the supplier message. |
| **Overdue receivable** | Dlamini owes R850, 18 days overdue. SEER drafts a polite reminder. Recovery probability is factored into exposure. |
| **Messy ledger** | A photographed page with wrong arithmetic and a duplicate invoice. SEER flags the discrepancy, rejects the duplicate, and holds low-confidence fields for review. |
| **Supplier delay** | The dairy moves delivery by 3 days. Lead time becomes 5. The uncovered gap grows. The reorder recalculates. |
| **Demand spike** | The owner tells SEER a Saturday event is coming. Expected demand increases 60%. Reorder quantities update. |
| **Weekly report** | A signed PDF statement with income, balance sheet, schedules, and an HMAC-SHA256 hash. |
| **Conversational query** | The owner asks SERA a question. She reads the same live data and answers in plain language. |

---

## Live Deployment

| Service | Endpoint / Link |
|---|---|
| **Command Centre** | https://seer-silk.vercel.app |
| **Signed Statement (Sample)** | `https://seer-silk.vercel.app/api/statements/<hash>` |
| **Public Verification Page** | `https://seer-silk.vercel.app/verify/<hash>` |
| **Telegram Bot** | [@seer_demo_bot](https://t.me/seer_demo_bot) |

The reviewer path: **no login, no setup**. The dashboard opens directly onto a loaded demo business. Every number is inspectable. Click any risk — a *Why this number?* drawer opens with the formula and its inputs. Click any tab — the data is live.

---

## Technical Architecture & Production Stack

| Layer | Choice | Notes |
|---|---|---|
| **Frontend & API** | Next.js 16 (App Router) | Serverless & Edge-ready, Turbopack builds |
| **Language** | TypeScript 5.4 | Deterministic calculation, type-safe engine |
| **Database** | Turso (distributed libSQL) | Local SQLite in dev, hosted in production |
| **Vision & Intelligence** | Google Gemini `gemini-2.5-flash` | Multimodal extraction & natural language interaction |
| **LLM Fallback** | Groq API | Automated fallback gateway if Gemini is unavailable |
| **Channel Gateway** | Telegram Bot API | Production channel |
| **WhatsApp Adapters** | Twilio & Whapi Cloud | Alternative WhatsApp transports |
| **Email** | Resend | Free tier, 100 emails/day, no credit card |
| **Signing** | HMAC-SHA256 (`node:crypto`) | No external dependencies, verifiable by anyone |
| **Hosting** | Vercel | Zero-cost deploy, serverless functions |

**Total running cost: R0.** No subscriptions. No credit card. No trial that expires. Gemini free tier, Telegram free Bot API, Vercel free tier, hosted SQLite.

---

## System Architecture Diagram
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ WhatsApp │ │ Next.js │ │ Turso │ │ Vercel │
│ Telegram │───▶│ API │───▶│ libSQL │───▶│ Edge │
│ Web app │ │ routes │ │ (SQLite) │ │ │
└─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
│
▼
┌──────────────┐
│ Gemini │ Vision + language
│ (2-pass) │
└──────────────┘
│
▼
┌──────────────┐
│ Deterministic│ Every number recomputed
│ Engine │ by TypeScript
└──────────────┘
│
▼
┌──────────────┐
│ Resend │ Owner approves → email sent
└──────────────┘

text

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
| `src/lib/email.ts` | Resend API wrapper with demo-redirect support |
| `src/lib/actions.ts` | Action lifecycle executor — approve, personalize, execute, settle |
| `src/lib/activity.ts` | Single activity stream written to by every subsystem |
| `src/app/api/*` | Serverless API routes (State, Statements, Audit Chain, SERA, Webhooks, Data Exports) |
| `src/app/verify/[hash]/` | Public cryptographic signature verification engine |
| `src/app/page.tsx` | Next.js Command Centre dashboard |
| `src/components/*` | UI Modules: Overview, Risks, Actions, Records, Simulation, Upload, SERA Chat, Audit Chain, ScanAnimation |
| `scripts/*` | Database seeding, schema migration, and system diagnostic scripts |

---

## How SEER Works Internally

| Layer | What it does |
|---|---|
| **Vision extraction** | Google Gemini reads the page. Two passes: discover the layout, then extract entries with per-field confidence. |
| **Layout profile cache** | Each shop's format is stored once. Later pages reuse it — extraction gets faster with use. |
| **Staging queue** | Low-confidence fields, struck-through lines, and duplicate invoices are held back for the owner to confirm, not guessed at. |
| **Decision engine** | Deterministic TypeScript. Computes demand, days-left, reorder points, ageing, exposure. |
| **Action service** | Drafts supplier messages, reminders, and purchase orders. Sends only on approval. |
| **Signature service** | Signs every statement with HMAC-SHA256. Publishes a public verify URL. |
| **Audit chain** | Hashes every event to the previous one. Tamper-evident by design. |
| **SERA** | A conversational analyst with refusal guardrails. Reads the same live data. |

### Efficiency Gains

| Task | Manual | SEER |
|---|---|---|
| Reading a page and totalling shelf lines | minutes | **seconds** |
| Identifying customers overdue | minutes | **instant** |
| Drafting a supplier message | minutes | **instant** |
| Generating an aged-debt report | hours | **one command** |
| Reconciling a page against its written total | error-prone | **deterministic** |

---

## The Extraction Pipeline

Two passes, one cache.

### Pass 1 — Layout Discovery

Gemini is given the page and asked to describe the layout:

- How many columns exist
- What each column contains
- How dates are formatted (`28/09`, `28-09`, `Sept 28`, etc.)
- Where corrections or struck-through lines appear
- Where the totals live
- What the header says (business name, owner, date)

The output is a JSON `LayoutProfile`.

### Pass 2 — Entry Extraction

Gemini is given the page *and* the `LayoutProfile`, and asked to extract every entry. Each field returns with a confidence score.

```json
{
  "products": [{ "name": "Milk 2L", "quantity": 6, "unit": "each", "price": 22, "confidence": 0.94 }],
  "sales": [...],
  "expenses": [...],
  "receivables": [{ "customerName": "Dlamini", "amount": 850, "dueDate": "2026-09-10", "confidence": 0.88 }]
}
