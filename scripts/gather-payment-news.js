#!/usr/bin/env node

/**
 * Multi-Method Payment Industry News Gathering System
 *
 * Fallback chain:
 * 1. Web scraping (curl with User-Agent)
 * 2. Newsletter subscriptions via temporary email
 * 3. RSS feeds
 * 4. Manual content input
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Curated list of real payment news sources with fallback methods
const NEWS_SOURCES = [
  {
    name: "PYMNTS.com",
    id: "pymnts",
    urls: [
      "https://www.pymnts.com/real-time-payments/2026/rtp-network-logs-record-single-day-transactions-of-8-6-billion/",
      "https://www.pymnts.com/news/faster-payments/2026/fednow-service-fortifies-security-for-instant-payments/",
    ],
    rssUrl: "https://www.pymnts.com/feed/",
    newsletter: "newsletters@pymnts.com",
    method: "scrape" // primary method
  },
  {
    name: "Payments Dive",
    id: "payments-dive",
    urls: [
      "https://www.paymentsdive.com/news/clearing-house-rtp-real-time-payments-network/721105/",
    ],
    rssUrl: "https://www.paymentsdive.com/feeds/news/",
    newsletter: "newsletters@paymentsdive.com",
    method: "rss" // RSS as fallback
  },
  {
    name: "American Banker",
    id: "american-banker",
    urls: [
      "https://www.americanbanker.com/payments/news/swift-pushes-new-framework-for-retail-cross-border-payments",
    ],
    rssUrl: "https://www.americanbanker.com/feed",
    method: "scrape"
  },
  {
    name: "The Clearing House",
    id: "clearing-house",
    urls: [
      "https://www.theclearinghouse.org/payment-systems/Articles/2026/05/RTP-Network-Marks-May-Day-with-Record-Breaking-Volume-and-Value",
    ],
    rssUrl: "https://www.theclearinghouse.org/rss",
    method: "scrape"
  },
  {
    name: "FedNow Service",
    id: "fednow",
    urls: [
      "https://explore.fednow.org/explore-the-city?id=3&postId=112&postTitle=welcome-to-the-fednow-service-%E2%80%93-q1-2026",
    ],
    rssUrl: "https://explore.fednow.org/feed",
    method: "scrape"
  },
  {
    name: "Federal Reserve Board",
    id: "fed-board",
    urls: [
      "https://www.federalreserve.gov/newsevents/pressreleases/other20260408a.htm",
    ],
    rssUrl: "https://www.federalreserve.gov/feeds/press_all.xml",
    method: "scrape"
  },
  {
    name: "OCC",
    id: "occ",
    urls: [
      "https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-9.html",
    ],
    rssUrl: "https://www.occ.gov/news-issuances/news-releases/feed.xml",
    method: "scrape"
  }
];

/**
 * Method 1: Web Scraping
 * Attempts to fetch article using curl with realistic User-Agent
 */
async function scrapeArticle(url) {
  try {
    console.log(`[SCRAPE] Attempting: ${url}`);
    const result = execSync(
      `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${url}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(`[SUCCESS] Scraped ${url.substring(0, 50)}...`);
    return { success: true, content: result, method: "scrape" };
  } catch (error) {
    console.log(`[FAILED] Scrape error: ${error.message.substring(0, 100)}`);
    return { success: false, method: "scrape" };
  }
}

/**
 * Method 2: RSS Feed
 * Fetches RSS feed and extracts latest articles
 */
async function fetchRSSFeed(rssUrl, sourceId) {
  try {
    console.log(`[RSS] Attempting: ${rssUrl}`);
    const result = execSync(
      `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${rssUrl}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(`[SUCCESS] Got RSS feed for ${sourceId}`);
    return { success: true, content: result, method: "rss", sourceId };
  } catch (error) {
    console.log(`[FAILED] RSS error for ${sourceId}: ${error.message.substring(0, 80)}`);
    return { success: false, method: "rss" };
  }
}

/**
 * Method 3: Newsletter Subscription
 * Records newsletter addresses for manual subscription
 * Future: can integrate with email APIs (Mailtrap, 10minutemail, etc.)
 */
function recordNewsletterSubscription(source) {
  const newsletterLog = path.join(DATA_DIR, 'newsletter_subscriptions.json');
  let newsletters = [];

  if (fs.existsSync(newsletterLog)) {
    newsletters = JSON.parse(fs.readFileSync(newsletterLog, 'utf8'));
  }

  if (!newsletters.find(n => n.id === source.id)) {
    newsletters.push({
      id: source.id,
      name: source.name,
      newsletter: source.newsletter,
      subscribedAt: new Date().toISOString(),
      status: "pending_subscription",
      notes: "Subscribe to newsletter and forward content to temp email service"
    });
    fs.writeFileSync(newsletterLog, JSON.stringify(newsletters, null, 2));
    console.log(`[NEWSLETTER] Recorded: ${source.name} (${source.newsletter})`);
  }

  return { success: false, method: "newsletter", action: "manual_subscription_needed" };
}

/**
 * Method 4: Manual Content Input
 * Logs sources that need manual content gathering
 */
function recordManualInput(url, reason) {
  const manualLog = path.join(DATA_DIR, 'manual_content_needed.json');
  let entries = [];

  if (fs.existsSync(manualLog)) {
    entries = JSON.parse(fs.readFileSync(manualLog, 'utf8'));
  }

  entries.push({
    url,
    reason,
    createdAt: new Date().toISOString(),
    status: "needs_manual_review"
  });

  fs.writeFileSync(manualLog, JSON.stringify(entries, null, 2));
  console.log(`[MANUAL] Recorded: ${url.substring(0, 60)}... (${reason})`);
  return { success: false, method: "manual", action: "manual_content_needed" };
}

/**
 * Save scraped article content to disk
 */
function saveArticleContent(source, url, content) {
  const articlesDir = path.join(DATA_DIR, 'raw_articles');
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }

  const timestamp = Date.now();
  const filename = `${source.id}_${timestamp}.html`;
  const filepath = path.join(articlesDir, filename);

  fs.writeFileSync(filepath, content);
  console.log(`[SAVED] Content saved to: raw_articles/${filename}`);
  return filepath;
}

/**
 * Multi-method fallback chain for a single article
 */
async function gatherArticleContent(url, source) {
  console.log(`\n--- Gathering: ${url.substring(0, 60)}... ---`);

  // Method 1: Try web scraping
  const scrapeResult = await scrapeArticle(url);
  if (scrapeResult.success && scrapeResult.content.length > 500) {
    scrapeResult.savedPath = saveArticleContent(source, url, scrapeResult.content);
    return scrapeResult;
  }

  console.log(`[FALLBACK] Scraping failed, trying RSS feed...`);

  // Method 2: Try RSS feed
  if (source.rssUrl) {
    const rssResult = await fetchRSSFeed(source.rssUrl, source.id);
    if (rssResult.success && rssResult.content.length > 200) {
      return rssResult;
    }
  }

  console.log(`[FALLBACK] RSS failed, recording newsletter subscription...`);

  // Method 3: Record newsletter subscription
  if (source.newsletter) {
    return recordNewsletterSubscription(source);
  }

  console.log(`[FALLBACK] No newsletter, marking for manual review...`);

  // Method 4: Mark for manual input
  return recordManualInput(url, "All automated methods failed");
}

/**
 * Main orchestrator
 */
async function gatherNews() {
  console.log("========================================");
  console.log("Multi-Method Payment News Gathering");
  console.log("========================================\n");

  const results = {
    successful: [],
    partial: [],
    failed: [],
    newsletters: [],
    manual: []
  };

  for (const source of NEWS_SOURCES) {
    for (const url of source.urls) {
      const result = await gatherArticleContent(url, source);

      if (result.success) {
        results.successful.push({
          source: source.name,
          url,
          method: result.method,
          savedPath: result.savedPath
        });
      } else if (result.method === "newsletter") {
        results.newsletters.push({ source: source.name, action: "subscribe_to_newsletter" });
      } else if (result.method === "manual") {
        results.manual.push({ source: source.name, url, action: "needs_manual_review" });
      } else {
        results.failed.push({ source: source.name, url, method: result.method });
      }
    }
  }

  // Summary report
  console.log("\n========================================");
  console.log("GATHERING SUMMARY");
  console.log("========================================");
  console.log(`✓ Successful: ${results.successful.length}`);
  console.log(`⚠ Newsletters: ${results.newsletters.length}`);
  console.log(`⚠ Manual review: ${results.manual.length}`);
  console.log(`✗ Failed: ${results.failed.length}`);

  if (results.newsletters.length > 0) {
    console.log("\n[ACTION REQUIRED] Subscribe to these newsletters:");
    results.newsletters.forEach(item => {
      console.log(`  - ${item.source}`);
    });
  }

  // Write summary
  fs.writeFileSync(
    path.join(DATA_DIR, 'gathering_summary.json'),
    JSON.stringify(results, null, 2)
  );

  console.log("\nSummary saved to: data/gathering_summary.json");
}

gatherNews().catch(console.error);
