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

// PRIMARY FOCUS: US instant payments (RTP, FedNow) + adjacent rails
// SECONDARY: Global developments with direct US instant payment relevance only
const PRIMARY_KEYWORDS = [
  'rtp', 'real-time payment', 'real time payment',
  'fednow', 'fed now', 'federal reserve instant payment',
  'visa direct', 'mastercard send',
  'stablecoin', 'usdc', 'usdt',
  'instant payment', 'real-time banking'
];

// Adjacent keywords: only include if paired with US/instant payment context
const ADJACENT_KEYWORDS = [
  'clearing house', 'the clearing house',
  'fed payment', 'federal reserve payment',
  'acq rails', 'payment rail',
  'correspondent bank', 'interbank settlement',
  'b2b payment', 'b2c payment',
  'treasury payment', 'corporate payment'
];

// EXCLUDE patterns: noise that pollutes results
const EXCLUDE_PATTERNS = [
  /islamic|sharia|halal/i,           // Islamic banking (out of scope)
  /mena|gcc|middle east|uae/i,       // Regional fintech (out of scope unless US-relevant)
  /uk|emea|europe|asean/i,           // Regional unless RTP/FedNow mentioned
  /cryptography|cybersecurity/i,     // Security unrelated to payment systems
  /robotics|ai model|mlops/i,        // Unrelated tech
  /retail|ecommerce|shopping/i,      // Consumer retail unless payment-specific
  /lending|loan|credit|mortgage/i,   // Lending/credit (not payments focus)
];

function isRelevant(item) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();

  // HARD EXCLUDE: if matches exclude patterns, reject immediately
  if (EXCLUDE_PATTERNS.some(p => p.test(text))) {
    return false;
  }

  // PRIMARY (RTP, FedNow): accept if any primary keyword found
  if (PRIMARY_KEYWORDS.some(kw => text.includes(kw))) {
    return true;
  }

  // ADJACENT: only accept if paired with payment rail/instant context
  // e.g., "treasury payment" or "payment rail" combined with secondary context
  const hasAdjacent = ADJACENT_KEYWORDS.some(kw => text.includes(kw));
  const hasPaymentContext = /payment|settle|clear/i.test(text);

  if (hasAdjacent && hasPaymentContext) {
    // But reject if it's obvious noise (regional or unrelated domain)
    if (/^(uk|emea|asean|mena|middle east|uae|gcc)/i.test(text.slice(0, 100))) {
      return false;
    }
    return true;
  }

  return false;
}

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
