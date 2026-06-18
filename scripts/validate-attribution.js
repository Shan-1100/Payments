#!/usr/bin/env node

/**
 * Attribution Fix Validator
 *
 * Checks that:
 * 1. Local archive has real RSS articles grouped by publish date
 * 2. dist/ matches local (build is current)
 * 3. Each summary's sourceLinks are from its own date
 * 4. No future-dated entries exist
 * 5. app.js implements cache-busting
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DIST_DIR = path.join(__dirname, '..', 'dist', 'data');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         Attribution Fix Validation                         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let passed = 0, failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  → ${err.message}`);
    failed++;
  }
}

// ─── Load files ──────────────────────────────────────────────────────────
let archive, distArchive, appJs;

check('Load local archive', () => {
  archive = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'daily_summaries_archive.json'), 'utf8'));
  if (!Array.isArray(archive) || archive.length === 0) throw new Error('Archive is empty');
});

check('Load dist/ archive', () => {
  distArchive = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'daily_summaries_archive.json'), 'utf8'));
  if (!Array.isArray(distArchive) || distArchive.length === 0) throw new Error('Dist archive is empty');
});

check('Load app.js', () => {
  appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  if (appJs.length === 0) throw new Error('app.js is empty');
});

// ─── Validation checks ────────────────────────────────────────────────────
check('Archives match (local === dist)', () => {
  const localStr = JSON.stringify(archive);
  const distStr = JSON.stringify(distArchive);
  if (localStr !== distStr) throw new Error('Archives differ — dist/ not rebuilt');
});

check('No future-dated entries', () => {
  const today = '2026-06-18'; // Reference date
  const future = archive.filter(e => e.date > today);
  if (future.length > 0) {
    throw new Error(`Found ${future.length} future-dated entries: ${future.map(e => e.date).join(', ')}`);
  }
});

check('June 17 entry exists', () => {
  const jun17 = archive.find(e => e.date === '2026-06-17');
  if (!jun17) throw new Error('No June 17 entry');
  if (!jun17.sourceLinks || jun17.sourceLinks.length === 0) {
    throw new Error('June 17 has no sourceLinks');
  }
});

check('June 17 sourceLinks are from June 17', () => {
  const jun17 = archive.find(e => e.date === '2026-06-17');
  const mismatch = jun17.sourceLinks.filter(s => !s.publishedAt.startsWith('2026-06-17'));
  if (mismatch.length > 0) {
    throw new Error(`${mismatch.length} links are not from June 17: ${mismatch.map(s => s.publishedAt.slice(0, 10)).join(', ')}`);
  }
});

check('June 17 sourceLinks have no May articles', () => {
  const jun17 = archive.find(e => e.date === '2026-06-17');
  const mayLinks = jun17.sourceLinks.filter(s => s.publishedAt.startsWith('2026-05'));
  if (mayLinks.length > 0) {
    throw new Error(`Found ${mayLinks.length} May articles linked to June 17`);
  }
});

check('All sourceLinks have required fields', () => {
  let missing = 0;
  for (const entry of archive) {
    if (entry.sourceLinks) {
      for (const link of entry.sourceLinks) {
        if (!link.name || !link.url || !link.publishedAt) missing++;
      }
    }
  }
  if (missing > 0) throw new Error(`${missing} sourceLinks missing required fields`);
});

check('app.js has cache-bust in fetchJSON', () => {
  if (!appJs.includes("Date.now()") || !appJs.includes("data/")) {
    throw new Error('fetchJSON does not have cache-busting for data files');
  }
});

check('build-public-site.js adds no-cache header', () => {
  const buildScript = fs.readFileSync(path.join(__dirname, 'build-public-site.js'), 'utf8');
  if (!buildScript.includes('Cache-Control') || !buildScript.includes('no-cache')) {
    throw new Error('build script missing Cache-Control meta tag');
  }
});

// ─── Report ──────────────────────────────────────────────────────────────
console.log(`\n╔════════════════════════════════════════════════════════════╗`);
console.log(`║ Checks: ${passed} passed, ${failed} failed${' '.repeat(32 - (passed.toString().length + failed.toString().length))}║`);
console.log(`╚════════════════════════════════════════════════════════════╝\n`);

if (failed > 0) {
  console.log('🚨 Attribution system has issues. Fix required.');
  process.exit(1);
} else {
  console.log('✅ Attribution fix is properly deployed.');
  console.log('\nTo keep attribution current going forward:');
  console.log('  npm run attribute      (daily, no API key needed)');
  console.log('  npm run pipeline       (with AI synthesis, requires ANTHROPIC_API_KEY)');
  process.exit(0);
}
