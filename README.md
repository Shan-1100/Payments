# Instant Payments Intelligence Aggregator

A real-time intelligence tool surfacing REAL payment industry developments (FedNow, RTP, SWIFT, stablecoins, tokenization) from verified sources on daily/weekly/monthly cadence.

**Status:** In active development. Currently populated with verified June 2026 intelligence. Backfill for April–May 2026 underway.

**Live site:** https://shan-1100.github.io/Payments/

---

## 📖 Documentation

**Start here based on your task:**

### For Understanding the Project
1. **[SYSTEM_PROMPT.md](./SYSTEM_PROMPT.md)** — Complete architecture specification (ideal final state). Read if you need to understand how everything fits together or replicate the app.

### For Backfilling Data (April–June 2026)
1. **[QUICKSTART.md](./QUICKSTART.md)** — 5-step overview of the backfill process (start here)
2. **[BACKFILL_GUIDE.md](./BACKFILL_GUIDE.md)** — Detailed 6-phase guide with step-by-step instructions
3. **[BACKFILL_CHECKLIST.md](./BACKFILL_CHECKLIST.md)** — Use during backfill to ensure data integrity

### For Understanding Data Integrity Requirements
- **[CLAUDE.md](./CLAUDE.md)** — Non-negotiable requirement: ALL data must be real, sourced, verified, never fabricated. Read first.

### For Technical Details
- **[DATA_GATHERING_STRATEGY.md](./DATA_GATHERING_STRATEGY.md)** — Multi-method data gathering architecture (web scraping, RSS feeds, email newsletters, manual input)
- **[scripts/gather-payment-news.js](./scripts/gather-payment-news.js)** — Article gathering orchestrator with fallback chain
- **[scripts/parse-raw-articles.js](./scripts/parse-raw-articles.js)** — Raw HTML parser for extracting dates, headlines, statistics

---

## 🚀 Quick Start

### View the Live Site
```
https://shan-1100.github.io/Payments/
```

### Local Testing
```bash
npm run build-public
python3 -m http.server 8000 --directory dist/
# Visit http://localhost:8000/Payments/
```

### Backfill Data (April–June 2026)
Must work in local Claude Code session with unrestricted network access:
```bash
cd ~/Desktop/myClaude_myProjects/Payments
claude .
# Then follow QUICKSTART.md
```

---

## 📁 Architecture

### Frontend (Single-Page App)
- **index.html** — Single-page app with 5 nav sections + cache-busting
- **app.js** — Tab switching, data loading, rendering logic
- **styles.css** — Modern responsive design
- **Base href:** `/Payments/` (GitHub Pages subdirectory deployment)

### Backend (JSON Data Files)

| File | Purpose | Schema |
|------|---------|--------|
| `data/daily_summaries_archive.json` | Daily news digests (newest first) | `{ date, headline, summary, sources[] }` |
| `data/weekly_summaries_archive.json` | Weekly synthesis (by week) | `{ date, period: "week", headline, summary, sources[] }` |
| `data/monthly_summaries_archive.json` | Monthly themes (by month) | `{ date, period: "month", headline, summary, sources[] }` |
| `data/approved_sources.json` | Source registry (77 orgs) | `{ id, name, url, tier, category }` |
| `data/deep_dives.json` | In-depth reports (real URLs only) | `{ title, sourceUrl, description, date }` |
| `data/expert_commentary.json` | Named analyst pieces | `{ name, newsletter, url, date, excerpt }` |
| `data/watchlist.json` | Tracked companies | `{ name, category, reason }` |
| `data/raw_articles/` | Scraped HTML files | `<sourceId>-<timestamp>.html` |
| `data/gathered_articles.json` | Index of scrapes | `{ url, source, sourceId, method, filePath, fetchedAt, byteSize }` |

### Deployment
- **GitHub Pages** via `main` branch
- **Build step:** `npm run build-public` (copies to `dist/`, injects cache-bust)
- **Workflow:** Push to main → GitHub Actions → auto-deploy

---

## 🎯 Current Status

### Verified Content (June 2026)
- **5 daily summaries** (June 13-17, 2026)
- **2 weekly summaries** (weeks of June 8, 15)
- **1 monthly summary** (June 2026)
- **7 articles** successfully scraped (clean, no failures)

### Pending: 2-Month Backfill
- **60+ daily summaries** (April 1 – June 17, 2026)
- **12+ weekly summaries** (all weeks in April–June)
- **3 monthly summaries** (April, May, June)

All must be verified from full article text (not snippets) and traceable to real sources.

---

## ✅ Non-Negotiable Requirement

**Data Integrity Gate (Read CLAUDE.md first):**

> Every piece of information in this project must be:
> 1. **Real** — Factually accurate, verifiable, from real-world events
> 2. **Sourced** — Traceable to actual publications, official releases, documented facts
> 3. **Verified** — Links point to real, working URLs; content confirmed by reading full articles
> 4. **Never fabricated** — Zero tolerance for synthetic, made-up, or hypothetical content presented as real

**This rule overrides ALL other instructions.**

---

## 🔧 Scripts

### Data Gathering
```bash
# Scrape articles (requires network access)
node scripts/gather-payment-news.js

# Parse raw HTML to extract structured data
node scripts/parse-raw-articles.js
```

### Build & Deploy
```bash
# Build for GitHub Pages
npm run build-public

# Local testing
python3 -m http.server 8000 --directory dist/
```

---

## 📊 Success Criteria

**Content:**
- ✅ 60+ daily summaries (April–June 2026)
- ✅ 12+ weekly summaries (organized by theme)
- ✅ 3 monthly summaries (organized by theme)
- ✅ All entries verified (full article read, not snippet-sourced)
- ✅ All claims traceable to source URLs
- ✅ Zero fabricated content

**Site:**
- ✅ Live at https://shan-1100.github.io/Payments/
- ✅ Daily/Weekly/Monthly tabs functional
- ✅ Single "Source Materials" section with working links
- ✅ Summary cards render markdown with proper formatting
- ✅ No 404s, no stale content, no broken links

**Code:**
- ✅ Clean git history with source attribution
- ✅ All data files pass JSON validation
- ✅ `approved_sources.json` complete (77 orgs, real URLs)
- ✅ Scripts runnable: `npm run build-public`, `node scripts/gather-payment-news.js`

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Backend:** JSON files (no database)
- **Data gathering:** curl, bash, Node.js
- **Deployment:** GitHub Pages (static hosting)
- **CI/CD:** GitHub Actions (auto-deploy on push to main)

---

## 📝 Contributing

All contributions must comply with the data integrity requirement:
- Only real data from verified sources
- Full article text must be read (not snippets)
- Claims must be traceable to published sources
- All source URLs must work and point to the actual article
- Zero synthetic or fabricated content

See CLAUDE.md and SYSTEM_PROMPT.md for details.

---

## 📞 Documentation Index

| Document | Purpose | Audience |
|----------|---------|----------|
| **CLAUDE.md** | Data integrity guardrail (non-negotiable) | Everyone |
| **SYSTEM_PROMPT.md** | Complete architecture spec | Developers, LLMs replicating app |
| **QUICKSTART.md** | 5-step backfill overview | Users starting backfill |
| **BACKFILL_GUIDE.md** | Detailed 6-phase process | Users doing backfill |
| **BACKFILL_CHECKLIST.md** | Verification checklist | Users during backfill |
| **DATA_GATHERING_STRATEGY.md** | Multi-method gathering architecture | Developers extending data pipeline |

---

**Last Updated:** June 18, 2026  
**Status:** IDEAL/FINAL STATE specification (ready for replication)  
**Guardrail Status:** ✅ ACTIVE (cannot be bypassed)
