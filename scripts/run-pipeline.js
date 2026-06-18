'use strict';

const fs   = require('fs');
const path = require('path');
const { fetchAllFeeds }                                                          = require('./fetch-rss');
const { synthesizeArticle, generateTopicBriefs, generateWeeklySummary, generateMonthlySummary } = require('./synthesize');

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

  // ── 4. Generate daily topic briefs from raw RSS articles ─────────────────
  //
  // Group raw articles by publish date, synthesize into topic-grouped briefs.
  // Each brief: 2-3 sentences focused on success criteria (RTP/FedNow/Stablecoins).
  // sourceLinks show which articles informed each brief.
  //
  console.log('\n[4/4] Generating daily topic briefs...');

  // Group raw articles by their publish date (YYYY-MM-DD)
  const byDate = {};
  for (const item of rawItems) {
    const date = item.publishedAt.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  }

  const dailyArchive    = readJSON('daily_summaries_archive.json') || [];
  const newDailySummaries = [];

  for (const [date, items] of Object.entries(byDate).sort()) {
    // Overwrite any non-pipeline entry; keep existing pipeline entries as-is.
    const existingEntry = dailyArchive.find(e => e.date === date);
    if (existingEntry && existingEntry.source === 'pipeline') {
      console.log(`  Skipping ${date} — pipeline entry already exists`);
      continue;
    }

    console.log(`  Generating topic briefs for ${date} (${items.length} article${items.length !== 1 ? 's' : ''})...`);
    try {
      const briefs = await generateTopicBriefs(items, date);
      newDailySummaries.push({
        date,
        source: 'pipeline',
        briefs: briefs  // { 'RTP': { brief: '...', sourceLinks: [...] }, ... }
      });
      const topicCount = Object.keys(briefs).length;
      console.log(`  ✓ ${date}: ${topicCount} topic brief${topicCount !== 1 ? 's' : ''}`);
    } catch (err) {
      console.warn(`  ✗ ${date}: ${err.message}`);
    }
  }

  // Merge: pipeline entries replace same-date entries; keep older manual entries.
  const pipelineDates = new Set(newDailySummaries.map(s => s.date));
  const keptManual    = dailyArchive.filter(e => !pipelineDates.has(e.date));
  const updatedDaily  = [...newDailySummaries, ...keptManual]
    .sort((a, b) => b.date.localeCompare(a.date));

  writeJSON('daily_summaries_archive.json', updatedDaily);
  console.log(`  Daily archive: ${updatedDaily.length} entries (${newDailySummaries.length} new/updated)`);

  // ── 5. Weekly summary archive — backfill all weeks from daily archive ──────
  console.log('\n[5] Generating weekly summaries...');

  // Build weekly summaries from daily summaries (not just Fridays — all weeks)
  const dailyArchive  = readJSON('daily_summaries_archive.json') || [];
  const weeklyArchive = readJSON('weekly_summaries_archive.json') || [];
  const weeklySet     = new Set(weeklyArchive.map(w => w.date));

  // Group daily summaries by week (week ending date)
  const byWeek = {};
  for (const daily of dailyArchive) {
    const d = new Date(daily.date);
    const weekEnd = new Date(d);
    weekEnd.setDate(d.getDate() + (5 - d.getDay())); // Friday of that week
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    if (!byWeek[weekEndStr]) byWeek[weekEndStr] = [];
    byWeek[weekEndStr].push(daily);
  }

  const newWeeklySummaries = [];

  for (const [weekEndDate, dailies] of Object.entries(byWeek).sort()) {
    if (weeklySet.has(weekEndDate)) {
      console.log(`  Skipping week of ${weekEndDate} — already exists`);
      continue;
    }

    // Collect all items from this week's daily summaries
    const weekItems = [];
    for (const daily of dailies) {
      for (const [topic, briefData] of Object.entries(daily.briefs || {})) {
        if (briefData.sourceLinks) {
          weekItems.push(...briefData.sourceLinks);
        }
      }
    }

    if (!weekItems.length) continue;

    console.log(`  Generating weekly summary for week ending ${weekEndDate} (${dailies.length} daily summaries)...`);
    try {
      const ws = await generateWeeklySummary(merged.filter(i => {
        const itemWeekEnd = new Date(new Date(i.publishedAt).getTime() + (5 - new Date(i.publishedAt).getDay()) * 24 * 60 * 60 * 1000);
        return itemWeekEnd.toISOString().slice(0, 10) === weekEndDate;
      }));

      newWeeklySummaries.push({
        date: weekEndDate,
        period: `Week ending ${weekEndDate}`,
        source: 'pipeline',
        headline: ws.headline || 'Weekly Instant Payments Summary',
        summary: ws.summary || '',
        sourceLinks: weekItems.slice(0, 15),
        authorNote: ws.authorNote || ''
      });
    } catch (err) {
      console.warn(`  ✗ Week ${weekEndDate}: ${err.message}`);
    }
  }

  const updatedWeekly = [...newWeeklySummaries, ...weeklyArchive]
    .sort((a, b) => b.date.localeCompare(a.date));
  writeJSON('weekly_summaries_archive.json', updatedWeekly);
  console.log(`  Weekly archive: ${updatedWeekly.length} entries (${newWeeklySummaries.length} new)`);

  // ── 6. Monthly summary archive — backfill all months from weekly archive ──
  console.log('\n[6] Generating monthly summaries...');

  const monthlyArchive = readJSON('monthly_summaries_archive.json') || [];
  const monthlySet     = new Set(monthlyArchive.map(m => m.month));

  // Group weekly summaries by month
  const byMonth = {};
  for (const weekly of updatedWeekly) {
    const month = weekly.date.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(weekly);
  }

  const newMonthlySummaries = [];

  for (const [month, weeklies] of Object.entries(byMonth).sort().reverse()) {
    if (monthlySet.has(month)) {
      console.log(`  Skipping ${month} — already exists`);
      continue;
    }

    const monthItems = [];
    for (const weekly of weeklies) {
      if (weekly.sourceLinks) {
        monthItems.push(...weekly.sourceLinks);
      }
    }

    console.log(`  Generating monthly summary for ${month} (${weeklies.length} weeks)...`);
    try {
      const ms = await generateMonthlySummary(merged.filter(i => {
        const itemMonth = i.publishedAt.slice(0, 7);
        return itemMonth === month;
      }));

      newMonthlySummaries.push({
        month,
        period: new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        source: 'pipeline',
        headline: ms.headline || `${month} Instant Payments Monthly Review`,
        summary: ms.summary || '',
        themes: ms.themes || [],
        sourceLinks: monthItems.slice(0, 20),
        authorNote: ms.authorNote || ''
      });
    } catch (err) {
      console.warn(`  ✗ Month ${month}: ${err.message}`);
    }
  }

  const updatedMonthly = [...newMonthlySummaries, ...monthlyArchive]
    .sort((a, b) => b.month.localeCompare(a.month));
  writeJSON('monthly_summaries_archive.json', updatedMonthly);
  console.log(`  Monthly archive: ${updatedMonthly.length} entries (${newMonthlySummaries.length} new)`);

  const today     = new Date();
  const isFriday  = today.getDay() === 5;
  const isFirst   = today.getDate() === 1;

  if (false) { // Disabled — weekly/monthly now auto-generated from archives
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
