'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { scoreItem } = require('./synthesize');

const DATA_DIR = path.join(__dirname, '../data');
const PENDING_FILE = path.join(DATA_DIR, 'pending_scoring.json');
const SCORED_FILE = path.join(DATA_DIR, 'scored_items.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function scorePendingItems() {
  const pendingItems = readJSON(PENDING_FILE);
  if (!pendingItems || pendingItems.length === 0) {
    console.log('No pending items to score');
    process.exit(0);
  }

  console.log(`Scoring ${pendingItems.length} pending items...\n`);

  const results = {
    timestamp: new Date().toISOString(),
    executiveItems: [],
    analystItems: [],
    suppressedItems: [],
    missingFields: [],
    fluffItems: [],
  };

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    try {
      console.log(`[${i + 1}/${pendingItems.length}] Scoring: ${item.title.substring(0, 60)}...`);

      const scored = await scoreItem(
        item.title,
        item.rawContent,
        item.articleUrl,
        item.monitoredSourceName,
        item.sourceClass
      );

      const scoredItem = {
        id: item.id,
        title: item.title,
        articleUrl: item.articleUrl,
        monitoredSourceId: item.monitoredSourceId,
        monitoredSourceName: item.monitoredSourceName,
        sourceClass: item.sourceClass,
        sourceTier: item.sourceTier,
        collectedBy: item.collectedBy,
        relevanceScore: scored.relevanceScore,
        segment: scored.segment,
        railRelevance: scored.railRelevance,
        geography: scored.geography,
        actorType: scored.actorType,
        strategicImpact: scored.strategicImpact,
        whyItMatters: scored.whyItMatters,
        confidence: scored.confidence,
        suppressionReason: scored.suppressionReason || null,
        suppressed: scored.suppressed || false,
        summary: scored.summary,
        mentionedActors: scored.mentionedActors || [],
        scoredAt: new Date().toISOString(),
      };

      // Check for missing fields
      const requiredFields = [
        'relevanceScore', 'segment', 'railRelevance', 'geography',
        'actorType', 'strategicImpact', 'whyItMatters', 'confidence'
      ];
      const missingFields = requiredFields.filter(f => !scoredItem[f] || scoredItem[f] === null || scoredItem[f] === undefined);

      if (missingFields.length > 0) {
        results.missingFields.push({
          id: scoredItem.id,
          title: scoredItem.title,
          missing: missingFields,
        });
      }

      // Check for fluff (low relevance + generic impact)
      if (scoredItem.relevanceScore <= 2 &&
          (scoredItem.strategicImpact === 'market signal' ||
           scoredItem.strategicImpact === 'expert analysis' ||
           !scoredItem.whyItMatters ||
           scoredItem.whyItMatters.length < 50)) {
        results.fluffItems.push({
          id: scoredItem.id,
          title: scoredItem.title,
          relevanceScore: scoredItem.relevanceScore,
          strategicImpact: scoredItem.strategicImpact,
          reason: 'Low relevance + generic impact or weak explanation',
        });
      }

      // Route item
      if (scoredItem.suppressed) {
        results.suppressedItems.push(scoredItem);
      } else if (scoredItem.relevanceScore >= 4) {
        results.executiveItems.push(scoredItem);
      } else {
        results.analystItems.push(scoredItem);
      }

    } catch (error) {
      console.error(`  ✗ Failed to score: ${error.message}`);
    }
  }

  // Sort by relevance score
  results.executiveItems.sort((a, b) => b.relevanceScore - a.relevanceScore);
  results.analystItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Write results
  writeJSON(SCORED_FILE, results);
  console.log(`\nScoring complete. Results saved to ${path.relative(process.cwd(), SCORED_FILE)}\n`);

  // Print summary
  printSummary(results);
}

function printSummary(results) {
  console.log('=== SCORING RESULTS ===\n');
  console.log(`Executive items (relevance 4-5):  ${results.executiveItems.length}`);
  console.log(`Analyst queue items (relevance 2-3): ${results.analystItems.length}`);
  console.log(`Suppressed items:                  ${results.suppressedItems.length}`);
  console.log(`Items with missing fields:         ${results.missingFields.length}`);
  console.log(`Potential fluff items:             ${results.fluffItems.length}`);
  console.log(`\nTotal items scored:                ${results.executiveItems.length + results.analystItems.length + results.suppressedItems.length}\n`);

  // Top 10 executive
  if (results.executiveItems.length > 0) {
    console.log('=== TOP 10 EXECUTIVE ITEMS ===\n');
    const top10 = results.executiveItems.slice(0, 10);
    top10.forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.relevanceScore}] ${item.title}`);
      console.log(`   Source: ${item.monitoredSourceName}`);
      console.log(`   Impact: ${item.strategicImpact}`);
      console.log(`   Rail: ${item.railRelevance}`);
      console.log(`   Why: ${item.whyItMatters.substring(0, 100)}...`);
      console.log(`   URL: ${item.articleUrl}\n`);
    });
  }

  // Analyst queue items
  if (results.analystItems.length > 0) {
    console.log(`=== ANALYST QUEUE (${results.analystItems.length} items) ===\n`);
    results.analystItems.slice(0, 5).forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.relevanceScore}] ${item.title}`);
      console.log(`   Source: ${item.monitoredSourceName} | Impact: ${item.strategicImpact}\n`);
    });
    if (results.analystItems.length > 5) {
      console.log(`... and ${results.analystItems.length - 5} more analyst items\n`);
    }
  }

  // Suppressed items
  if (results.suppressedItems.length > 0) {
    console.log(`=== SUPPRESSED ITEMS (${results.suppressedItems.length}) ===\n`);
    results.suppressedItems.slice(0, 5).forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.title}`);
      console.log(`   Reason: ${item.suppressionReason}\n`);
    });
    if (results.suppressedItems.length > 5) {
      console.log(`... and ${results.suppressedItems.length - 5} more suppressed items\n`);
    }
  }

  // Missing fields
  if (results.missingFields.length > 0) {
    console.log(`=== ITEMS WITH MISSING FIELDS (${results.missingFields.length}) ===\n`);
    results.missingFields.forEach(item => {
      console.log(`• ${item.title}`);
      console.log(`  Missing: ${item.missing.join(', ')}\n`);
    });
  }

  // Fluff items
  if (results.fluffItems.length > 0) {
    console.log(`=== POTENTIAL FLUFF ITEMS (${results.fluffItems.length}) ===\n`);
    results.fluffItems.forEach(item => {
      console.log(`• ${item.title}`);
      console.log(`  Relevance: ${item.relevanceScore} | Impact: ${item.strategicImpact}`);
      console.log(`  Issue: ${item.reason}\n`);
    });
  }
}

scorePendingItems().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
