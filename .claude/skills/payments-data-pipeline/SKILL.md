---
name: payments-data-pipeline
description: How to source, verify, and populate REAL payment-industry data into the Payments Intelligence tool's data files (daily/weekly/monthly summary archives, deep dives, expert commentary, sources). Use whenever the user asks to populate, refresh, update, or add summaries/content. Always run alongside the data-integrity-guardrail skill. Covers the approved sources, the JSON schemas, the verification workflow, and how to handle blocked fetches.
---

# Payments Data Pipeline — Populating Real Data

This tool is an **Instant Payments Intelligence Aggregator**. Its entire purpose
is to surface REAL payment-industry developments from REAL sources on a regular
cadence (daily / weekly / monthly). It is NOT a static demo and NOT a place for
synthetic filler. Before doing anything here, honor `data-integrity-guardrail`.

## The data files and their schemas

All live in `/home/user/Payments/data/`.

### daily_summaries_archive.json — array, newest first
```json
{
  "date": "YYYY-MM-DD",          // real date the event was reported
  "headline": "Real headline",    // from/accurate to the real source
  "summary": "## Section\n\nFactual prose grounded in the cited source.",
  "sources": ["source-id"]        // IDs that MUST exist in approved_sources.json
}
```

### weekly_summaries_archive.json — array, newest first
Same as daily plus `"period": "week"`. `date` = start of week. Synthesize ONLY
real events that actually occurred that week; every claim traces to a source.

### monthly_summaries_archive.json — array, newest first
Same plus `"period": "month"`. `date` = first of month. Organize by real themes
(Infrastructure, Regulation, Adoption, Cross-Border). Every stat is sourced.

### expert_commentary.json — array
Real named analysts (Alex Johnson/Fintech Takes, Simon Taylor/Fintech Brainfood,
Kiah Haslett/Bank Director, etc.) with their real newsletter/article URLs. Only
include a take that the person actually published; link the real piece.

### deep_dives.json — array
Real published reports/research only. `sourceUrl` must point to the actual
report. NEVER ship a deep dive whose body is a placeholder — if I don't have the
real report content, leave deep_dives.json as `[]`.

### approved_sources.json — the source registry
Real organizations + working URLs + tier + category. Every `sources[]` ID used
anywhere else MUST resolve to an entry here. Don't invent source IDs.

## Verification workflow (the only way to add an entry)

1. **Search** real domains with WebSearch, scoped via `allowed_domains`, e.g.
   federalreserve.gov, occ.gov, theclearinghouse.org, fednow.org, swift.com,
   consumerfinance.gov, paymentsdive.com, pymnts.com, americanbanker.com,
   finextra.com.
2. **Open the source** with WebFetch to confirm the specific facts.
   - If WebFetch returns **403 / blocked** (PaymentsDive, PYMNTS, OCC often do),
     I do NOT upgrade to "verified." I either (a) find the same fact on an
     openable source, or (b) record it as **snippet-sourced** and say so to the
     user, or (c) skip it.
3. **Extract only what the source supports** — real numbers, real names, real
   dates. No extrapolation, no rounding into invented precision.
4. **Map sources** — ensure each referenced source ID exists in
   approved_sources.json; add the org there (with its real URL) if missing.
5. **Write the entry** in the schema above.
6. **Label provenance** honestly (verified vs snippet-sourced) in the commit
   message and, if asked, in the UI.

## Handling blocked fetches (important, recurring)

Many industry publishers 403 the fetch tool. That does NOT permit fabrication.
Options, in order of preference:
1. Corroborate the same fact from an openable primary source (regulator/operator
   newsroom, official PDF).
2. Keep it but mark **snippet-sourced** and tell the user the article couldn't be
   independently opened.
3. Drop the item.
Never silently present a blocked-but-unverified item as confirmed.

## Cadence / automation

- `.github/workflows` contains a daily pipeline (cron) and a Pages publish
  workflow (on push to `main`). The pipeline script is `scripts/run-pipeline.js`
  and uses `ANTHROPIC_API_KEY`. Any automated generation MUST obey the same
  integrity rules — an automated path is not an excuse to emit unsourced text.
- If automation cannot find real sourced items for a day, it should write nothing
  (or an explicit "no verified developments") rather than invent a day's news.

## After editing data — always

1. `npm run build-public` (copies data into `dist/` for GitHub Pages).
2. Validate JSON parses (`node -e "require('./data/<file>.json')"`).
3. Run the self-audit from `data-integrity-guardrail`.
4. Commit with source attribution; deploy per `site-deployment` skill.

## Known-good real sources already in approved_sources.json

Regulators/operators (Tier 1): Federal Reserve, OCC, FDIC, CFPB, NACHA, BIS, FSB,
FedNow, The Clearing House, SWIFT. Publications (Tier 2): American Banker,
Payments Dive, PYMNTS, Finextra, Digital Transactions, PaymentsJournal, The
Paypers, Tearsheet. Experts (Tier 1): Fintech Takes, Fintech Brainfood, Bank
Director. Use these; add others only with real working URLs.
