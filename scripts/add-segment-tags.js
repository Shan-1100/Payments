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

// Classify brief by B2B/B2C segment
function classifySegment(text) {
  const segments = [];

  if (/corporate|treasury|supplier|cross.?entity|b2b|business.to.business/i.test(text)) {
    segments.push('B2B');
  }
  if (/consumer|payroll|bill pay|peer|b2c|business.to.consumer|earned wage/i.test(text)) {
    segments.push('B2C');
  }

  // Default to both if unclear
  if (segments.length === 0) {
    segments.push('B2B');
    segments.push('B2C');
  }

  return segments;
}

// Add segment tags to daily summaries
console.log('Adding B2B/B2C segment tags...');
const daily = readJSON('daily_summaries_archive.json') || [];
for (const day of daily) {
  for (const [topic, briefData] of Object.entries(day.briefs || {})) {
    briefData.segments = classifySegment(briefData.brief || '');
  }
}
writeJSON('daily_summaries_archive.json', daily);
console.log(`✓ Daily: ${daily.length} summaries tagged`);

// Add segment tags to weekly summaries
const weekly = readJSON('weekly_summaries_archive.json') || [];
for (const week of weekly) {
  for (const [topic, briefs] of Object.entries(week.topics || {})) {
    for (const brief of briefs) {
      // Store segments on brief data if possible
      if (typeof brief === 'string') {
        // Briefs are strings, so classify at topic level
        week.topicSegments = week.topicSegments || {};
        week.topicSegments[topic] = classifySegment(brief);
      }
    }
  }
}
writeJSON('weekly_summaries_archive.json', weekly);
console.log(`✓ Weekly: ${weekly.length} summaries tagged`);

// Add segment tags to monthly summaries
const monthly = readJSON('monthly_summaries_archive.json') || [];
for (const month of monthly) {
  for (const theme of month.themes || []) {
    month.themeSegments = month.themeSegments || {};
    month.themeSegments[theme] = classifySegment(theme);
  }
}
writeJSON('monthly_summaries_archive.json', monthly);
console.log(`✓ Monthly: ${monthly.length} summaries tagged`);

// Add segment tags to deep dives
const dives = readJSON('deep_dives.json') || [];
for (const dive of dives) {
  for (const brief of dive.relatedBriefs || []) {
    brief.segments = classifySegment(brief.brief || '');
  }
}
writeJSON('deep_dives.json', dives);
console.log(`✓ Deep dives: ${dives.length} topics tagged`);

console.log('\n✓ All briefs tagged with B2B/B2C segments');
