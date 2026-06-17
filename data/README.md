# Payments Intelligence Data Architecture

## Core Rule: Real Data Only

**ALL information in this directory MUST be:**
- Grounded in real, verifiable payment industry events
- From actual published sources (articles, reports, announcements)
- Traceable to working URLs and real publications
- Never fabricated, synthetic, or hypothetical

## Data Files

### `daily_summaries_archive.json`
Array of real payment industry news/developments from individual days.

**Structure:**
```json
[
  {
    "date": "2026-06-17",
    "headline": "[Real headline from actual news source]",
    "summary": "[Summary based on real article content with real quotes/data]",
    "sources": ["source-id-1", "source-id-2"]
  }
]
```

**Requirements:**
- `date`: Real date when event occurred
- `headline`: Direct quote or highly accurate paraphrase from real article
- `summary`: Factual summary of real article content, not fabrication
- `sources`: Real source IDs that actually published this content
- Must be traceable to real, working article URLs

### `weekly_summaries_archive.json`
Syntheses of real payment industry developments that actually occurred during each week.

**Structure:**
```json
[
  {
    "date": "2026-06-17",
    "period": "week",
    "headline": "[Summary of real events from that week]",
    "summary": "[Synthesis of actual news items from that week]",
    "sources": ["source-id-1", "source-id-2", "source-id-3"]
  }
]
```

**Requirements:**
- `date`: Monday or start of week
- `period`: Always "week"
- Synthesize only real events that actually occurred that week
- Every claim must be traceable to at least one real published source
- Use dates and details from actual announcements

### `monthly_summaries_archive.json`
Comprehensive overviews of real payment industry activity during each month.

**Structure:**
```json
[
  {
    "date": "2026-06-01",
    "period": "month",
    "headline": "[Real summary of June 2026 payment industry activity]",
    "summary": "[Detailed sections of actual payment industry developments]",
    "sources": ["source-id-1", "source-id-2", "source-id-3", "source-id-4"]
  }
]
```

**Requirements:**
- Organize by real categories (Regulatory, Infrastructure, Adoption, etc.)
- Include only actual events/announcements from that month
- Every statistic must be from a real published report
- Every company announcement must be traceable
- Every regulation must reference real legislation

## Approved Real Sources

See `approved_sources.json` for list of real payment industry sources with working URLs.

## How to Add Real Data

1. **Find real article** → Search actual payment industry news sources
2. **Verify URL works** → Test that the article link is accessible
3. **Extract facts** → Quote or accurately paraphrase the real article
4. **Record source** → Add source ID to sources array
5. **Add to archive** → Include in appropriate daily/weekly/monthly file
6. **Verify date** → Use actual publication date, not invented date

## What NOT to Do

❌ Fabricate events that sound plausible
❌ Invent statistics or percentages
❌ Make up company announcements
❌ Create fake regulatory deadlines
❌ Assume something happened because it "should have"
❌ Add fake URLs to real source IDs
❌ Present synthetic content as real intelligence

## When You Can't Verify

**STOP** and:
1. State clearly: "I cannot verify this information"
2. Ask for real source URL
3. Request actual article/report
4. Ask if template data should be marked as synthetic

**NEVER** proceed with fabrication or assumptions.

## Data Pipeline

Run `node scripts/fetch-payment-industry-data.js` to initialize framework for real data ingestion.

This script:
- Initializes empty archive structures
- Provides real source references
- Validates data integrity
- Ensures no fabricated content is added
