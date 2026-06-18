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

const dailyArchive = readJSON('daily_summaries_archive.json') || [];

// US Instant Payment Topics Only
const topics = [
  {
    id: 'rtp-adoption',
    title: 'RTP Network Adoption & Growth',
    keywords: ['rtp', 'real-time payment', 'clearing house'],
    description: 'Real-Time Payments network developments, adoption metrics, and competitive positioning'
  },
  {
    id: 'fednow-deployment',
    title: 'FedNow Service Deployment',
    keywords: ['fednow', 'federal reserve', 'fed now'],
    description: 'Federal Reserve instant payment service rollout, bank adoption, and market impact'
  },
  {
    id: 'visa-mastercard-instant',
    title: 'Visa Direct & Mastercard Send Evolution',
    keywords: ['visa direct', 'mastercard send'],
    description: 'Card networks pushing into instant B2B/B2C payments'
  },
  {
    id: 'stablecoin-payments',
    title: 'Stablecoins in US Payment Infrastructure',
    keywords: ['stablecoin', 'usdc', 'usdt'],
    description: 'USDC/USDT integration into US payment rails for B2B/B2C'
  },
  {
    id: 'us-regulatory',
    title: 'US Regulatory & Compliance Framework',
    keywords: ['cfpb', 'occ', 'federal reserve', 'regulatory', 'compliance'],
    description: 'Regulatory guidance shaping US instant payment adoption'
  }
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

  if (!relatedBriefs.length) continue;

  // Extract themes and sources
  const themes = {};
  const sources = new Set();
  const dates = [];

  for (const brief of relatedBriefs) {
    dates.push(brief.date);
    if (brief.topic) {
      if (!themes[brief.topic]) themes[brief.topic] = [];
      themes[brief.topic].push(brief.brief?.slice(0, 150) || '');
    }
    if (brief.links) {
      brief.links.forEach(l => sources.add(l.name));
    }
  }

  // Create strategic executive summary
  let executiveSummary = '';

  if (topic.id === 'rtp-adoption') {
    executiveSummary = `RTP network showing momentum in adoption. ${relatedBriefs.length} developments tracked spanning ${Object.keys(themes).length} categories. Key insight: Real-time settlement eliminates fraud exposure delays inherent in batch-based ACH processing. Competitive positioning: RTP competes directly with card networks (Visa Direct, Mastercard Send) and stablecoins on speed and cost. Tracked by: ${Array.from(sources).slice(0, 3).join(', ')}.`;
  } else if (topic.id === 'fednow-deployment') {
    executiveSummary = `FedNow Service (Federal Reserve 24/7 instant payment rail) deployment accelerating. ${relatedBriefs.length} announcements across ${Object.keys(themes).length} categories. Strategic impact: Federal infrastructure directly competes with private payment networks. Bank adoption drives standardization and interoperability. Market implications: Regulatory backing gives FedNow distribution advantage vs. proprietary networks. Sources: ${Array.from(sources).slice(0, 3).join(', ')}.`;
  } else if (topic.id === 'visa-mastercard-instant') {
    executiveSummary = `Card networks (Visa Direct, Mastercard Send) expanding into instant B2B/B2C payments. ${relatedBriefs.length} developments show competitive feature launches. Strategic threat: Card networks leveraging existing merchant infrastructure to capture instant payment flow. Opportunity: Legacy payments infrastructure modernizing to compete with emerging rails. Covered by: ${Array.from(sources).slice(0, 3).join(', ')}.`;
  } else if (topic.id === 'stablecoin-payments') {
    executiveSummary = `Stablecoins (USDC, USDT) gaining traction in US B2B/B2C payment flows. ${relatedBriefs.length} developments show enterprise adoption drivers. Competitive dynamic: Stablecoins offer instant settlement + lower cost vs. traditional rails. Regulatory gap: Federal clarity on stablecoin payments infrastructure still emerging. Key sources: ${Array.from(sources).slice(0, 3).join(', ')}.`;
  } else if (topic.id === 'us-regulatory') {
    executiveSummary = `US regulatory landscape (CFPB, OCC, Federal Reserve) actively shaping instant payment adoption. ${relatedBriefs.length} policy/compliance developments. Impact: Regulatory guidance directly affects bank investment in RTP, FedNow, and instant payment infrastructure. Timeline: Compliance requirements drive adoption roadmaps for institutions. Monitored by: ${Array.from(sources).slice(0, 3).join(', ')}.`;
  }

  dives.push({
    id: topic.id,
    title: topic.title,
    published: new Date().toISOString(),
    summary: executiveSummary,
    themes: Object.keys(themes),
    sourceList: Array.from(sources),
    dateRange: {
      earliest: dates.sort()[0],
      latest: dates.sort().reverse()[0],
      count: relatedBriefs.length
    },
    relatedBriefs: relatedBriefs.slice(0, 15),
    sources: Array.from(sources).map(s => ({ name: s }))
  });
}

writeJSON('deep_dives.json', dives);
console.log(`✓ Deep dives regenerated: ${dives.length} US instant payment topics`);
dives.forEach(d => console.log(`  - ${d.title} (${d.dateRange.count} developments)`));
