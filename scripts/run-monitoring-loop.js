'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fetchAllFeeds } = require('./fetch-content');
const { scoreItem } = require('./synthesize');

const DATA_DIR             = path.join(__dirname, '../data');
const REGISTRY_PATH        = path.join(DATA_DIR, 'sources/registry.json');
const MONITORING_STATE     = path.join(DATA_DIR, 'monitoring_state.json');
const RUN_REPORTS_DIR      = path.join(DATA_DIR, 'monitoring_reports');
const SOURCE_HEALTH        = path.join(DATA_DIR, 'sources/health.json');
const PENDING_SCORING_FILE = path.join(DATA_DIR, 'pending_scoring.json');
const CONTENT_ITEMS_FILE   = path.join(DATA_DIR, 'content_items.json');

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_SCORE = 50;

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function urlHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function initMonitoringState() {
  return {
    version: '1.0',
    lastRunAt: null,
    seenUrls: {}, // { urlHash: { url, title, seenAt } }
    executiveView: [],
    analystQueue: [],
    suppressed: [],
    pendingScoring: [],
  };
}

function getSourcesWithEnabledStrategies() {
  const registry = readJSON(REGISTRY_PATH);
  if (!registry) return [];
  return registry.filter(source => {
    const enabledStrategies = (source.collectionStrategies || [])
      .filter(s => s.enabled && s.strategyType !== 'ManualIntake');
    return enabledStrategies.length > 0;
  });
}

async function runMonitoringLoop() {
  const runId = new Date().toISOString();
  console.log('=== Production Monitoring Loop ===');
  console.log(`Timestamp: ${runId}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}\n`);

  const report = {
    runId,
    mode: DRY_RUN ? 'dry-run' : 'live',
    startTime: new Date(),
    sourcesAttempted: 0,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    sourceFailures: [],
    sourceResults: [], // per-source detail
    rawItemsFetched: 0,
    newItemsAfterDedup: 0,
    itemsScored: 0,
    executiveItems: 0,
    analystItems: 0,
    suppressedItems: 0,
    pendingScoringItems: 0,
    duplicatesSkipped: 0,
    executiveView: [],
    analystQueue: [],
    suppressed: [],
  };

  // Load persistent state
  let state = readJSON(MONITORING_STATE) || initMonitoringState();
  const existingContent = readJSON(CONTENT_ITEMS_FILE) || [];
  const existingUrls = new Set(existingContent.map(i => i.articleUrl || i.sourceUrl).filter(Boolean));

  console.log(`[STATE] Loaded ${Object.keys(state.seenUrls).length} in monitoring state`);
  console.log(`[CONTENT] Loaded ${existingContent.length} previously scored items\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. FETCH: Retrieve from all sources with enabled strategies
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[1/5] Fetching from sources with enabled strategies...');
  const sourcesWithStrategies = getSourcesWithEnabledStrategies();
  report.sourcesAttempted = sourcesWithStrategies.length;
  console.log(`  Sources to attempt: ${sourcesWithStrategies.map(s => s.id).join(', ')}\n`);

  let rawItems = [];
  try {
    rawItems = await fetchAllFeeds();
    report.rawItemsFetched = rawItems.length;
    console.log(`✓ Fetched ${rawItems.length} items after dedup against existing content\n`);
  } catch (error) {
    console.error(`✗ Fetch failed: ${error.message}\n`);
    report.sourceFailures.push({
      context: 'fetchAllFeeds',
      error: error.message,
    });
  }

  // Track which sources contributed items
  const sourceContributions = new Map();
  for (const item of rawItems) {
    const srcId = item.monitoredSourceId;
    if (!sourceContributions.has(srcId)) {
      sourceContributions.set(srcId, 0);
    }
    sourceContributions.set(srcId, sourceContributions.get(srcId) + 1);
  }

  for (const source of sourcesWithStrategies) {
    const itemCount = sourceContributions.get(source.id) || 0;
    report.sourceResults.push({
      sourceId: source.id,
      sourceName: source.name,
      itemsFetched: itemCount,
      status: itemCount > 0 ? 'Success' : 'No new items',
    });
    if (itemCount > 0) {
      report.sourcesSucceeded++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DEDUPLICATE: Filter against previously seen URLs in monitoring state
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[2/5] Deduplicating against monitoring state...');
  const newItems = [];
  for (const item of rawItems) {
    const hash = urlHash(item.articleUrl || item.sourceUrl);
    if (state.seenUrls[hash]) {
      report.duplicatesSkipped++;
    } else {
      newItems.push(item);
      state.seenUrls[hash] = {
        url: item.articleUrl || item.sourceUrl,
        title: item.title,
        seenAt: new Date().toISOString(),
      };
    }
  }
  report.newItemsAfterDedup = newItems.length;
  console.log(`  Already seen in monitoring state: ${report.duplicatesSkipped}`);
  console.log(`  Truly new items for this run: ${newItems.length}\n`);

  // ─────────────────────────────────────────────────────────────────────
  // 3. SCORE: Run intelligence pipeline on new items
  // ─────────────────────────────────────────────────────────────────────
  if (newItems.length === 0) {
    console.log('[3/5] No new items to score. Skipping.\n');
    report.itemsScored = 0;
  } else {
    console.log(`[3/5] Scoring up to ${Math.min(newItems.length, MAX_SCORE)} new items...`);
    const toScore = newItems.slice(0, MAX_SCORE);
    const pendingQueue = readJSON(PENDING_SCORING_FILE) || [];

    for (const item of toScore) {
      try {
        console.log(`  → ${item.title.slice(0, 60)}...`);

        // Skip scoring in dry-run
        let scored;
        if (DRY_RUN) {
          scored = {
            relevanceScore: Math.floor(Math.random() * 5) + 1,
            segment: 'Both',
            summary: item.rawContent.slice(0, 200),
            suppressed: false,
          };
        } else {
          // Try to score, but don't fail if API key missing
          try {
            scored = await scoreItem(
              item.title,
              item.rawContent,
              item.articleUrl || item.sourceUrl,
              item.monitoredSourceName || item.sourceName,
              item.sourceClass
            );
          } catch (scoreErr) {
            if (scoreErr.message.includes('ANTHROPIC_API_KEY')) {
              // API key missing — add to pending queue instead of failing
              console.log(`    ⚠ API key unavailable, queuing for later scoring`);
              pendingQueue.push({
                ...item,
                queuedAt: new Date().toISOString(),
                retries: 0,
              });
              report.pendingScoringItems++;
              if (!DRY_RUN) {
                writeJSON(PENDING_SCORING_FILE, pendingQueue);
              }
              continue; // Skip this item, don't route it
            } else {
              throw scoreErr; // Re-throw other errors
            }
          }
        }

        const scoredItem = {
          id: item.id,
          monitoredSourceId: item.monitoredSourceId,
          monitoredSourceName: item.monitoredSourceName || item.sourceName,
          title: item.title,
          articleUrl: item.articleUrl || item.sourceUrl,
          sourceName: item.monitoredSourceName || item.sourceName,
          sourceClass: item.sourceClass || 'Industry Reporting',
          relevanceScore: scored.relevanceScore || 2,
          segment: scored.segment || 'Both',
          summary: scored.summary || item.rawContent.slice(0, 200),
          whyItMatters: scored.whyItMatters || null,
          mentionedActors: scored.mentionedActors || [],
          suppressed: scored.suppressed || false,
          suppressionReason: scored.suppressionReason || null,
          scoredAt: new Date().toISOString(),
        };

        report.itemsScored++;

        // ────────────────────────────────────────────────────────────────
        // 4. ROUTE: Executive, Analyst, or Suppressed
        // ────────────────────────────────────────────────────────────────
        if (scored.suppressed) {
          report.suppressedItems++;
          state.suppressed.push(scoredItem);
          report.suppressed.push(scoredItem);
        } else if (scored.relevanceScore >= 4) {
          report.executiveItems++;
          state.executiveView.push(scoredItem);
          report.executiveView.push(scoredItem);
        } else {
          report.analystItems++;
          state.analystQueue.push(scoredItem);
          report.analystQueue.push(scoredItem);
        }
      } catch (error) {
        console.error(`    ✗ Score failed: ${error.message}`);
        report.sourceFailures.push({
          item: item.title.slice(0, 60),
          error: error.message,
        });
      }
    }
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. HEALTH: Update source health after run
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[4/5] Updating source health...');
  const sourceHealth = readJSON(SOURCE_HEALTH) || [];

  for (const source of sourcesWithStrategies) {
    const existingHealth = sourceHealth.find(s => s.sourceId === source.id) || {};
    const sourceItems = rawItems.filter(i => i.monitoredSourceId === source.id);

    const health = {
      sourceId: source.id,
      sourceName: source.name,
      sourceClass: source.sourceClass,
      category: source.category,
      lastPipelineRun: new Date().toISOString(),
      overallStatus: source.status || 'Untested',
      itemsThisRun: sourceItems.length,
      strategies: (source.collectionStrategies || [])
        .filter(s => s.enabled && s.strategyType !== 'ManualIntake')
        .map(s => ({
          strategyType: s.strategyType,
          status: s.status,
          url: s.url,
          itemsThisRun: 0, // Would be populated if we tracked per-strategy
        })),
    };

    if (sourceItems.length > 0) {
      health.latestRetrievedTitle = sourceItems[0].title;
      health.latestRetrievedUrl = sourceItems[0].articleUrl || sourceItems[0].sourceUrl;
    }

    const idx = sourceHealth.findIndex(s => s.sourceId === source.id);
    if (idx >= 0) {
      sourceHealth[idx] = health;
    } else {
      sourceHealth.push(health);
    }
  }

  if (!DRY_RUN) {
    writeJSON(SOURCE_HEALTH, sourceHealth);
    console.log(`  Updated health for ${sourcesWithStrategies.length} sources\n`);
  } else {
    console.log(`  [DRY-RUN] Would update health for ${sourcesWithStrategies.length} sources\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PERSIST: Save state and generate report
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[5/5] Finalizing and storing state...');
  state.lastRunAt = new Date().toISOString();

  // Rotate state: keep only recent items (last 500 executive, 1000 analyst, 2000 suppressed)
  state.executiveView = state.executiveView.slice(-500);
  state.analystQueue = state.analystQueue.slice(-1000);
  state.suppressed = state.suppressed.slice(-2000);

  report.endTime = new Date();
  report.durationMs = report.endTime - report.startTime;

  if (!DRY_RUN) {
    writeJSON(MONITORING_STATE, state);
    fs.mkdirSync(RUN_REPORTS_DIR, { recursive: true });
    const reportFile = path.join(RUN_REPORTS_DIR, `report-${Date.now()}.json`);
    writeJSON(reportFile, report);
    console.log(`  ✓ State persisted`);
    console.log(`  ✓ Report saved: ${path.relative(process.cwd(), reportFile)}\n`);
  } else {
    console.log(`  [DRY-RUN] Would persist state`);
    console.log(`  [DRY-RUN] Would save report\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PRINT: Summary report
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== RUN REPORT ===\n');
  console.log(`Timestamp:                  ${report.runId}`);
  console.log(`Mode:                       ${report.mode}`);
  console.log(`Duration:                   ${report.durationMs}ms\n`);
  console.log('SOURCES:');
  console.log(`  Sources attempted:        ${report.sourcesAttempted}`);
  console.log(`  Sources succeeded:        ${report.sourcesSucceeded}`);
  console.log(`  Sources failed:           ${report.sourcesFailed}\n`);
  console.log('RETRIEVAL:');
  console.log(`  Raw items fetched:        ${report.rawItemsFetched}`);
  console.log(`  (after dedup vs content)`);
  console.log(`  Duplicates in mon state:  ${report.duplicatesSkipped}`);
  console.log(`  New items this run:       ${report.newItemsAfterDedup}\n`);
  console.log('SCORING & ROUTING:');
  console.log(`  Items scored:             ${report.itemsScored}`);
  console.log(`  Executive (4-5):          ${report.executiveItems}`);
  console.log(`  Analyst Queue (2-3):      ${report.analystItems}`);
  console.log(`  Suppressed (0-1):         ${report.suppressedItems}`);
  console.log(`  Pending scoring:          ${report.pendingScoringItems}\n`);

  if (report.sourceResults.length > 0) {
    console.log('PER-SOURCE BREAKDOWN:');
    for (const src of report.sourceResults) {
      console.log(`  ${src.sourceId.padEnd(20)} ${src.itemsFetched} items  [${src.status}]`);
    }
    console.log('');
  }

  if (report.sourceFailures.length > 0) {
    console.log('FAILURES:');
    report.sourceFailures.forEach(f => {
      console.log(`  • ${f.context || f.item}: ${f.error}`);
    });
    console.log('');
  }

  console.log('=== END REPORT ===\n');

  return report;
}

// Main
(async () => {
  try {
    await runMonitoringLoop();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
