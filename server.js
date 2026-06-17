const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_DIR = path.join(__dirname, 'data');
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/content-items' && method === 'GET') {
      const items = readJSON('content_items.json') || [];
      res.writeHead(200);
      res.end(JSON.stringify(items));
    }
    else if (pathname === '/api/daily-feed' && method === 'GET') {
      const items = readJSON('content_items.json') || [];
      const today = new Date().toISOString().split('T')[0];
      const dailyItems = items.filter(i => i.collectedAt?.startsWith(today));
      res.writeHead(200);
      res.end(JSON.stringify(dailyItems));
    }
    else if (pathname === '/api/summary/weekly' && method === 'GET') {
      const summary = readJSON('weekly_summary.json') || { summary: 'No summary available' };
      res.writeHead(200);
      res.end(JSON.stringify(summary));
    }
    else if (pathname === '/api/summary/monthly' && method === 'GET') {
      const summary = readJSON('monthly_summary.json') || { summary: 'No summary available' };
      res.writeHead(200);
      res.end(JSON.stringify(summary));
    }
    else if (pathname === '/api/approved-sources' && method === 'GET') {
      const sources = readJSON('approved_sources.json') || [];
      res.writeHead(200);
      res.end(JSON.stringify(sources));
    }
    else if (pathname === '/api/expert-commentary' && method === 'GET') {
      const items = readJSON('expert_commentary.json') || [];
      res.writeHead(200);
      res.end(JSON.stringify(items));
    }
    else if (pathname === '/api/watchlist' && method === 'GET') {
      const watchlist = readJSON('watchlist.json');
      res.writeHead(200);
      res.end(JSON.stringify(watchlist || { categories: [] }));
    }
    else if (pathname === '/api/deep-dives' && method === 'GET') {
      const dives = readJSON('deep_dives.json') || [];
      res.writeHead(200);
      res.end(JSON.stringify(dives));
    }
    else if (pathname === '/api/submissions' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const submissions = readJSON('submissions.json') || [];
          submissions.push({
            ...data,
            submittedAt: new Date().toISOString(),
            id: Date.now().toString()
          });
          writeJSON('submissions.json', submissions);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
    else if (pathname === '/api/run-monitor' && method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'Monitor started' }));
      runSourceMonitor();
    }
    else if (pathname.startsWith('/')) {
      const filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
      if (fs.existsSync(filePath) && filePath.startsWith(__dirname)) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'application/json'
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
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
    console.error('Error:', e);
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
  }
  return null;
}

function writeJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function scoreItem(item) {
  const factors = {
    marketImpact: 3,
    treasuryRelevance: 3,
    technicalSignificance: 2,
    commercialSignificance: 2,
    sourceCredibility: item.sourceTier === 'Tier 1' ? 5 : 3,
    timeSensitivity: 2
  };

  const weights = {
    marketImpact: 0.25,
    treasuryRelevance: 0.20,
    technicalSignificance: 0.20,
    commercialSignificance: 0.20,
    sourceCredibility: 0.10,
    timeSensitivity: 0.05
  };

  const score = Math.round(
    (factors.marketImpact * weights.marketImpact +
     factors.treasuryRelevance * weights.treasuryRelevance +
     factors.technicalSignificance * weights.technicalSignificance +
     factors.commercialSignificance * weights.commercialSignificance +
     factors.sourceCredibility * weights.sourceCredibility +
     factors.timeSensitivity * weights.timeSensitivity) * 20
  );

  return {
    importanceScore: Math.min(100, score),
    priorityBand: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'monitor'
  };
}

function runSourceMonitor() {
  console.log('Source monitor running...');
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
