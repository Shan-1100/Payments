'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const crypto = require('crypto');
const { exec } = require('child_process');

const DATA_DIR = path.join(__dirname, 'data');
const PORT     = process.env.PORT || 3000;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── lazy-load pipeline modules (require npm install) ─────────────────────────
let synthesize, fetchRss;
try { synthesize = require('./scripts/synthesize'); } catch { /* npm install not yet run */ }
try { fetchRss   = require('./scripts/fetch-rss');  } catch { /* npm install not yet run */ }

// ── helpers ──────────────────────────────────────────────────────────────────
function readJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  try { if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { console.error(`Read error ${filename}:`, e.message); }
  return null;
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

function urlHash(u) {
  return crypto.createHash('md5').update(u).digest('hex').slice(0, 12);
}

async function fetchArticleContent(articleUrl) {
  try {
    const res = await fetch(articleUrl, {
      signal:  AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'PaymentsIntel/1.0' }
    });
    const html = await res.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  } catch {
    return '';
  }
}

async function discoverAndSaveRss(articleUrl) {
  if (!fetchRss) return;
  try {
    const { hostname } = new URL(articleUrl);
    const domain = hostname.replace(/^www\./, '');

    const discovered = readJSON('discovered_sources.json') || [];
    const approved   = readJSON('approved_sources.json')   || [];

    const alreadyTracked =
      discovered.some(s => s.domain === domain) ||
      approved.some(s => {
        try { return new URL(s.url).hostname.replace(/^www\./, '') === domain; } catch { return false; }
      });

    if (alreadyTracked) return;

    const rssUrl = await fetchRss.discoverRssFromUrl(articleUrl);
    if (rssUrl) {
      discovered.push({
        id:            `discovered-${domain.replace(/\./g, '-')}-${Date.now()}`,
        name:          domain,
        domain,
        rssUrl,
        tier:          'Tier 2',
        discoveredFrom: articleUrl,
        discoveredAt:  new Date().toISOString()
      });
      writeJSON('discovered_sources.json', discovered);
      console.log(`  RSS discovered for ${domain}: ${rssUrl}`);
    }
  } catch (err) {
    console.warn('RSS discovery error:', err.message);
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);
  const method       = req.method;

  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  try {
    // ── GET endpoints ────────────────────────────────────────────────────────
    if (pathname === '/api/content-items' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('content_items.json') || []));
    }
    else if (pathname === '/api/summary/weekly' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('weekly_summaries_archive.json') || []));
    }
    else if (pathname === '/api/summary/monthly' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('monthly_summaries_archive.json') || []));
    }
    else if (pathname === '/api/approved-sources' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('approved_sources.json') || []));
    }
    else if (pathname === '/api/expert-commentary' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('expert_commentary.json') || []));
    }
    else if (pathname === '/api/watchlist' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('watchlist.json') || { categories: [] }));
    }
    else if (pathname === '/api/deep-dives' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('deep_dives.json') || []));
    }
    else if (pathname === '/api/discovered-sources' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('discovered_sources.json') || []));
    }
    else if (pathname === '/api/scored-items' && method === 'GET') {
      const scored = readJSON('scored_items.json') || { executiveItems: [], analystItems: [], suppressedItems: [] };
      res.writeHead(200);
      res.end(JSON.stringify({
        executiveItems: scored.executiveItems || [],
        analystItems: scored.analystItems || [],
        suppressedItems: scored.suppressedItems || []
      }));
    }
    else if (pathname === '/api/pending-scoring' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(readJSON('pending_scoring.json') || []));
    }

    // ── POST /api/submissions — synthesize + persist + discover RSS ──────────
    else if (pathname === '/api/submissions' && method === 'POST') {
      const body = await readBody(req);
      const { url: articleUrl, title, summary } = JSON.parse(body);

      if (!articleUrl) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'URL required' }));
        return;
      }

      console.log(`\nSubmission: ${articleUrl}`);

      // Synthesize if API key is set
      let synthesized = null;
      if (synthesize && process.env.ANTHROPIC_API_KEY) {
        try {
          console.log('  Fetching article content...');
          const content       = await fetchArticleContent(articleUrl);
          const sourceName    = new URL(articleUrl).hostname.replace(/^www\./, '');
          console.log('  Synthesizing with Claude...');
          synthesized         = await synthesize.synthesizeArticle(
            title || sourceName, content, articleUrl, sourceName
          );
          console.log(`  ✓ Classified as: ${synthesized.intelligenceType} / ${synthesized.priorityBand}`);
        } catch (err) {
          console.warn('  Synthesis failed:', err.message);
        }
      }

      // Save to content_items.json
      const id    = urlHash(articleUrl);
      const items = readJSON('content_items.json') || [];

      if (!items.find(i => i.sourceUrl === articleUrl)) {
        const newItem = {
          id,
          sourceType:        'manual',
          sourceName:        new URL(articleUrl).hostname.replace(/^www\./, ''),
          sourceUrl:         articleUrl,
          sourceTier:        'Tier 2',
          title:             title || synthesized?.primaryTopic || 'Submitted Article',
          summary:           summary || synthesized?.summary || '',
          intelligenceType:  synthesized?.intelligenceType  || null,
          businessImpact:    synthesized?.businessImpact    || null,
          technicalTakeaway: synthesized?.technicalTakeaway || null,
          businessTakeaway:  synthesized?.businessTakeaway  || null,
          treasuryTakeaway:  synthesized?.treasuryTakeaway  || null,
          primaryTopic:      synthesized?.primaryTopic      || null,
          rail:              synthesized?.rail              || 'Adjacent',
          tags:              synthesized?.tags              || [],
          priorityBand:      synthesized?.priorityBand      || 'monitor',
          importanceScore:   synthesized?.priorityBand === 'high' ? 88 : synthesized?.priorityBand === 'medium' ? 72 : 55,
          publishedAt:       new Date().toISOString(),
          collectedAt:       new Date().toISOString(),
          status:            'collected'
        };
        items.unshift(newItem);
        writeJSON('content_items.json', items);
        console.log('  Item saved to feed.');
      } else {
        console.log('  Item already in feed (duplicate URL).');
      }

      // Auto-discover and persist RSS for this domain (non-blocking)
      discoverAndSaveRss(articleUrl);

      const msg = synthesized
        ? 'Article synthesized and added to feed'
        : `Article added${process.env.ANTHROPIC_API_KEY ? ' (synthesis failed)' : ' (set ANTHROPIC_API_KEY to enable synthesis)'}`;

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, synthesized: !!synthesized, message: msg }));
    }

    // ── POST /api/run-monitor — run the full RSS pipeline ───────────────────
    else if (pathname === '/api/run-monitor' && method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'Pipeline started — check server console for progress' }));

      const env = { ...process.env };
      exec('node scripts/run-pipeline.js', { cwd: __dirname, env }, (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        if (err)    console.error('Pipeline error:', err.message);
      });
    }

    // ── Static file serving ──────────────────────────────────────────────────
    else if (pathname.startsWith('/')) {
      const filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
      if (fs.existsSync(filePath) && filePath.startsWith(__dirname)) {
        const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
        res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'text/plain');
        res.writeHead(200);
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// ── Daily pipeline scheduler ──────────────────────────────────────────────────
const PIPELINE_STATE_FILE = path.join(DATA_DIR, 'pipeline_state.json');
const TWENTY_FOUR_HOURS   = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL      = 60 * 60 * 1000; // check every hour

function getPipelineState() {
  try { return JSON.parse(fs.readFileSync(PIPELINE_STATE_FILE, 'utf8')); }
  catch { return {}; }
}

function savePipelineState(state) {
  fs.writeFileSync(PIPELINE_STATE_FILE, JSON.stringify(state, null, 2));
}

function runScheduledPipeline() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[Scheduler] Skipping — ANTHROPIC_API_KEY not set');
    return;
  }
  console.log('[Scheduler] Starting daily pipeline...');
  savePipelineState({ lastRunAt: new Date().toISOString(), status: 'running' });

  exec('node scripts/run-pipeline.js', { cwd: __dirname, env: process.env }, (err, stdout, stderr) => {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    if (err) {
      console.error('[Scheduler] Pipeline failed:', err.message);
      savePipelineState({ lastRunAt: new Date().toISOString(), status: 'error', error: err.message });
    } else {
      console.log('[Scheduler] Daily pipeline complete.');
      savePipelineState({ lastRunAt: new Date().toISOString(), status: 'ok' });
    }
  });
}

function startScheduler() {
  const state   = getPipelineState();
  const lastRun = state.lastRunAt ? new Date(state.lastRunAt) : null;
  const due     = !lastRun || (Date.now() - lastRun.getTime()) >= TWENTY_FOUR_HOURS;

  if (due) {
    const reason = lastRun
      ? `last run ${Math.round((Date.now() - lastRun.getTime()) / 3600000)}h ago`
      : 'no previous run';
    console.log(`[Scheduler] Running now (${reason})`);
    runScheduledPipeline();
  } else {
    const next = new Date(lastRun.getTime() + TWENTY_FOUR_HOURS);
    console.log(`[Scheduler] Next run at ${next.toLocaleString()}`);
  }

  setInterval(() => {
    const s = getPipelineState();
    const last = s.lastRunAt ? new Date(s.lastRunAt) : null;
    if (!last || (Date.now() - last.getTime()) >= TWENTY_FOUR_HOURS) {
      runScheduledPipeline();
    }
  }, CHECK_INTERVAL);
}

server.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ⚠ ANTHROPIC_API_KEY not set — synthesis and auto-pipeline disabled.');
  }
  if (!synthesize) {
    console.warn('  ⚠ Pipeline modules not loaded — run: npm install');
  }
  startScheduler();
});
