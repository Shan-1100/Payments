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

const NON_US_PATTERNS = [
  /global|international|cross.?border|worldwide/i,
  /uk|europe|emea|asia|mena|gcc|middle east|uae|asean|apac/i,
  /islamic|sharia|halal/i,
  /nymcard|oaknorth|aurionpro|ajman|checkout|payfuture|atlantic/i
];

function isUSContent(brief) {
  if (!brief) return false;
  const text = brief.toLowerCase();

  // Reject if matches non-US patterns
  if (NON_US_PATTERNS.some(p => p.test(text))) {
    return false;
  }

  // Accept if mentions US payment rails
  if (/rtp|fednow|visa direct|mastercard send|usdc|usdt|clearing house|fed payment/i.test(text)) {
    return true;
  }

  return false;
}

// Filter daily summaries
console.log('Filtering daily summaries to US-only...');
const daily = readJSON('daily_summaries_archive.json') || [];
const filteredDaily = daily.map(day => {
  if (!day.briefs) return day;

  const filteredBriefs = {};
  for (const [topic, briefData] of Object.entries(day.briefs)) {
    if (isUSContent(briefData.brief)) {
      filteredBriefs[topic] = briefData;
    }
  }

  return {
    ...day,
    briefs: filteredBriefs
  };
}).filter(day => Object.keys(day.briefs || {}).length > 0);

writeJSON('daily_summaries_archive.json', filteredDaily);
console.log(`✓ Daily: ${filteredDaily.length} entries (filtered to US-only)`);

// Regenerate weekly summaries from filtered daily
console.log('Regenerating weekly summaries from US-only daily data...');
const byWeek = {};
for (const daily of filteredDaily) {
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

  if (!Object.keys(allTopics).length) continue;

  const weekStart = new Date(new Date(weekEndDate).getTime() - 6 * 24 * 60 * 60 * 1000);
  const fmt = x => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const period = `Week of ${fmt(weekStart)}`;

  weekly.push({
    date: weekEndDate,
    period,
    source: 'pipeline',
    headline: `US Instant Payments Brief: ${period}`,
    summary: `${Object.keys(allTopics).length} topics: ${Object.keys(allTopics).join(', ')}. US RTP, FedNow, and instant payment developments.`,
    topics: allTopics,
    sourceLinks: Array.from(allLinks.values()).slice(0, 20)
  });
}

writeJSON('weekly_summaries_archive.json', weekly);
console.log(`✓ Weekly: ${weekly.length} entries regenerated`);

// Regenerate monthly summaries
console.log('Regenerating monthly summaries from US-only weekly data...');
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

  if (!Object.keys(allTopics).length) continue;

  const monthDate = new Date(month + '-01');
  const period = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  monthly.push({
    month,
    period,
    source: 'pipeline',
    headline: `${period}: US Instant Payments Review`,
    summary: `${weeklies.length} weeks of US payment rail developments. Focus: RTP adoption, FedNow deployment, instant payment infrastructure.`,
    themes: Object.keys(allTopics),
    sourceLinks: Array.from(allLinks.values()).slice(0, 30)
  });
}

writeJSON('monthly_summaries_archive.json', monthly);
console.log(`✓ Monthly: ${monthly.length} entries regenerated`);

console.log('\n✓ All archives filtered to US-only content');
