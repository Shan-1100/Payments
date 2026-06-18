'use strict';

/**
 * RSS Attribution Pass — no Claude API required.
 *
 * Fetches all RSS feeds, groups articles by their real publication date,
 * and writes daily_summaries_archive.json entries where sourceLinks is
 * populated from the exact articles published on each date.
 *
 * This is the attribution guarantee: every link in sourceLinks is a real
 * article fetched from an RSS feed, timestamped by the feed itself.
 *
 * When run with ANTHROPIC_API_KEY set, the full pipeline (npm run pipeline)
 * will replace these stubs with AI-synthesised narratives while keeping
 * the same sourceLinks intact.
 */

const fs   = require('fs');
const path = require('path');
const { fetchAllFeeds } = require('./fetch-rss');

const DATA_DIR = path.join(__dirname, '../data');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// Score an article for "lead story" selection: prefer high-value rails and
// sources, and penalise short titles that are likely navigation fragments.
const RAIL_KEYWORDS = {
  high: ['rtp', 'fednow', 'fed now', 'real-time', 'real time', 'instant payment', 'stablecoin', 'genius act', 'iso 20022'],
  mid:  ['swift', 'nacha', 'ach', 'visa direct', 'mastercard send', 'cbdc', 'cross-border', 'b2b payment', 'treasury'],
};
function scoreArticle(item) {
  const text = `${item.title} ${item.rawContent || ''}`.toLowerCase();
  let score = item.title.length > 30 ? 10 : 0;
  RAIL_KEYWORDS.high.forEach(kw => { if (text.includes(kw)) score += 20; });
  RAIL_KEYWORDS.mid.forEach(kw  => { if (text.includes(kw)) score += 10; });
  if (item.sourceTier === 'Tier 1') score += 5;
  return score;
}

// Format a clean bullet-list summary from raw RSS items — no AI needed.
function buildSummaryText(items) {
  const lines = items.map(i => {
    const snippet = (i.rawContent || '').slice(0, 160).replace(/\s+/g, ' ').trim();
    return `**${i.sourceName}** — ${i.title}${snippet ? `\n${snippet}` : ''}`;
  });
  return lines.join('\n\n');
}

async function main() {
  console.log('=== RSS Attribution Pass ===');
  console.log('[1/3] Fetching RSS feeds...');

  const raw = await fetchAllFeeds();
  console.log(`  Retrieved ${raw.length} new relevant articles`);

  if (!raw.length) {
    console.log('  Nothing new — archive unchanged.');
    return;
  }

  // ── Group by publication date ─────────────────────────────────────────────
  console.log('[2/3] Grouping by publication date...');
  const byDate = {};
  for (const item of raw) {
    const date = item.publishedAt.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  }

  const dates = Object.keys(byDate).sort().reverse();
  console.log(`  Dates with articles: ${dates.join(', ')}`);

  // ── Build attributed daily summary entries ────────────────────────────────
  console.log('[3/3] Writing attributed daily summaries...');

  const archive      = readJSON('daily_summaries_archive.json') || [];
  const newEntries   = [];

  for (const date of dates) {
    const items = byDate[date];

    // Skip only if a pipeline (AI-synthesised) entry already exists for this date.
    // Always overwrite rss-attributed or manual entries with fresh RSS data.
    const existing = archive.find(e => e.date === date);
    if (existing && existing.source === 'pipeline') {
      console.log(`  Skipping ${date} — pipeline entry exists`);
      continue;
    }

    // Select the lead story by score
    const scored  = items.slice().sort((a, b) => scoreArticle(b) - scoreArticle(a));
    const lead    = scored[0];
    const headline = lead.title;

    const entry = {
      date,
      source:      'rss-attributed',
      headline,
      summary:     buildSummaryText(scored),
      sourceLinks: items
        .sort((a, b) => scoreArticle(b) - scoreArticle(a))
        .map(i => ({
          name:        i.sourceName,
          title:       i.title,
          url:         i.sourceUrl,
          publishedAt: i.publishedAt
        }))
    };

    newEntries.push(entry);
    console.log(`  ✓ ${date}: ${headline.slice(0, 70)} (${items.length} sources)`);
  }

  // Merge: new RSS entries replace manual/rss-attributed; keep pipeline entries untouched.
  const newDates  = new Set(newEntries.map(e => e.date));
  const kept      = archive.filter(e => !newDates.has(e.date));
  const updated   = [...newEntries, ...kept].sort((a, b) => b.date.localeCompare(a.date));

  writeJSON('daily_summaries_archive.json', updated);
  console.log(`\n  Archive: ${updated.length} total entries (${newEntries.length} new/updated)`);
  console.log('=== Attribution pass complete ===');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
