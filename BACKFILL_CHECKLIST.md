# Backfill Verification Checklist

Use this checklist while creating daily, weekly, and monthly summaries to ensure data integrity.

---

## Before Starting

- [ ] Local Claude Code session running: `cd ~/Desktop/myClaude_myProjects/Payments && claude .`
- [ ] Network access confirmed (can scrape payment industry sites)
- [ ] `data/raw_articles/` directory populated with HTML files
- [ ] `data/parsed_articles.json` generated from parser script
- [ ] `data/approved_sources.json` reviewed for existing sources

---

## Daily Summary Creation Checklist

For **each** daily summary entry:

### Source Verification
- [ ] Article HTML file exists in `data/raw_articles/`
- [ ] Article content is readable (not corrupted, excessive markup)
- [ ] Full article text reviewed (not just snippet)
- [ ] Publication date extracted and verified accurate
- [ ] Real headline identified (not invented)

### Content Verification
- [ ] Every statistic has a source citation
- [ ] Numbers match the actual article text
- [ ] No extrapolation beyond what article states
- [ ] No invented facts or events
- [ ] No `[to be populated]`, `TODO`, `TK` placeholders
- [ ] Summary markdown is properly formatted with `## Headers`

### Source Attribution
- [ ] All referenced organizations exist in `approved_sources.json`
- [ ] Source IDs match exactly (case-sensitive)
- [ ] `sources[]` array includes all organizations mentioned
- [ ] No fake or placeholder source IDs
- [ ] If new source needed, added to `approved_sources.json` with:
  - [ ] Real organization name
  - [ ] Real working URL
  - [ ] Correct tier (1 or 2)
  - [ ] Correct category

### Date Verification
- [ ] Date is actual publication date (YYYY-MM-DD format)
- [ ] Not a future date or placeholder
- [ ] Matches article's publication metadata

---

## Weekly Summary Creation Checklist

For **each** weekly summary entry:

### Theme Verification
- [ ] Theme(s) are based on actual events from that week
- [ ] Not invented or speculative
- [ ] Themes match one of: Infrastructure, Regulation, Adoption, Cross-Border
- [ ] Each section references real daily summaries

### Content Verification
- [ ] All claims can be traced back to constituent daily summaries
- [ ] No new information beyond what daily summaries contain
- [ ] No extrapolation or synthesis beyond what events support
- [ ] Statistics are cited from daily summaries (thus already verified)
- [ ] No `[to be populated]`, `TODO`, `TK` placeholders

### Source Attribution
- [ ] `sources[]` is union of all sources from daily summaries
- [ ] All source IDs exist in `approved_sources.json`
- [ ] Not adding new sources (inherit from daily)

### Date Verification
- [ ] Date is Monday of the week (or week start)
- [ ] Week boundaries are accurate (Mon-Sun)

---

## Monthly Summary Creation Checklist

For **each** monthly summary entry:

### Theme Organization
- [ ] Organized by permanent themes:
  - [ ] Infrastructure Developments
  - [ ] Regulatory Progress
  - [ ] Adoption & Use Cases
  - [ ] Cross-Border & International
- [ ] Each theme contains only events from that month
- [ ] Not mixing months

### Content Verification
- [ ] All claims can be traced to constituent daily/weekly summaries
- [ ] No new analysis or interpretation beyond source material
- [ ] No invented trends or projections
- [ ] Statistics sourced from daily/weekly summaries
- [ ] No `[to be populated]`, `TODO`, `TK` placeholders

### Source Attribution
- [ ] `sources[]` is union of all sources from daily/weekly summaries
- [ ] All source IDs exist in `approved_sources.json`
- [ ] Not adding new sources (inherit from daily/weekly)

### Date Verification
- [ ] Date is first of month (YYYY-MM-01)
- [ ] Month range is accurate

---

## JSON Structure Verification

### Check All Daily Entries
```bash
jq '.[] | {date, headline, sources}' data/daily_summaries_archive.json
```
- [ ] Every entry has `date`, `headline`, `summary`, `sources`
- [ ] Dates are in YYYY-MM-DD format
- [ ] No duplicate dates
- [ ] Dates in reverse chronological order (newest first)

### Check All Weekly Entries
```bash
jq '.[] | select(.period=="week") | {date, headline, sources}' data/weekly_summaries_archive.json
```
- [ ] `period` field set to `"week"`
- [ ] Dates are Mondays (or week starts)
- [ ] No duplicate weeks
- [ ] In reverse chronological order

### Check All Monthly Entries
```bash
jq '.[] | select(.period=="month") | {date, headline, sources}' data/monthly_summaries_archive.json
```
- [ ] `period` field set to `"month"`
- [ ] Dates are first of month (YYYY-MM-01)
- [ ] No duplicate months
- [ ] In reverse chronological order

### Check Source IDs
```bash
jq '.[] | .sources[]' data/daily_summaries_archive.json | sort | uniq > /tmp/used_sources.txt
jq '.[].id' data/approved_sources.json | sort | uniq > /tmp/registered_sources.txt
comm -23 /tmp/used_sources.txt /tmp/registered_sources.txt
```
- [ ] No output (all used sources are registered)
- [ ] If output exists, add missing sources to `approved_sources.json`

---

## Content Integrity Verification

Run before every commit:

### No Fabricated Data
- [ ] Grep for common fake patterns:
  ```bash
  grep -r "to be populated" data/
  grep -r "TODO\|TK\|FIXME" data/
  grep -r "synthetic\|example\|template" data/ | grep -v "Template"
  ```
- [ ] All results are zero

### All Claims Sourced
- [ ] Each statistic in summaries exists in parsed article content
- [ ] Spot-check 5 random statistics:
  - [ ] Find stat in summary
  - [ ] Verify it appears in raw article HTML
  - [ ] Note the source organization

### All Dates Grounded
- [ ] Each daily entry corresponds to a real article
- [ ] Each weekly entry covers events from that week
- [ ] Each monthly entry covers events from that month
- [ ] No forward-dated entries

---

## Pre-Deployment Checklist

Before pushing to main:

### Data Files
- [ ] `data/daily_summaries_archive.json` parses without errors:
  ```bash
  node -e "console.log(require('./data/daily_summaries_archive.json').length + ' entries')"
  ```
- [ ] `data/weekly_summaries_archive.json` parses without errors
- [ ] `data/monthly_summaries_archive.json` parses without errors
- [ ] No entries marked as "fake", "example", "template", or "placeholder"

### Approved Sources
- [ ] All source IDs used are in `approved_sources.json`
- [ ] All sources have real names and real URLs
- [ ] No placeholder URLs (e.g., `https://example.com`, `https://tbd.com`)

### Git Status
- [ ] Only intended files modified:
  ```bash
  git status
  ```
  - [ ] `data/daily_summaries_archive.json`
  - [ ] `data/weekly_summaries_archive.json`
  - [ ] `data/monthly_summaries_archive.json`
  - [ ] `data/approved_sources.json` (if new sources added)
  - [ ] No unintended files

### Commit Message
- [ ] Clear description of what was added (dates, sources, themes)
- [ ] Lists real source organizations (for attribution)
- [ ] No vague messages like "update data" or "add stuff"

### Deployment
- [ ] `npm run build-public` completes without errors
- [ ] `dist/` directory updated with new data
- [ ] Local test server works: `python3 -m http.server 8000 --directory dist/`
- [ ] Live site tests pass:
  - [ ] Daily/Weekly/Monthly tabs display new entries
  - [ ] Pagination works correctly
  - [ ] Source links are clickable
  - [ ] No 404 errors in browser console
  - [ ] Markdown renders correctly
- [ ] Pushed to `main` branch
- [ ] GitHub Pages deployment triggered
- [ ] Live site at https://shan-1100.github.io/Payments/ shows new data (may take 1-2 min)

---

## Data Integrity Guardrail

**NON-NEGOTIABLE RULE:** Every piece of information MUST be:
✅ **Real** — Factually accurate, verifiable, from real-world events
✅ **Sourced** — Traceable to actual publications, official releases, documented facts
✅ **Verified** — Links point to real, working URLs; content confirmed by reading full articles
✅ **Never fabricated** — Zero tolerance for synthetic, made-up, or hypothetical content presented as real

**If you cannot verify something, DO NOT INCLUDE IT.**

See `CLAUDE.md` for full requirement.

---

## Quick Reference

| Task | Command |
|------|---------|
| Parse articles | `node scripts/parse-raw-articles.js` |
| Validate JSON | `node -e "require('./data/daily_summaries_archive.json')"` |
| Build site | `npm run build-public` |
| Test locally | `python3 -m http.server 8000 --directory dist/` |
| Check git status | `git status` |
| View summaries | `jq '.' data/daily_summaries_archive.json` |
| Count entries | `jq '.[] | select(.period=="week")' data/weekly_summaries_archive.json \| wc -l` |

---

## Success Indicators

- [ ] 60+ daily summaries (April 1 – June 17, 2026)
- [ ] 12+ weekly summaries (covering all weeks)
- [ ] 3 monthly summaries (April, May, June)
- [ ] Zero failed data integrity checks
- [ ] Live site displays all new content
- [ ] Browser shows no errors or 404s
- [ ] All source links functional

---

## Need Help?

- **Data integrity questions:** See `CLAUDE.md`
- **Architecture questions:** See `SYSTEM_PROMPT.md`
- **Backfill process questions:** See `BACKFILL_GUIDE.md`
- **Parser questions:** See `scripts/parse-raw-articles.js`
- **Gathering questions:** See `scripts/gather-payment-news.js`
