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

// Cache-busting version stamp (changes every build) so browsers never serve
// a stale app.js/styles.css against a fresh index.html.
const VERSION = Date.now().toString();

const files = ['index.html', 'styles.css', 'app.js'];
files.forEach(file => {
  const src = path.join(__dirname, '..', file);
  const dst = path.join(DIST_DIR, file);
  if (file === 'index.html') {
    let html = fs.readFileSync(src, 'utf8');
    // Append ?v=VERSION to local asset references in the built HTML only.
    html = html
      .replace('href="styles.css"', `href="styles.css?v=${VERSION}"`)
      .replace('src="app.js"', `src="app.js?v=${VERSION}"`);
    fs.writeFileSync(dst, html);
  } else {
    fs.copyFileSync(src, dst);
  }
});

console.log(`Cache-bust version: ${VERSION}`);

const dataFiles = [
  'content_items.json',
  'watchlist.json',
  'approved_sources.json',
  'deep_dives.json',
  'expert_commentary.json',
  'weekly_summary.json',
  'monthly_summary.json',
  'daily_summary.json',
  'daily_summaries_archive.json',
  'weekly_summaries_archive.json',
  'monthly_summaries_archive.json',
  'qa.json',
  'internal_partners.json'
];
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
