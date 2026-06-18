# Backfill Guide: Populating 2-Month Payment Industry Archives

## Objective
Populate `daily_summaries_archive.json`, `weekly_summaries_archive.json`, and `monthly_summaries_archive.json` with REAL, VERIFIED payment industry intelligence from April–June 2026.

**Success criteria:**
- ✅ 60+ daily summaries (April 1 – June 17, 2026)
- ✅ 12+ weekly summaries (organized by real weekly themes)
- ✅ 3 monthly summaries (April, May, June 2026)
- ✅ ALL entries verified by reading full article text
- ✅ ALL claims traceable to source URLs
- ✅ Zero fabricated or synthetic data

---

## Current State

### Verified Daily Summaries: 5
- June 13-17, 2026 (sourced from real articles)

### Verified Weekly Summaries: 2
- Week of June 8
- Week of June 15

### Verified Monthly Summaries: 1
- June 2026

### Pending: 55+ Daily, 10+ Weekly, 2 Monthly

---

## Phase 1: Gather Article Content (Local Session Required)

### Prerequisites
You must work in a **local Claude Code session** with unrestricted network access:

```bash
cd ~/Desktop/myClaude_myProjects/Payments
claude .
```

The cloud session has restricted network access and cannot scrape payment industry sites.

### Step 1: Expand Historical Scraping

Run the news gathering script to scrape articles from April–May 2026:

```bash
node scripts/gather-payment-news.js
```

**Expected outcome:**
- Raw HTML files saved to `data/raw_articles/`
- Metadata index written to `data/gathered_articles.json`
- Summary report in `data/gathering_summary.json`

**Note:** The current `scripts/gather-payment-news.js` contains URLs for specific June 2026 articles. To backfill April–May, you may need to:
1. Search for payment industry news from those months on approved sources
2. Add URLs to the `NEWS_SOURCES` array in the script
3. Or manually copy article HTML to `data/raw_articles/` if you already have access

### Step 2: Parse Raw Article Content

Once articles are scraped, extract structured data:

```bash
node scripts/parse-raw-articles.js
```

**Outputs:**
- `data/parsed_articles.json` — metadata + snippets for each article
  - Extracted headlines
  - Publication dates (auto-detected from HTML)
  - Key statistics (numbers, percentages, amounts)
  - Summary snippets (first 3 sentences)

**Next action:** Review `parsed_articles.json`. For articles missing dates:
- Manually extract the date from the article HTML
- Update the entry in `parsed_articles.json`

---

## Phase 2: Create Daily Summaries

### Step 2a: Manual Content Verification

For EACH article:

1. **Open the raw HTML** from `data/raw_articles/`
2. **Read the FULL article** (not just the snippet)
3. **Extract:**
   - Exact publication date (YYYY-MM-DD)
   - Accurate headline
   - Key facts, figures, quotes (with context)
   - Related organizations/entities
4. **Identify approved sources** from `data/approved_sources.json`
   - Add source IDs to the `sources[]` array
   - If source not in registry, add it with real name + URL

### Step 2b: Create Summary Entry

Create a new entry in `daily_summaries_archive.json`:

```json
{
  "date": "2026-04-15",
  "headline": "Real headline from article",
  "summary": "## Section Heading\n\nFactual paragraph grounded in article. Include key statistics with context.\n\n## Another Section\n\nAdditional details verifiable from article text.",
  "sources": ["source-id-1", "source-id-2"]
}
```

**Rules:**
- **Headline:** Use or adapt the actual article headline
- **Summary:** Write in markdown (use `## Section` headers)
  - Each claim must be traceable to the article
  - NO extrapolation or synthesis beyond what the article states
  - NO invented statistics
- **Sources:** Only real source IDs from `approved_sources.json`
- **Date:** Actual publication date (not event date, unless clarified in body)

### Step 2c: Populate All Dates

Continue until you have entries for every date April 1 – June 17, 2026 where real articles exist.

**Note:** If a date has no verifiable article, leave it empty (do not invent content).

---

## Phase 3: Create Weekly Summaries

### Step 3a: Identify Weekly Themes

For each week (week starting Monday):

1. Gather all daily summaries for that week
2. Identify the common theme(s):
   - **Infrastructure:** FedNow, RTP, SWIFT upgrades, network milestones
   - **Regulation:** GENIUS Act, CBDC frameworks, banking rules
   - **Adoption:** Use cases, participant growth, volume milestones
   - **Cross-Border:** International payments, regulatory harmonization
   - **Partnerships:** Bank alliances, fintech integrations, API announcements

### Step 3b: Write Weekly Summary

```json
{
  "date": "2026-04-08",
  "period": "week",
  "headline": "[Real headline synthesized from week's events]",
  "summary": "## Theme 1\n\nSynthesis of real events that occurred during the week...\n\n## Theme 2\n\nAdditional developments...",
  "sources": ["source-id-1", "source-id-2", "source-id-3"]
}
```

**Rules:**
- **Date:** Monday of the week
- **Headline:** Synthesized from actual week's developments (not invented)
- **Summary:** Organize by real themes
  - ONLY reference events that occurred that week
  - Cite the daily summaries as your source material
  - NO new claims beyond daily summaries
- **Sources:** Union of all sources from constituent daily summaries

### Step 3c: Create All Weeks

April 2026: ~4 weeks
May 2026: ~4 weeks  
June 2026: ~2.5 weeks (up to June 17)

**Total: ~10–12 weekly summaries**

---

## Phase 4: Create Monthly Summaries

### Step 4a: Monthly Theme Synthesis

For each month (April, May, June):

1. Review all daily and weekly summaries for that month
2. Organize by permanent themes:
   - **Infrastructure Developments** — network milestones, system upgrades
   - **Regulatory Progress** — policy announcements, compliance frameworks
   - **Adoption & Use Cases** — volume growth, participant expansion, new use cases
   - **Cross-Border & International** — global payment developments

### Step 4b: Write Monthly Summary

```json
{
  "date": "2026-04-01",
  "period": "month",
  "headline": "[Real headline synthesizing month's significance]",
  "summary": "## Infrastructure Developments\n\nReal milestones from April...\n\n## Regulatory Progress\n\nReal regulatory actions...\n\n## Adoption & Use Cases\n\nReal adoption metrics...\n\n## Cross-Border & International\n\nReal international developments...",
  "sources": ["source-id-1", "source-id-2", ...]
}
```

**Rules:**
- **Date:** First day of month (YYYY-MM-01)
- **Headline:** Synthesized from month's most significant developments
- **Summary:** Organize by permanent themes (above)
  - ONLY reference events that occurred that month
  - Synthesize daily/weekly content into thematic narratives
  - Quote statistics and facts from daily/weekly summaries
  - NO invented developments or extrapolated trends
- **Sources:** Union of all sources from constituent daily/weekly summaries

### Step 4c: Create All Months

- April 2026
- May 2026
- June 2026

**Total: 3 monthly summaries**

---

## Phase 5: Verification & Validation

Before pushing changes, run this checklist:

### Data Integrity Audit

For **every entry** (daily, weekly, monthly):

- [ ] Every claim traceable to a real source article
- [ ] Every statistic has a source
- [ ] Every date corresponds to real events
- [ ] No `[to be populated]`, `TODO`, `TK`, or placeholder text
- [ ] No invented events, partnerships, or milestones
- [ ] No extrapolation beyond what sources support
- [ ] Every `sources[]` ID exists in `approved_sources.json`

### JSON Validation

```bash
node -e "require('./data/daily_summaries_archive.json')"
node -e "require('./data/weekly_summaries_archive.json')"
node -e "require('./data/monthly_summaries_archive.json')"
```

All three should parse without errors.

### Approved Sources Registry

```bash
node -e "const s = require('./data/approved_sources.json'); console.log(s.length + ' sources')"
```

Every source ID in your summaries must exist here.

---

## Phase 6: Build & Deploy

### Local Build

```bash
npm run build-public
```

This copies assets to `dist/` and injects cache-bust timestamps.

### Test the Live Site

```bash
# Start a local web server
python3 -m http.server 8000 --directory dist/

# Visit http://localhost:8000/Payments/
```

Test:
- Daily/Weekly/Monthly tabs switch correctly
- Pagination works (Previous/Next buttons)
- Summaries render with proper markdown formatting
- Source links are clickable and point to real URLs
- No 404 errors, no broken links

### Commit & Push

```bash
git add data/daily_summaries_archive.json
git add data/weekly_summaries_archive.json
git add data/monthly_summaries_archive.json
git commit -m "Backfill: April–June 2026 payment industry intelligence

Added 55+ daily, 10+ weekly, 2 monthly verified summaries covering:
- RTP and FedNow network growth and milestones
- Regulatory developments (GENIUS Act, cross-border frameworks)
- Adoption metrics and use case expansion
- Cross-border payment innovation

All entries verified from full article text. Sources traced to:
- Federal Reserve, OCC, FDIC
- The Clearing House, FedNow Service
- PYMNTS, Payments Dive, American Banker
- [Additional sources as applicable]

Sources: [list URLs if committing from local session]"

git push origin main
```

### Verify Deployment

Visit https://shan-1100.github.io/Payments/ and confirm:
- ✅ Daily/Weekly/Monthly tabs show all new summaries
- ✅ Pagination displays correct date ranges
- ✅ No 404 errors
- ✅ All source links working

---

## Troubleshooting

### "Article HTML missing publication date"

**Solution:**
1. Open the HTML file in a text editor
2. Search for date patterns: `2026-04`, `April`, `2026-0`, etc.
3. Manually extract the date
4. Update `parsed_articles.json` entry with correct date
5. Use this date when creating summary

### "Source not in approved_sources.json"

**Solution:**
1. Add the organization to `approved_sources.json`:
   ```json
   {
     "id": "new-source-id",
     "name": "Organization Full Name",
     "url": "https://real-website.com",
     "tier": "2",
     "category": "publication"
   }
   ```
2. Reference the new ID in the summary's `sources[]` array
3. Commit both files together

### "Build fails to run"

**Check:**
- Node.js installed? `node --version`
- Dependencies installed? `npm install`
- Scripts directory exists? `ls scripts/`
- Data directory exists? `ls data/`

### "Live site still shows old data"

**Solutions:**
1. Hard-refresh browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. Check that `main` branch is deployed: `git status`
3. Verify `dist/` has new files: `ls -la dist/data/`
4. Check GitHub Actions workflow: https://github.com/shan-1100/payments/actions

---

## Data Integrity Guardrails

**NON-NEGOTIABLE RULE:**
Every piece of information MUST be:
✅ **Real** — From actual payment industry events
✅ **Sourced** — Traceable to real publications
✅ **Verified** — You read the full article
✅ **Never fabricated** — Zero invented data

If you cannot verify content from a real source, **do not include it**.

See `CLAUDE.md` and `SYSTEM_PROMPT.md` for full requirements.

---

## Success Metrics

| Metric | Target | Verify |
|--------|--------|--------|
| Daily summaries | 60+ | `wc -l data/daily_summaries_archive.json` |
| Weekly summaries | 12+ | `jq '.[] | select(.period=="week")' data/weekly_summaries_archive.json \| wc -l` |
| Monthly summaries | 3 | `jq '.[] | select(.period=="month")' data/monthly_summaries_archive.json \| wc -l` |
| All sources verified | 100% | Manual audit against articles |
| Live site functional | 100% | Browser test at github.io URL |

---

## Questions?

Refer to:
- `CLAUDE.md` — Data integrity requirement (non-negotiable)
- `SYSTEM_PROMPT.md` — Complete architecture specification
- `scripts/parse-raw-articles.js` — Article parser source
- `scripts/gather-payment-news.js` — Article gathering source

**Remember:** This tool is trusted by payment professionals as real intelligence. Every claim matters. Every link must work. Every stat must be sourced.
