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

// Generate executive summaries for deep dives
const dives = readJSON('deep_dives.json') || [];

for (const dive of dives) {
  if (!dive.relatedBriefs || !dive.relatedBriefs.length) continue;

  // Extract key themes from the briefs
  const themes = {};
  const sources = new Set();
  const dates = [];

  for (const brief of dive.relatedBriefs) {
    dates.push(brief.date);
    if (brief.topic) {
      if (!themes[brief.topic]) themes[brief.topic] = [];
      themes[brief.topic].push(brief.brief?.slice(0, 200) || '');
    }
    if (brief.links) {
      brief.links.forEach(l => sources.add(l.name));
    }
  }

  // Create strategic summary based on content
  let executiveSummary = '';

  if (dive.id === 'rtp') {
    executiveSummary = `RTP network showing strong adoption momentum. Key developments: ${Object.keys(themes).join(', ')}. Recent activity spans ${Object.keys(themes).length} categories with ${dive.relatedBriefs.length} tracked announcements. Competitive advantage: Real-time settlement eliminates fraud exposure delays compared to traditional ACH. Sources: ${Array.from(sources).join(', ')}.`;
  } else if (dive.id === 'fednow') {
    executiveSummary = `FedNow Service deployment accelerating. ${dive.relatedBriefs.length} developments tracked including ${Object.keys(themes).join(', ')}. Market implications: Federal Reserve's 24/7 instant payment rail competes directly with private rails and international real-time systems. Coverage: ${Array.from(sources).join(', ')}.`;
  } else if (dive.id === 'stablecoins') {
    executiveSummary = `Stablecoin payment infrastructure evolving. ${dive.relatedBriefs.length} developments across ${Object.keys(themes).join(', ')}. Strategic impact: USDC/USDT integration into B2B/B2C flows signals enterprise adoption. Regulatory clarity needed for scale. Key sources: ${Array.from(sources).join(', ')}.`;
  } else if (dive.id === 'crossborder') {
    executiveSummary = `Cross-border payment rails consolidating. ${dive.relatedBriefs.length} announcements show partnerships and platform expansion in ${Object.keys(themes).join(', ')}. Competitive pressure: Global vendors (Stripe, Adyen, Wise) competing with traditional banks on speed and cost. Tracked by: ${Array.from(sources).join(', ')}.`;
  } else if (dive.id === 'regulatory') {
    executiveSummary = `Regulatory landscape shifting rapidly. ${dive.relatedBriefs.length} compliance and policy developments tracked. Topics: ${Object.keys(themes).join(', ')}. Impact: CFPB, OCC, Federal Reserve guidance directly shapes instant payment adoption and enterprise payment strategy. Monitored sources: ${Array.from(sources).join(', ')}.`;
  }

  // Update the dive with better summary
  dive.summary = executiveSummary;
  dive.themes = Object.keys(themes);
  dive.sourceList = Array.from(sources);
  dive.dateRange = {
    earliest: dates.sort()[0],
    latest: dates.sort().reverse()[0],
    count: dive.relatedBriefs.length
  };
}

writeJSON('deep_dives.json', dives);
console.log('✓ Deep dive summaries updated for executive consumption');
