'use strict';

const RSSParser = require('rss-parser');
const fs  = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');

const parser = new RSSParser({
  timeout: 12000,
  headers: { 'User-Agent': 'PaymentsIntel/1.0' },
  customFields: { item: ['content:encoded', 'description'] }
});

const RELEVANCE_KEYWORDS = [
  'payment', 'rtp', 'real-time', 'real time', 'fednow', 'fed now', 'ach', 'nacha',
  'treasury', 'banking', 'bank', 'fintech', 'stablecoin', 'tokenized', 'tokenization',
  'swift', 'settlement', 'fraud', 'cfpb', 'clearing', 'b2b', 'correspondent',
  'wire transfer', 'instant payment', 'digital payment', 'iso 20022',
  'cross-border', 'cross border', 'remittance', 'liquidity', 'defi', 'cbdc',
  'open banking', 'embedded finance', 'merchant', 'interchange', 'acquiring'
];

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}

function urlHash(u) {
  return crypto.createHash('md5').update(u).digest('hex').slice(0, 12);
}

function isRelevant(item) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some(kw => text.includes(kw));
}

function extractContent(item) {
  const raw = item['content:encoded'] || item.content || item.contentSnippet || item.summary || '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

async function fetchAllFeeds() {
  const approved   = readJSON('approved_sources.json') || [];
  const discovered = readJSON('discovered_sources.json') || [];
  const existing   = readJSON('content_items.json') || [];

  const existingUrls = new Set(existing.map(i => i.sourceUrl).filter(Boolean));
  const existingIds  = new Set(existing.map(i => i.id));

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const feeds = [
    ...approved.filter(s => s.rssUrl).map(s => ({ name: s.name, rssUrl: s.rssUrl, tier: s.tier })),
    ...discovered.map(s => ({ name: s.name, rssUrl: s.rssUrl, tier: s.tier || 'Tier 2' }))
  ];

  const newItems = [];

  for (const source of feeds) {
    try {
      console.log(`  Fetching: ${source.rssUrl}`);
      const feed = await parser.parseURL(source.rssUrl);

      for (const item of feed.items || []) {
        const link = item.link;
        if (!link || existingUrls.has(link)) continue;

        const pubDate = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate) : new Date();
        if (pubDate < sevenDaysAgo) continue;

        if (!isRelevant(item)) continue;

        const id = urlHash(link);
        if (existingIds.has(id)) continue;

        newItems.push({
          id,
          sourceUrl:   link,
          sourceName:  source.name,
          sourceTier:  source.tier,
          title:       (item.title || 'Untitled').trim(),
          rawContent:  extractContent(item),
          publishedAt: pubDate.toISOString()
        });
      }
    } catch (err) {
      console.warn(`  Failed: ${source.rssUrl} — ${err.message}`);
    }
  }

  return newItems;
}

async function discoverRssFromUrl(pageUrl) {
  const { hostname } = new URL(pageUrl);
  const candidates = [
    '/feed', '/feed/', '/rss', '/rss.xml', '/feed.xml', '/atom.xml',
    '/feeds/all.rss', '/feeds/posts/default', '/news/feed'
  ];

  for (const p of candidates) {
    try {
      const rssUrl = `https://${hostname}${p}`;
      await parser.parseURL(rssUrl);
      return rssUrl;
    } catch { /* try next */ }
  }

  // Fallback: look for <link type="application/rss+xml"> in the page HTML
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'PaymentsIntel/1.0' }
    });
    const html = await res.text();
    const match =
      html.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i);

    if (match) {
      const discovered = match[1].startsWith('http') ? match[1] : `https://${hostname}${match[1]}`;
      await parser.parseURL(discovered);
      return discovered;
    }
  } catch { /* discovery failed */ }

  return null;
}

module.exports = { fetchAllFeeds, discoverRssFromUrl, urlHash };
