'use strict';

const fs   = require('fs');
const path = require('path');
const { fetchAllFeeds }                                                          = require('./fetch-rss');
const { synthesizeArticle, generateDailySummary, generateWeeklySummary, generateMonthlySummary } = require('./synthesize');

const DATA_DIR   = path.join(__dirname, '../data');
const MAX_SYNTH  = 25;
const MAX_STORED = 300;

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function weekEndDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function weekStartDate(d = new Date()) {
  const s = new Date(d);
  s.setDate(d.getDate() - 6);
  return s.toISOString().slice(0, 10);
}

function weekLabel(d = new Date()) {
  const fmt = x => x.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const start = new Date(d); start.setDate(d.getDate() - 6);
  return `Week of ${fmt(start)} – ${fmt(d)}`;
}

function monthLabel(d = new Date()) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function monthDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Build sourceLinks array from synthesized items — the core attribution guarantee.
// Every link is a real article that was fetched from an RSS feed on its published date.
function toSourceLinks(items) {
  return items.map(i => ({
    name:        i.sourceName,
    title:       i.title,
    url:         i.sourceUrl,
    publishedAt: i.publishedAt
  }));
}

async function main() {
  const args         = process.argv.slice(2);
  const forceWeekly  = args.includes('--weekly');
  const forceMonthly = args.includes('--monthly');

  console.log('=== Intelligence Pipeline ===');

  // ── 1. Fetch new raw items from all RSS feeds ─────────────────────────────
  console.log('\n[1/4] Fetching RSS feeds...');
  const rawItems = await fetchAllFeeds();
  console.log(`  Found ${rawItems.length} new relevant items`);

  if (rawItems.length === 0) {
    console.log('  Nothing new — exiting early.');
    return;
  }

  // ── 2. Synthesize (up to MAX_SYNTH) ──────────────────────────────────────
  console.log(`\n[2/4] Synthesizing up to ${MAX_SYNTH} items with Claude...`);
  const existing    = readJSON('content_items.json') || [];
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

      await sleep(350);
    } catch (err) {
      console.warn(`  ✗ Skipped: ${err.message}`);
    }
  }

  console.log(`  Synthesized ${synthesized.length} items`);

  // ── 3. Merge and save content_items.json ─────────────────────────────────
  console.log('\n[3/4] Saving content_items.json...');
  const merged = [...synthesized, ...existing]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_STORED);
  writeJSON('content_items.json', merged);
  console.log(`  Total stored: ${merged.length} items`);

  // ── 4. Generate daily summaries — article-first approach ─────────────────
  //
  // Each daily summary is generated from the articles published on that date.
  // sourceLinks is populated mechanically from those exact articles — no manual
  // curation, no static approved_sources lookup. Attribution is structurally
  // correct: the link goes to the article that was actually read.
  //
  console.log('\n[4/4] Generating daily summaries from article groups...');

  // Group synthesized items by their publish date (YYYY-MM-DD)
  const byDate = {};
  for (const item of synthesized) {
    const date = item.publishedAt.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  }

  const dailyArchive    = readJSON('daily_summaries_archive.json') || [];
  const existingDates   = new Set(dailyArchive.map(s => s.date));
  const newDailySummaries = [];

  for (const [date, items] of Object.entries(byDate).sort()) {
    // Overwrite any non-pipeline entry so pipeline-generated (article-first)
    // summaries replace manually curated ones as soon as real articles exist.
    const existingEntry = dailyArchive.find(e => e.date === date);
    if (existingEntry && existingEntry.source === 'pipeline') {
      console.log(`  Skipping ${date} — pipeline entry already exists`);
      continue;
    }

    console.log(`  Generating summary for ${date} (${items.length} article${items.length !== 1 ? 's' : ''})...`);
    try {
      const ds = await generateDailySummary(items, date);
      newDailySummaries.push({
        date,
        source:      'pipeline',
        headline:    ds.headline,
        summary:     ds.summary,
        sourceLinks: toSourceLinks(items)
      });
      console.log(`  ✓ ${date}: ${ds.headline.slice(0, 70)}`);
    } catch (err) {
      console.warn(`  ✗ ${date}: ${err.message}`);
    }
  }

  // Merge: pipeline entries replace same-date manual entries; keep manual
  // entries for dates the pipeline has no articles for.
  const pipelineDates = new Set(newDailySummaries.map(s => s.date));
  const keptManual    = dailyArchive.filter(e => !pipelineDates.has(e.date));
  const updatedDaily  = [...newDailySummaries, ...keptManual]
    .sort((a, b) => b.date.localeCompare(a.date));

  writeJSON('daily_summaries_archive.json', updatedDaily);
  console.log(`  Daily archive: ${updatedDaily.length} entries (${newDailySummaries.length} new/updated)`);

  // ── 5. Weekly summary archive ─────────────────────────────────────────────
  const today     = new Date();
  const isFriday  = today.getDay() === 5;
  const isFirst   = today.getDate() === 1;

  if (isFriday || forceWeekly) {
    console.log('\n[5a] Generating weekly summary...');
    const cutoff    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekItems = merged.filter(i => new Date(i.publishedAt) >= cutoff);

    if (weekItems.length) {
      try {
        const ws           = await generateWeeklySummary(weekItems);
        const weeklyEntry  = {
          date:        weekEndDate(today),
          period:      weekLabel(today),
          source:      'pipeline',
          headline:    ws.headline,
          summary:     ws.summary,
          sourceLinks: toSourceLinks(weekItems.slice(0, 15)),
          authorNote:  ws.authorNote
        };

        const weeklyArchive = readJSON('weekly_summaries_archive.json') || [];
        const filtered      = weeklyArchive.filter(e => e.date !== weeklyEntry.date);
        const updated       = [weeklyEntry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
        writeJSON('weekly_summaries_archive.json', updated);
        writeJSON('weekly_summary.json', weeklyEntry);
        console.log('  Weekly summary updated.');
      } catch (err) {
        console.warn('  Weekly summary failed:', err.message);
      }
    }
  }

  // ── 5b. Monthly summary archive ───────────────────────────────────────────
  if (isFirst || forceMonthly) {
    console.log('\n[5b] Generating monthly summary...');
    const cutoff      = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthItems  = merged.filter(i => new Date(i.publishedAt) >= cutoff);

    if (monthItems.length) {
      try {
        const ms           = await generateMonthlySummary(monthItems);
        const monthlyEntry = {
          date:        monthDate(today),
          period:      monthLabel(today),
          source:      'pipeline',
          headline:    ms.headline,
          summary:     ms.summary,
          sourceLinks: toSourceLinks(monthItems.slice(0, 20)),
          authorNote:  ms.authorNote
        };

        const monthlyArchive = readJSON('monthly_summaries_archive.json') || [];
        const filtered       = monthlyArchive.filter(e => e.date !== monthlyEntry.date);
        const updated        = [monthlyEntry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
        writeJSON('monthly_summaries_archive.json', updated);
        writeJSON('monthly_summary.json', monthlyEntry);
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
