'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// Generate weekly summaries from daily summaries
function generateWeeklySummaries() {
  const dailyArchive = readJSON('daily_summaries_archive.json') || [];
  if (!dailyArchive.length) return [];

  const byWeek = {};
  for (const daily of dailyArchive) {
    const d = new Date(daily.date);
    const weekEnd = new Date(d);
    weekEnd.setDate(d.getDate() + (5 - d.getDay()));
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    if (!byWeek[weekEndStr]) byWeek[weekEndStr] = [];
    byWeek[weekEndStr].push(daily);
  }

  const weekly = [];
  for (const [weekEndDate, dailies] of Object.entries(byWeek).sort()) {
    const allTopics = {};
    const allLinks = new Map();

    for (const daily of dailies) {
      for (const [topic, briefData] of Object.entries(daily.briefs || {})) {
        if (!allTopics[topic]) allTopics[topic] = [];
        if (briefData.brief) allTopics[topic].push(briefData.brief);
        if (briefData.sourceLinks) {
          briefData.sourceLinks.forEach(l => allLinks.set(l.url, l));
        }
      }
    }

    const weekStart = new Date(new Date(weekEndDate).getTime() - 6 * 24 * 60 * 60 * 1000);
    const fmt = x => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const period = `Week of ${fmt(weekStart)}`;

    weekly.push({
      date: weekEndDate,
      period,
      source: 'pipeline',
      headline: `Weekly Brief: ${period}`,
      summary: `${Object.keys(allTopics).length} major topics this week: ${Object.keys(allTopics).join(', ')}. See daily briefs for full coverage.`,
      topics: allTopics,
      sourceLinks: Array.from(allLinks.values()).slice(0, 20)
    });
  }
  return weekly;
}

// Generate monthly summaries from weekly summaries
function generateMonthlySummaries(weekly) {
  const byMonth = {};
  for (const w of weekly) {
    const month = w.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(w);
  }

  const monthly = [];
  for (const [month, weeklies] of Object.entries(byMonth).sort().reverse()) {
    const allTopics = {};
    const allLinks = new Map();

    for (const w of weeklies) {
      for (const [topic, briefs] of Object.entries(w.topics || {})) {
        if (!allTopics[topic]) allTopics[topic] = [];
        allTopics[topic].push(...briefs);
      }
      if (w.sourceLinks) {
        w.sourceLinks.forEach(l => allLinks.set(l.url, l));
      }
    }

    const monthDate = new Date(month + '-01');
    const period = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    monthly.push({
      month,
      period,
      source: 'pipeline',
      headline: `${period} Instant Payments Review`,
      summary: `${weeklies.length} weeks, ${Object.keys(allTopics).length} topics. Key developments tracked across RTP, FedNow, and digital asset infrastructure.`,
      themes: Object.keys(allTopics),
      sourceLinks: Array.from(allLinks.values()).slice(0, 30)
    });
  }
  return monthly;
}

// Generate deep dives from daily briefs
function generateDeepDives() {
  const dailyArchive = readJSON('daily_summaries_archive.json') || [];

  const topics = [
    { id: 'rtp', title: 'RTP Network Developments', keywords: ['rtp', 'real-time payment'] },
    { id: 'fednow', title: 'FedNow Service Progress', keywords: ['fednow', 'federal reserve instant'] },
    { id: 'stablecoins', title: 'Stablecoins in Payment Infrastructure', keywords: ['stablecoin', 'usdc', 'usdt', 'digital asset'] },
    { id: 'crossborder', title: 'Cross-Border Payment Evolution', keywords: ['cross-border', 'international', 'swift'] },
    { id: 'regulatory', title: 'Regulatory & Compliance Developments', keywords: ['regulatory', 'compliance', 'cfpb', 'occ'] }
  ];

  const dives = [];
  for (const topic of topics) {
    const relatedBriefs = [];
    for (const daily of dailyArchive) {
      for (const [topicName, briefData] of Object.entries(daily.briefs || {})) {
        const text = `${topicName} ${briefData.brief || ''}`.toLowerCase();
        if (topic.keywords.some(kw => text.includes(kw))) {
          relatedBriefs.push({
            date: daily.date,
            topic: topicName,
            brief: briefData.brief,
            links: briefData.sourceLinks || []
          });
        }
      }
    }

    if (relatedBriefs.length) {
      const uniqueLinks = new Map();
      for (const b of relatedBriefs) {
        for (const l of b.links) {
          uniqueLinks.set(l.url, l);
        }
      }

      dives.push({
        id: topic.id,
        title: topic.title,
        published: new Date().toISOString(),
        summary: `${relatedBriefs.length} related developments tracked. Aggregates key announcements and developments related to ${topic.title.toLowerCase()}.`,
        relatedBriefs: relatedBriefs.slice(0, 15),
        sourceCount: uniqueLinks.size,
        sources: Array.from(uniqueLinks.values()).slice(0, 20)
      });
    }
  }
  return dives;
}

// Main
console.log('Backfilling archives from daily summaries...\n');

const weekly = generateWeeklySummaries();
writeJSON('weekly_summaries_archive.json', weekly);
console.log(`✓ Weekly summaries: ${weekly.length} weeks`);

const monthly = generateMonthlySummaries(weekly);
writeJSON('monthly_summaries_archive.json', monthly);
console.log(`✓ Monthly summaries: ${monthly.length} months`);

const dives = generateDeepDives();
writeJSON('deep_dives.json', dives);
console.log(`✓ Deep dives: ${dives.length} topics`);

console.log('\n✓ All archives backfilled from real daily data');
