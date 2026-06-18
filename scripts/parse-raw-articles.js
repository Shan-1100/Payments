#!/usr/bin/env node

/**
 * Parse Raw HTML Articles and Extract Structured Data
 *
 * Reads all HTML files from data/raw_articles/
 * Extracts: date, headline, key facts, statistics
 * Outputs structured JSON for summary creation
 *
 * Usage: node scripts/parse-raw-articles.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ARTICLES_DIR = path.join(DATA_DIR, 'raw_articles');

/**
 * Parse HTML to extract text content (simple strip-tags approach)
 */
function extractTextFromHtml(html) {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extract potential headline from HTML
 * Look in: <h1>, <h2>, <title>, og:title
 */
function extractHeadline(html) {
  let headline = '';

  // Try og:title meta tag first (most reliable)
  const ogMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  if (ogMatch) headline = ogMatch[1];

  // Try title tag
  if (!headline) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) headline = titleMatch[1];
  }

  // Try h1
  if (!headline) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) headline = h1Match[1];
  }

  // Try h2
  if (!headline) {
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (h2Match) headline = h2Match[1];
  }

  return headline ? headline.trim() : '(No headline found)';
}

/**
 * Extract publication date from HTML
 * Look in: published_time meta, article:published_time, datePublished, etc.
 */
function extractDate(html) {
  // Try published_time
  const pubMatch = html.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/i);
  if (pubMatch) {
    const date = new Date(pubMatch[1]);
    if (!isNaN(date)) return date.toISOString().split('T')[0];
  }

  // Try datePublished
  const dateMatch = html.match(/<meta\s+property="datePublished"\s+content="([^"]+)"/i);
  if (dateMatch) {
    const date = new Date(dateMatch[1]);
    if (!isNaN(date)) return date.toISOString().split('T')[0];
  }

  // Try published date in content
  const contentDateMatch = html.match(/published[:\s]+([A-Za-z]+\s+\d{1,2},?\s+20\d{2})/i);
  if (contentDateMatch) {
    try {
      const date = new Date(contentDateMatch[1]);
      if (!isNaN(date)) return date.toISOString().split('T')[0];
    } catch (e) {
      // Fall through
    }
  }

  return null;
}

/**
 * Extract key statistics and numbers from text
 */
function extractStatistics(text) {
  const stats = [];
  const patterns = [
    { regex: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:million|billion|trillion)/gi, label: 'amount' },
    { regex: /(\d+(?:\.\d+)?)\s*%/g, label: 'percentage' },
    { regex: /\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, label: 'currency' },
    { regex: /(\d+)\s*(?:banks|institutions|participants|members)/gi, label: 'count' }
  ];

  patterns.forEach(({ regex, label }) => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      stats.push({
        value: match[0],
        type: label
      });
    }
  });

  return [...new Map(stats.map(s => [s.value, s])).values()]; // Deduplicate
}

/**
 * Extract first N sentences as summary snippet
 */
function extractSummarySnippet(text, sentences = 3) {
  const sentenceArray = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentenceArray
    .slice(0, sentences)
    .map(s => s.trim())
    .join(' ')
    .substring(0, 500);
}

/**
 * Process a single HTML file
 */
function parseArticle(filePath, fileName) {
  const html = fs.readFileSync(filePath, 'utf8');
  const text = extractTextFromHtml(html);
  const headline = extractHeadline(html);
  const date = extractDate(html);
  const stats = extractStatistics(text);
  const snippet = extractSummarySnippet(text, 3);

  return {
    file: fileName,
    filePath: path.relative(DATA_DIR, filePath),
    headline,
    date,
    textLength: text.length,
    snippet,
    statistics: stats.slice(0, 5), // First 5 unique stats
    hasDate: date !== null
  };
}

/**
 * Main orchestrator
 */
async function parseArticles() {
  console.log("========================================");
  console.log("Raw Article Parser");
  console.log("========================================\n");

  if (!fs.existsSync(ARTICLES_DIR)) {
    console.log("❌ No raw_articles directory found.");
    console.log(`\nExpected: ${ARTICLES_DIR}`);
    console.log("\nTo populate this directory:");
    console.log("1. Run: node scripts/gather-payment-news.js");
    console.log("2. Articles will be saved to data/raw_articles/");
    console.log("\nNote: This requires network access to payment industry sites.");
    return;
  }

  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

  if (files.length === 0) {
    console.log("❌ No HTML files found in raw_articles directory.\n");
    return;
  }

  console.log(`Found ${files.length} articles to parse.\n`);

  const results = {
    parsed: 0,
    withDates: 0,
    noDates: 0,
    articles: []
  };

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    console.log(`Parsing: ${file}`);

    const parsed = parseArticle(filePath, file);
    results.articles.push(parsed);
    results.parsed++;

    if (parsed.hasDate) {
      results.withDates++;
      console.log(`  ✓ Date: ${parsed.date} | ${parsed.headline.substring(0, 60)}...`);
    } else {
      results.noDates++;
      console.log(`  ⚠ No date found | ${parsed.headline.substring(0, 60)}...`);
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("PARSE SUMMARY");
  console.log("========================================");
  console.log(`Parsed: ${results.parsed} articles`);
  console.log(`With dates: ${results.withDates}`);
  console.log(`Without dates: ${results.noDates}`);

  // Save results
  const outputFile = path.join(DATA_DIR, 'parsed_articles.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: data/parsed_articles.json`);

  console.log("\nNext steps:");
  console.log("1. Review parsed_articles.json for extracted data");
  console.log("2. For articles without dates, manually extract from article HTML");
  console.log("3. Use article content to create summaries in daily_summaries_archive.json");
  console.log("4. VERIFY: Read full article text, not just snippets");
  console.log("5. ENSURE: Each claim in summary is traceable to article text\n");
}

parseArticles().catch(console.error);
