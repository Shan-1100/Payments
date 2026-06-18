'use strict';

const RSSParser = require('rss-parser');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const RESULTS_FILE = path.join(DATA_DIR, 'retrieval_validation.json');

const parser = new RSSParser({
  timeout: 12000,
  headers: { 'User-Agent': 'PaymentsIntel/1.0' },
  customFields: { item: ['content:encoded', 'description'] }
});

// List of sources marked as "Working" for RSS retrieval
const WORKING_SOURCES = [
  {
    id: 'fed-board',
    name: 'Federal Reserve Board',
    rssUrl: 'https://www.federalreserve.gov/feeds/press_all.xml',
    strategy: 'RSS',
  },
  {
    id: 'occ',
    name: 'OCC',
    rssUrl: 'https://www.occ.gov/rss/occ_news.xml',
    strategy: 'RSS',
  },
  {
    id: 'bis',
    name: 'Bank for International Settlements',
    rssUrl: 'https://www.bis.org/doclist/all_pressrels.rss',
    strategy: 'RSS',
  },
  {
    id: 'payments-dive',
    name: 'Payments Dive',
    rssUrl: 'https://www.paymentsdive.com/feeds/news/',
    strategy: 'RSS',
  },
  {
    id: 'digital-transactions',
    name: 'Digital Transactions',
    rssUrl: 'https://digitaltransactions.net/feed/',
    strategy: 'RSS',
  },
  {
    id: 'finextra',
    name: 'Finextra',
    rssUrl: 'https://www.finextra.com/rss/headlines.aspx',
    strategy: 'RSS',
  },
  {
    id: 'payments-journal',
    name: 'PaymentsJournal',
    rssUrl: 'https://www.paymentsjournal.com/feed/',
    strategy: 'RSS',
  },
  {
    id: 'tearsheet',
    name: 'Tearsheet',
    rssUrl: 'https://tearsheet.co/feed/',
    strategy: 'RSS',
  },
  {
    id: 'fintech-takes',
    name: 'Fintech Takes (Alex Johnson)',
    rssUrl: 'https://fintech-takes.substack.com/feed',
    strategy: 'RSS',
  },
  {
    id: 'dwayne-gefferie',
    name: 'Dwayne Gefferie Newsletter',
    rssUrl: 'https://dwaynegefferie.substack.com/feed',
    strategy: 'RSS',
  },
];

async function retrieveRSSContent(source) {
  try {
    console.log(`Fetching ${source.id}...`);
    const feed = await parser.parseURL(source.rssUrl);

    if (!feed.items || feed.items.length === 0) {
      return {
        source: source.id,
        name: source.name,
        rssUrl: source.rssUrl,
        strategy: source.strategy,
        status: 'no-content',
        itemsRetrieved: 0,
        articles: [],
      };
    }

    // Get first 5 articles to validate retrieval
    const articles = feed.items.slice(0, 5).map(item => ({
      title: item.title || 'N/A',
      url: item.link || 'N/A',
      pubDate: item.pubDate || 'N/A',
      description: (item.contentSnippet || item.description || '').substring(0, 500),
      contentLength: (item.content || item.contentSnippet || '').length,
      first500chars: (item.content || item.contentSnippet || '').substring(0, 500),
    }));

    return {
      source: source.id,
      name: source.name,
      rssUrl: source.rssUrl,
      strategy: source.strategy,
      status: 'success',
      itemsRetrieved: feed.items.length,
      articlesSampled: articles.length,
      articles,
    };
  } catch (error) {
    console.error(`Error fetching ${source.id}:`, error.message);
    return {
      source: source.id,
      name: source.name,
      rssUrl: source.rssUrl,
      strategy: source.strategy,
      status: 'failed',
      error: error.message,
      itemsRetrieved: 0,
      articles: [],
    };
  }
}

async function validateAllSources() {
  console.log(`Starting retrieval validation for ${WORKING_SOURCES.length} sources...\n`);

  const results = {
    timestamp: new Date().toISOString(),
    totalSourcesAttempted: WORKING_SOURCES.length,
    sources: [],
    summary: {
      totalSuccessful: 0,
      totalFailed: 0,
      totalArticlesRetrieved: 0,
    },
  };

  for (const source of WORKING_SOURCES) {
    const result = await retrieveRSSContent(source);
    results.sources.push(result);

    if (result.status === 'success') {
      results.summary.totalSuccessful++;
      results.summary.totalArticlesRetrieved += result.itemsRetrieved;
    } else {
      results.summary.totalFailed++;
    }
  }

  // Write results to file
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✓ Results saved to ${RESULTS_FILE}`);

  // Print summary
  console.log('\n=== RETRIEVAL VALIDATION SUMMARY ===');
  console.log(`Total sources attempted: ${results.totalSourcesAttempted}`);
  console.log(`Total successful: ${results.summary.totalSuccessful}`);
  console.log(`Total failed: ${results.summary.totalFailed}`);
  console.log(`Total articles retrieved: ${results.summary.totalArticlesRetrieved}`);
  console.log('\n=== DETAILED RESULTS ===\n');

  results.sources.forEach(result => {
    console.log(`[${result.status.toUpperCase()}] ${result.name} (${result.source})`);
    console.log(`  URL: ${result.rssUrl}`);
    console.log(`  Strategy: ${result.strategy}`);

    if (result.status === 'success') {
      console.log(`  Items in feed: ${result.itemsRetrieved}`);
      console.log(`  Sample articles:`);
      result.articles.forEach((article, idx) => {
        console.log(`\n    Article ${idx + 1}:`);
        console.log(`    Title: ${article.title}`);
        console.log(`    URL: ${article.url}`);
        console.log(`    Pub Date: ${article.pubDate}`);
        console.log(`    Content Length: ${article.contentLength} characters`);
        console.log(`    First 500 chars:\n      "${article.first500chars.substring(0, 250)}..."`);
      });
    } else {
      console.log(`  Error: ${result.error}`);
    }
    console.log('');
  });

  return results;
}

validateAllSources().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
