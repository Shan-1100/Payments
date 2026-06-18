# Quick Start: Backfill Payment Industry Intelligence (April–June 2026)

## 🎯 Mission
Populate the Instant Payments Intelligence Aggregator with REAL, VERIFIED payment industry news from April–June 2026.

**Success = 60+ daily + 12+ weekly + 3 monthly verified summaries**

---

## ⚡ 5-Step Process

### Step 1: Gather Raw Articles (Local Session)
```bash
# Must be in local Claude Code session with unrestricted network
cd ~/Desktop/myClaude_myProjects/Payments
node scripts/gather-payment-news.js
```
**Output:** Raw HTML files in `data/raw_articles/` + metadata in `gathered_articles.json`

### Step 2: Parse Article Content
```bash
node scripts/parse-raw-articles.js
```
**Output:** `data/parsed_articles.json` with extracted headlines, dates, statistics, snippets

### Step 3: Create Daily Summaries
For each article in `parsed_articles.json`:
1. Open the raw HTML file from `data/raw_articles/`
2. Read the FULL article
3. Create entry in `daily_summaries_archive.json` with:
   - Real publication date (YYYY-MM-DD)
   - Accurate headline from article
   - Summary with `## Section` headers
   - Real facts/stats with source citations
   - Source IDs from `approved_sources.json`

**Continue until:** 60+ daily summaries (April 1 – June 17, 2026)

### Step 4: Create Weekly Summaries
For each week (Monday–Sunday):
1. Review daily summaries for that week
2. Identify theme(s): Infrastructure, Regulation, Adoption, Cross-Border
3. Write weekly entry synthesizing real events
4. Reference only what daily summaries contain
5. Add to `weekly_summaries_archive.json`

**Continue until:** 12+ weekly summaries (April–June 2026)

### Step 5: Create Monthly Summaries
For each month (April, May, June):
1. Review daily + weekly summaries
2. Organize by permanent themes (see checklist)
3. Write monthly entry synthesizing month's events
4. Add to `monthly_summaries_archive.json`

**Result:** 3 monthly summaries

---

## 📋 Key Files

| File | Purpose |
|------|---------|
| `SYSTEM_PROMPT.md` | Complete architecture & ideal state specification |
| `BACKFILL_GUIDE.md` | Detailed 6-phase backfill process (start here after quickstart) |
| `BACKFILL_CHECKLIST.md` | Use during backfill to ensure data integrity |
| `CLAUDE.md` | Non-negotiable data integrity requirement (read first) |
| `scripts/gather-payment-news.js` | Scrape articles from payment industry sites |
| `scripts/parse-raw-articles.js` | Extract headlines, dates, stats from raw HTML |
| `data/approved_sources.json` | 77-org source registry (add new sources as needed) |
| `data/daily_summaries_archive.json` | Populate this (60+ entries) |
| `data/weekly_summaries_archive.json` | Populate this (12+ entries) |
| `data/monthly_summaries_archive.json` | Populate this (3 entries) |

---

## ✅ Data Integrity Rules (NON-NEGOTIABLE)

**CRITICAL:** Every claim must be:
- ✅ **Real** — From actual payment industry events
- ✅ **Sourced** — Traceable to real articles/reports
- ✅ **Verified** — You read the full article (not just snippet)
- ✅ **Never fabricated** — Zero invented data, statistics, or events

**If you cannot verify it → DO NOT INCLUDE IT**

See `CLAUDE.md` for full requirement.

---

## 🚀 Quick Commands

```bash
# Parse articles
node scripts/parse-raw-articles.js

# Validate JSON
node -e "require('./data/daily_summaries_archive.json')"

# Build public site
npm run build-public

# Test locally
python3 -m http.server 8000 --directory dist/

# Check git status
git status

# View summaries
jq '.' data/daily_summaries_archive.json

# Count weekly entries
jq '.[] | select(.period=="week")' data/weekly_summaries_archive.json | wc -l
```

---

## 📊 Success Criteria

| Metric | Target |
|--------|--------|
| Daily summaries | 60+ (April 1 – June 17, 2026) |
| Weekly summaries | 12+ (organized by theme) |
| Monthly summaries | 3 (April, May, June 2026) |
| All verified | 100% (read full articles) |
| Zero fake data | 100% (no fabricated content) |
| Live site working | 100% (tabs, pagination, links) |

---

## 🔍 Verification

Before each commit, run:
```bash
# Check JSON validity
node -e "console.log(require('./data/daily_summaries_archive.json').length)"
node -e "console.log(require('./data/weekly_summaries_archive.json').length)"
node -e "console.log(require('./data/monthly_summaries_archive.json').length)"

# Check all sources are registered
jq '.[] | .sources[]' data/daily_summaries_archive.json | sort | uniq | while read s; do
  if ! jq -e ".[] | select(.id==\"$s\")" data/approved_sources.json > /dev/null; then
    echo "MISSING SOURCE: $s"
  fi
done
```

---

## 📚 Read First

1. **CLAUDE.md** — Data integrity requirement (2 min)
2. **SYSTEM_PROMPT.md** — Architecture overview (5 min)
3. **BACKFILL_GUIDE.md** — Detailed process (10 min)
4. **BACKFILL_CHECKLIST.md** — Use during work (reference)

---

## 🎬 Let's Go

1. Open local session: `cd ~/Desktop/myClaude_myProjects/Payments && claude .`
2. Run: `node scripts/gather-payment-news.js`
3. Run: `node scripts/parse-raw-articles.js`
4. Read `BACKFILL_GUIDE.md` for detailed next steps
5. Use `BACKFILL_CHECKLIST.md` while creating summaries
6. Follow the 6-phase process
7. Test and deploy

**Estimated time:** 4–6 hours for complete backfill (April–June)

---

## ❓ Common Questions

**Q: Do I need to be online?**
A: Yes, you need network access to scrape articles. Use local Claude Code session with unrestricted access.

**Q: What if I can't find articles for a date?**
A: Only create summaries for dates where real articles exist. Leave empty dates without entries.

**Q: Can I use search snippets instead of full articles?**
A: No. Read the complete article. Mark as "snippet-sourced" only if you cannot open the full source.

**Q: What if an article is behind a paywall?**
A: Use the email newsletter fallback method (see BACKFILL_GUIDE.md) or skip if unavailable.

**Q: Do I need to add new sources?**
A: Only if you find articles from organizations not in `approved_sources.json`. Add them with real names + URLs.

**Q: How do I know if my summaries are good?**
A: Use BACKFILL_CHECKLIST.md. Every claim should trace back to the article.

**Q: Can I make up data to fill gaps?**
A: **NO.** This is the core requirement. Read CLAUDE.md. If data doesn't exist, leave it empty.

---

## 📞 Get Help

- **Architecture questions:** SYSTEM_PROMPT.md
- **Process questions:** BACKFILL_GUIDE.md
- **Data integrity questions:** CLAUDE.md
- **Verification questions:** BACKFILL_CHECKLIST.md
- **Technical questions:** See script source code + comments

---

**Remember:** This tool is trusted by payment professionals. Every claim matters. Every link must work. Every stat must be sourced.

**Good luck! 🚀**
