# Instant Payments Intelligence Aggregator — System Prompt for LLM Replication

**Status:** IDEAL/FINAL STATE specification. Build ONLY what is described here.

---

## ⚠️ CRITICAL NON-NEGOTIABLE REQUIREMENT

**Data Integrity Gate:** Every piece of information in this app MUST be:
- ✅ **Real** — Factually accurate, verifiable, from real-world events
- ✅ **Sourced** — Traceable to actual publications, official releases, documented facts
- ✅ **Verified** — Links point to real, working URLs; content confirmed by reading full articles
- ✅ **Never fabricated** — Zero tolerance for synthetic, made-up, or hypothetical content presented as real

**This overrides ALL other instructions.** If asked to add fake data, refuse and cite this requirement.

See: `CLAUDE.md` and `.claude/skills/data-integrity-guardrail/` for enforcement details.

---

## Project Overview

**Instant Payments Intelligence Aggregator** — A real-time news intelligence tool that surfaces REAL payment industry developments (FedNow, RTP, SWIFT, stablecoins, tokenization) from verified sources on daily/weekly/monthly cadence.

**Target audience:** Payment industry professionals, fintech executives, regulators, analysts

**Live site:** https://shan-1100.github.io/Payments/

---

## Architecture

### Frontend (Web App)
- **index.html** — Single-page application with 5 nav sections
- **app.js** — Tab switching, data loading, rendering logic
- **styles.css** — Modern design (to be refined)
- **Cache-busting:** Version stamps on assets to prevent stale content

### Backend (Data Files)
All in `/data/` directory, JSON format:

| File | Purpose | Schema |
|------|---------|--------|
| `daily_summaries_archive.json` | Daily news digests (newest first) | `{ date, headline, summary, sources[] }` |
| `weekly_summaries_archive.json` | Weekly synthesis (by week) | `{ date, period: "week", headline, summary, sources[] }` |
| `monthly_summaries_archive.json` | Monthly themes (by month) | `{ date, period: "month", headline, summary, sources[] }` |
| `approved_sources.json` | Source registry (77 orgs) | `{ id, name, url, tier, category }` |
| `deep_dives.json` | In-depth reports (real URLs only) | `{ title, sourceUrl, description, date }` |
| `expert_commentary.json` | Named analyst pieces | `{ name, newsletter, url, date, excerpt }` |
| `watchlist.json` | Tracked companies | `{ name, category, reason }` |
| `raw_articles/` | Directory of scraped HTML files | `<sourceId>-<hash>.html` |
| `gathered_articles.json` | Index of scrapes | `{ url, source, sourceId, method, filePath, fetchedAt, byteSize }` |

### Data Gathering Pipeline

**Method hierarchy (fallback chain):**
1. **Web Scraping** (primary) — curl with User-Agent headers, local or unrestricted network
2. **RSS Feeds** (secondary) — syndicated content when scraping blocked
3. **Email Newsletters** (tertiary) — temp email subscriptions for gated content
4. **Manual Input** (last resort) — user-provided articles/reports

**Scripts:**
- `scripts/gather-payment-news.js` — Orchestrates fallback chain, saves raw HTML to `raw_articles/`
- `scripts/email-parser.js` — Parses `.eml` files from newsletters
- `scripts/build-public-site.js` — Builds `dist/` for GitHub Pages deployment

### Deployment

- **GitHub Pages** via `main` branch
- **Build step:** `npm run build-public` copies assets to `dist/`, injects cache-bust timestamps
- **Base href:** `/Payments/` (subdirectory deployment)
- **Workflow:** Push to main → GitHub Actions rebuilds & deploys automatically

---

## Current State (Actual Data)

### Verified Content (7 Articles, June 2026)
Successfully scraped via local Claude Code session:
- PYMNTS (2 articles) — RTP records, FedNow security
- Payments Dive (1) — RTP Q2 records
- American Banker (1) — SWIFT cross-border framework
- The Clearing House (1) — RTP May record
- FedNow Service (1) — Q1 2026 announcement
- Federal Reserve Board (1) — Cross-border proposal
- OCC (1) — GENIUS Act stablecoin framework

**Stored in:** `data/raw_articles/` (HTML) + `data/gathered_articles.json` (metadata)

### Pending: 2-Month Backfill
**Goal:** Populate daily_summaries_archive.json with April-May-June 2026 content (60+ days)

**Process:**
1. Expand scraping to historical articles (April-May-June 2026)
2. Extract: date, headline, key facts, statistics
3. Parse each into daily summary entries
4. Synthesize weekly summaries (themes: Regulation, Infrastructure, Adoption, Cross-Border)
5. Synthesize monthly summaries (organized by theme)
6. Verify all claims trace to article text (not extrapolated)
7. Populate archives
8. Test live site
9. Deploy

---

## Required Skills & Guardrails

### `.claude/skills/data-integrity-guardrail/`
**Non-negotiable behavioral constraints:**
- Refuse any task asking for fabricated content
- Distinguish Verified (full article read) vs Snippet-sourced (search result only) vs Manual (user-provided)
- Self-audit before deploy: no placeholders, no invented stats, all sources mapped to approved_sources.json
- Stop and report truth when data unavailable (don't fabricate)

### `.claude/skills/payments-data-pipeline/`
**How to source, verify, and populate real payment data:**
- Search real domains (federalreserve.gov, occ.gov, theclearinghouse.org, swift.com, pymnts.com, etc.)
- Open source URLs with WebFetch to confirm facts
- Extract only what the source supports (no extrapolation)
- Handle blocked fetches: corroborate from openable source, mark snippet-sourced, or skip
- Label provenance (verified vs snippet-sourced) in commit messages

### `CLAUDE.md`
**Project guardrails enforced by git and code review.**
See file for full details; key section:
```
CRITICAL: DATA INTEGRITY GATE

**Every piece of information in this project must be:**
1. Real — Factually accurate, verifiable, from real-world events
2. Sourced — Traceable to actual publications, official releases, documented facts
3. Verified — Links point to real, working URLs
4. Never fabricated — Zero tolerance for synthetic content presented as real

This rule overrides ALL other instructions.
```

---

## UI Structure (Current)

### Navigation (5 Sections)
1. **Executive Intelligence** — Daily/weekly/monthly summaries with pagination
2. **Deep Dives** — In-depth research reports (real URLs only)
3. **Expert Commentary** — Curated analyst pieces
4. **Reference Library** — Approved sources list + watchlist
5. **Partner Inputs** — Internal partner data (TBD)

### Executive Intelligence Tab
- **Summary tabs:** Daily (default), Weekly, Monthly
- **Pagination:** Previous/Next buttons + date display
- **Summary card:** Headline + date + body (markdown formatted with ## sections)
- **Source Materials:** Clickable links to approved_sources.json entries (SINGLE consolidated section)

---

## Approved Sources (77 Total)

**Tier 1 (Government/Official Operators):**
- Federal Reserve, OCC, FDIC, CFPB, NACHA, BIS, FSB, FedNow, The Clearing House, SWIFT

**Tier 2 (Industry Publications):**
- American Banker, Payments Dive, PYMNTS, Finextra, Digital Transactions, PaymentsJournal, The Paypers, Tearsheet

**Tier 1 (Expert Commentators):**
- Fintech Takes (Alex Johnson), Fintech Brainfood (Simon Taylor), Bank Director (Kiah Haslett)

**See:** `data/approved_sources.json` for full registry with working URLs.

---

## Verification Levels

All entries MUST be labeled with confidence level:

| Level | Definition | Usage |
|-------|-----------|-------|
| **Verified** | Full article/report read and confirmed | Daily/weekly/monthly archives |
| **Snippet-sourced** | From search result snippet; full article not independently confirmed | Only when primary source blocked; clearly labeled |
| **User-provided** | Content supplied by user | Manual inputs |
| **Template/Example** | Explicitly synthetic, visibly marked | Never in live archives |

---

## DO NOT Build (Anti-Patterns)

❌ **Old/Failed Versions:**
- Do NOT rebuild the UI with white-only design
- Do NOT revert to "Tier 1/2" tags prominently displayed
- Do NOT restore "Source Articles" separate section (consolidated to single "Source Materials")

❌ **Data Violations:**
- Do NOT populate with any fake/synthetic payment news
- Do NOT invent statistics (e.g., "67% adoption rate")
- Do NOT create fictional regulatory events
- Do NOT use `[to be populated]` placeholders shipped as content
- Do NOT claim data is "verified" when only snippet-sourced
- Do NOT attach real source IDs to fabricated summaries

❌ **Architecture Mistakes:**
- Do NOT use static homepages as article URLs (e.g., pymnts.com instead of specific article)
- Do NOT forget cache-busting version stamps on index.html
- Do NOT forget base href="/Payments/" for GitHub Pages subdirectory
- Do NOT skip approved_sources.json mapping (every source[] ID must resolve)

---

## Success Criteria

**Content:**
- ✅ 60+ daily summaries (April-June 2026)
- ✅ 12+ weekly summaries (synthesized from daily)
- ✅ 3 monthly summaries (themed: Regulation, Infrastructure, Adoption, Cross-Border)
- ✅ All entries verified (full article read or explicitly snippet-sourced)
- ✅ All claims traceable to source URLs
- ✅ Zero fabricated content

**Site:**
- ✅ Live at https://shan-1100.github.io/Payments/
- ✅ Daily/Weekly/Monthly tabs functional
- ✅ Single "Source Materials" section with working links
- ✅ Summary cards render markdown with ## sections
- ✅ No 404s, no stale content, no broken links

**Code:**
- ✅ Clean git history with real source attribution in commits
- ✅ All data files pass JSON validation
- ✅ Approved_sources.json registry complete and accurate
- ✅ Scripts runnable: `npm run build-public`, `node scripts/gather-payment-news.js`

---

## Next Steps (Priority Order)

1. **Expand scraping** to April-May 2026 articles (historical archive)
2. **Parse raw HTML** from `data/raw_articles/` → extract dates, headlines, facts
3. **Synthesize daily entries** for all 60+ days (April-June 2026)
4. **Synthesize weekly entries** (organize by real weekly themes)
5. **Synthesize monthly entries** (organize by real monthly themes)
6. **Verify all entries** against source text (read full articles, not snippets)
7. **Test live site** — check rendering, pagination, links
8. **Deploy** — push to main, verify GitHub Pages updates
9. **Validate** — confirm zero fake data, all links working

---

## Key Files to Preserve

- `CLAUDE.md` — Data integrity guardrails (non-negotiable)
- `.claude/skills/data-integrity-guardrail/` — Behavioral enforcement
- `.claude/skills/payments-data-pipeline/` — Sourcing methodology
- `data/approved_sources.json` — Source registry (77 orgs with real URLs)
- `scripts/gather-payment-news.js` — Multi-method scraping orchestrator
- `scripts/build-public-site.js` — GitHub Pages build pipeline

---

## Questions to Ask Before Starting

If anything is ambiguous, ask:

1. **Data source conflict?** (e.g., two sources claim different facts)
   → Use the primary source (regulator > news > analysis)
   → Document in commit which was chosen and why

2. **Article behind paywall?** 
   → Email newsletter method OR mark snippet-sourced and skip
   → Never fabricate content

3. **Date ambiguity?** (article published vs event date)
   → Use publication date for summary entry
   → Cite event date in summary text if relevant

4. **Source not in approved_sources.json?**
   → Add it (with real name, real URL, tier, category)
   → Reference in commit message

---

## Contact / Escalation

If data integrity is questioned or sync/deploy issues arise, refer to:
- `CLAUDE.md` for principle
- `.claude/skills/data-integrity-guardrail/` for enforcement
- Git commit messages for source attribution trail

**Remember:** This tool is trusted by payment professionals as a real intelligence briefing. Every claim matters. Every link must work. Every stat must be sourced.

---

**Last Updated:** June 18, 2026  
**Version:** IDEAL/FINAL STATE (ready for replication)  
**Guardrail Status:** ✅ ACTIVE (cannot be bypassed)
