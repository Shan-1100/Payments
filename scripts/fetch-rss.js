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

// FOCUS: US Instant Payments ONLY
// No global/international content at this time
const US_KEYWORDS = [
  'rtp', 'real-time payment', 'real time payment',
  'fednow', 'fed now', 'federal reserve',
  'visa direct', 'mastercard send',
  'clearing house', 'the clearing house',
  'us bank', 'american bank', 'united states payment'
];

// US-specific payment context
const US_CONTEXT_KEYWORDS = [
  'stablecoin', 'usdc', 'usdt',
  'instant payment', 'real-time',
  'b2b payment', 'b2c payment',
  'treasury', 'corporate payment',
  'ach', 'nacha', 'fedwire'
];

// HARD EXCLUDE: Non-US and irrelevant content
const EXCLUDE_PATTERNS = [
  /global|international|cross.?border|worldwide/i,  // Global content
  /uk|europe|emea|asia|mena|gcc|middle east|uae|asean|apac/i,  // Non-US regions
  /islamic|sharia|halal/i,           // Religious banking
  /cryptography|blockchain|crypto|defi|nft/i,       // Unrelated crypto
  /robotics|ai model|mlops|machine learning/i,      // Unrelated tech
  /retail|ecommerce|shopping|consumer goods/i,      // Consumer retail
  /lending|loan|mortgage|credit card/i,             // Lending products
  /insurance|wealth|brokerage/i,                    // Unrelated financial services
  /cybersecurity|ransomware|breach|hack/i,          // Security incidents
];

function isRelevant(item) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();

  // HARD EXCLUDE: reject non-US and irrelevant content immediately
  if (EXCLUDE_PATTERNS.some(p => p.test(text))) {
    return false;
  }

  // ACCEPT: Must have US instant payment keywords
  const hasUSKeyword = US_KEYWORDS.some(kw => text.includes(kw));
  if (!hasUSKeyword) {
    return false;
  }

  // ACCEPT: If has US keyword + payment context, include it
  const hasPaymentContext = US_CONTEXT_KEYWORDS.some(kw => text.includes(kw));
  if (hasPaymentContext) {
    return true;
  }

  // ACCEPT: If has US keyword alone (RTP, FedNow, etc.), include it
  return true;
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}

function urlHash(u) {
  return crypto.createHash('md5').update(u).digest('hex').slice(0, 12);
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

  const now          = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // URL patterns that indicate event/webinar promotions rather than news articles
  const EVENT_URL_PATTERNS = ['/event-info/', '/events/', '/webinar/', '/conference/'];

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
        if (pubDate > now) continue; // exclude future-dated event announcements

        // Skip event/webinar promotion pages
        if (EVENT_URL_PATTERNS.some(p => link.includes(p))) continue;

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
