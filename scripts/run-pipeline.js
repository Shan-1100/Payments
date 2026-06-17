'use strict';

const fs   = require('fs');
const path = require('path');
const { fetchAllFeeds }                                    = require('./fetch-rss');
const { synthesizeArticle, generateWeeklySummary, generateMonthlySummary } = require('./synthesize');

const DATA_DIR   = path.join(__dirname, '../data');
const MAX_SYNTH  = 25; // max items to synthesize per run (cost guard)
const MAX_STORED = 300; // max items to keep in content_items.json

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function weekPeriod() {
  const now   = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 6);
  const fmt   = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `Week of ${fmt(start)} – ${fmt(now)}`;
}

function monthPeriod() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function main() {
  const args        = process.argv.slice(2);
  const forceWeekly  = args.includes('--weekly');
  const forceMonthly = args.includes('--monthly');

  console.log('=== Intelligence Pipeline ===');

  // ── 1. Fetch new raw items from all RSS feeds ─────────────────────────────
  console.log('\n[1/4] Fetching RSS feeds...');
  const rawItems = await fetchAllFeeds();
  console.log(`  Found ${rawItems.length} new relevant items`);

  // ── 2. Synthesize (up to MAX_SYNTH) ──────────────────────────────────────
  console.log(`\n[2/4] Synthesizing up to ${MAX_SYNTH} items with Claude...`);
  const existing   = readJSON('content_items.json') || [];
  const synthesized = [];

  for (const raw of rawItems.slice(0, MAX_SYNTH)) {
    try {
      console.log(`  → ${raw.title.slice(0, 70)}`);
      const s = await synthesizeArticle(raw.title, raw.rawContent, raw.sourceUrl, raw.sourceName);

      synthesized.push({
        id:                raw.id,
        sourceType:        'rss',
        sourceName:        raw.sourceName,
        sourceUrl:         raw.sourceUrl,
        sourceTier:        raw.sourceTier,
        title:             raw.title,
        summary:           s.summary || raw.rawContent.slice(0, 250),
        intelligenceType:  s.intelligenceType,
        businessImpact:    s.businessImpact,
        technicalTakeaway: s.technicalTakeaway,
        businessTakeaway:  s.businessTakeaway,
        treasuryTakeaway:  s.treasuryTakeaway,
        primaryTopic:      s.primaryTopic,
        rail:              s.rail || 'Adjacent',
        tags:              s.tags || [],
        priorityBand:      s.priorityBand || 'monitor',
        importanceScore:   s.priorityBand === 'high' ? 88 : s.priorityBand === 'medium' ? 72 : 55,
        publishedAt:       raw.publishedAt,
        collectedAt:       new Date().toISOString(),
        status:            'collected'
      });

      await sleep(350); // ~2.8 req/s — well within Haiku limits
    } catch (err) {
      console.warn(`  ✗ Skipped: ${err.message}`);
    }
  }

  console.log(`  Synthesized ${synthesized.length} items`);

  // ── 3. Merge and save ─────────────────────────────────────────────────────
  console.log('\n[3/4] Saving content_items.json...');
  const merged = [...synthesized, ...existing]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_STORED);
  writeJSON('content_items.json', merged);
  console.log(`  Total stored: ${merged.length} items`);

  // ── 4. Generate summaries ─────────────────────────────────────────────────
  const today     = new Date();
  const isFriday  = today.getDay() === 5;
  const isFirst   = today.getDate() === 1;

  if (isFriday || forceWeekly) {
    console.log('\n[4/4] Generating weekly summary...');
    const cutoff    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekItems = merged.filter(i => new Date(i.publishedAt) >= cutoff);
    if (weekItems.length) {
      try {
        const ws = await generateWeeklySummary(weekItems);
        writeJSON('weekly_summary.json', {
          period:       weekPeriod(),
          generatedAt:  today.toISOString(),
          headline:     ws.headline,
          summary:      ws.summary,
          items:        weekItems.slice(0, 10).map(i => i.id),
          authorNote:   ws.authorNote
        });
        console.log('  Weekly summary updated.');
      } catch (err) {
        console.warn('  Weekly summary failed:', err.message);
      }
    }
  }

  if (isFirst || forceMonthly) {
    console.log('\n[4/4] Generating monthly summary...');
    const cutoff     = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthItems = merged.filter(i => new Date(i.publishedAt) >= cutoff);
    if (monthItems.length) {
      try {
        const ms = await generateMonthlySummary(monthItems);
        writeJSON('monthly_summary.json', {
          period:      monthPeriod(),
          generatedAt: today.toISOString(),
          headline:    ms.headline,
          summary:     ms.summary,
          items:       monthItems.slice(0, 20).map(i => i.id),
          authorNote:  ms.authorNote
        });
        console.log('  Monthly summary updated.');
      } catch (err) {
        console.warn('  Monthly summary failed:', err.message);
      }
    }
  }

  console.log('\n=== Pipeline complete ===');
}

main().catch(err => {
  console.error('Pipeline error:', err.message);
  process.exit(1);
});
