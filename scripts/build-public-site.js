const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(DIST_DIR, 'data'))) {
  fs.mkdirSync(path.join(DIST_DIR, 'data'), { recursive: true });
}

const files = ['index.html', 'styles.css', 'app.js'];
files.forEach(file => {
  const src = path.join(__dirname, '..', file);
  const dst = path.join(DIST_DIR, file);
  fs.copyFileSync(src, dst);
});

const dataFiles = ['content_items.json', 'watchlist.json', 'approved_sources.json', 'deep_dives.json', 'expert_commentary.json', 'weekly_summary.json', 'monthly_summary.json', 'qa.json'];
dataFiles.forEach(file => {
  const src = path.join(DATA_DIR, file);
  const dst = path.join(DIST_DIR, 'data', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
  } else {
    fs.writeFileSync(dst, '[]');
  }
});

console.log('Public site built to dist/');
