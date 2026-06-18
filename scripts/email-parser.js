#!/usr/bin/env node

/**
 * Email Newsletter Parser
 *
 * Processes .eml newsletter files and extracts:
 * - Article links
 * - Key facts and statistics
 * - Publication metadata
 * - Source attribution
 */

const fs = require('fs');
const path = require('path');
const simpleParser = require('mailparser').simpleParser;

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWSLETTERS_DIR = path.join(DATA_DIR, 'newsletters');

/**
 * Parse email file and extract article information
 */
async function parseEmailFile(filePath) {
  try {
    const stream = fs.createReadStream(filePath);
    const parsed = await simpleParser(stream);

    return {
      success: true,
      from: parsed.from?.text,
      subject: parsed.subject,
      date: parsed.date,
      text: parsed.text,
      html: parsed.html,
      headers: parsed.headers
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Extract URLs from email content
 */
function extractUrls(text, html) {
  const urls = new Set();
  const urlRegex = /(https?:\/\/[^\s<>"\)]+)/g;

  if (text) {
    const textUrls = text.match(urlRegex) || [];
    textUrls.forEach(url => urls.add(url));
  }

  if (html) {
    const htmlUrls = html.match(urlRegex) || [];
    htmlUrls.forEach(url => urls.add(url));
  }

  return Array.from(urls);
}

/**
 * Extract key statistics from email content
 */
function extractStatistics(text) {
  const stats = [];
  const patterns = [
    /(\d+(?:,\d{3})*)\s*(?:million|billion|trillion)/gi,
    /(\d+(?:\.\d+)?)\s*%/g,
    /\$\d+(?:,\d{3})*(?:\s*(?:billion|million|trillion))?/gi,
    /(\d+)\s*(?:banks|institutions|participants)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      stats.push(match[0]);
    }
  });

  return [...new Set(stats)]; // Remove duplicates
}

/**
 * Process all newsletters in the newsletters directory
 */
async function processNewsletters() {
  console.log("========================================");
  console.log("Email Newsletter Parser");
  console.log("========================================\n");

  if (!fs.existsSync(NEWSLETTERS_DIR)) {
    console.log("No newsletters directory found.");
    console.log(`Create: ${NEWSLETTERS_DIR}`);
    console.log("Add .eml files for processing.\n");
    return;
  }

  const results = {
    processed: 0,
    extracted: [],
    errors: []
  };

  // Get all .eml files recursively
  const getAllEmlFiles = (dir) => {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    items.forEach(item => {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...getAllEmlFiles(fullPath));
      } else if (item.name.endsWith('.eml')) {
        files.push(fullPath);
      }
    });

    return files;
  };

  const emlFiles = getAllEmlFiles(NEWSLETTERS_DIR);

  if (emlFiles.length === 0) {
    console.log("No .eml files found in newsletters directory.\n");
    return;
  }

  console.log(`Found ${emlFiles.length} newsletter files.\n`);

  for (const filePath of emlFiles) {
    console.log(`Processing: ${path.relative(NEWSLETTERS_DIR, filePath)}`);

    const parsed = await parseEmailFile(filePath);

    if (!parsed.success) {
      results.errors.push({
        file: filePath,
        error: parsed.error
      });
      continue;
    }

    const urls = extractUrls(parsed.text, parsed.html);
    const stats = extractStatistics(parsed.text || '');

    const extraction = {
      file: path.relative(NEWSLETTERS_DIR, filePath),
      from: parsed.from,
      subject: parsed.subject,
      date: parsed.date,
      urlsFound: urls.length,
      urls: urls.slice(0, 10), // First 10 URLs
      statisticsFound: stats.length,
      statistics: stats.slice(0, 10), // First 10 stats
      textLength: parsed.text ? parsed.text.length : 0
    };

    results.extracted.push(extraction);
    results.processed++;

    console.log(`  ✓ Found ${urls.length} URLs, ${stats.length} statistics\n`);
  }

  // Summary
  console.log("========================================");
  console.log("PROCESSING SUMMARY");
  console.log("========================================");
  console.log(`Processed: ${results.processed}`);
  console.log(`URLs found: ${results.extracted.reduce((sum, e) => sum + e.urlsFound, 0)}`);
  console.log(`Statistics found: ${results.extracted.reduce((sum, e) => sum + e.statisticsFound, 0)}`);
  console.log(`Errors: ${results.errors.length}\n`);

  // Save results
  fs.writeFileSync(
    path.join(DATA_DIR, 'newsletter_extraction.json'),
    JSON.stringify(results, null, 2)
  );

  console.log("Results saved to: data/newsletter_extraction.json");
  console.log("\nNext steps:");
  console.log("1. Review extracted URLs and statistics");
  console.log("2. Use URLs for web scraping or verification");
  console.log("3. Create summaries from verified content");
  console.log("4. Update daily_summaries_archive.json\n");
}

// Check if mailparser is installed
try {
  require.resolve('mailparser');
} catch (e) {
  console.error("Error: 'mailparser' package not found.");
  console.error("Install it with: npm install mailparser");
  process.exit(1);
}

processNewsletters().catch(console.error);
