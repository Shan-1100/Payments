'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '../data/sources/registry.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Populate missing RSS strategies for sources with rssUrl
function populateRSSStrategies() {
  const registry = readJSON(REGISTRY_PATH);
  let updated = 0;

  for (const source of registry) {
    // If source has rssUrl but no strategies, add RSS strategy
    if (source.rssUrl && (!source.collectionStrategies || source.collectionStrategies.length === 0)) {
      source.collectionStrategies = [
        {
          strategyType: 'RSS',
          url: source.rssUrl,
          enabled: true,
          status: 'Configured',
          lastRun: null,
          lastSuccess: null,
          lastFailure: null,
          failureReason: null,
          itemsLastRun: 0,
          confidence: 0.9,
        }
      ];
      updated++;
      console.log(`✓ Added RSS strategy to ${source.id}`);
    }
  }

  writeJSON(REGISTRY_PATH, registry);
  console.log(`\nUpdated ${updated} sources with RSS strategies`);
}

populateRSSStrategies();
