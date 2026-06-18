# Instant Payments Intelligence Aggregator

A curated intelligence tool for banks and fintechs serving corporate treasury clients. Monitors RTP, FedNow, adjacent payment rails, regulatory developments, vendor announcements, and market activity.

**[→ See Success Criteria & Scope](SUCCESS_CRITERIA.md)** — Define mission, primary US focus (RTP/FedNow), secondary global scope, and repeatable monitoring cadence.

## Quick Start

### Local Development

```bash
# Start the server
node server.js

# Visit http://localhost:3000
```

### Environment Variables

- `PORT` - Server port (default: 3000)

## Architecture

### Files

- **index.html** - Page structure with tabs and sections
- **styles.css** - Bank of America blue theme, responsive design
- **app.js** - Client-side rendering, filtering, tab navigation
- **server.js** - Minimal Node HTTP server with JSON APIs
- **data/*.json** - All data storage (no database needed)
- **scripts/build-public-site.js** - Static export for GitHub Pages

### Data Model

Content items include:
- Title, summary, source attribution
- Source tier (Tier 1 official, Tier 2 publications)
- Rails: RTP, FedNow, Adjacent
- Technical/Business/Treasury takeaways
- Importance score (0-100) and priority band

### API Endpoints

- `GET /api/content-items` - All collected items
- `GET /api/daily-feed` - Today's items
- `GET /api/summary/weekly` - Weekly recap
- `GET /api/summary/monthly` - Monthly recap
- `GET /api/approved-sources` - Source library
- `GET /api/expert-commentary` - Expert analysis
- `GET /api/watchlist` - Entity watchlist
- `GET /api/deep-dives` - Strategic deep dives
- `POST /api/submissions` - URL/content submission
- `POST /api/run-monitor` - Trigger source monitoring

## Features

### Daily Feed
- Latest items with filtering by keyword, rail, and priority
- Source attribution with tier badges
- Three-part takeaways (technical/business/treasury)

### Archive
- Weekly and monthly recaps

### Watchlist
- Top U.S. banks, treasury providers, fintechs, core providers

### Deployment

```bash
# Local: Start server
node server.js

# Public: Build static site
npm run build-public
```

### Modes

**Local Mode** (http://localhost:3000):
- Full access, operations section visible
- URL submission enabled

**Public Mode** (dist/):
- Read-only static site
- Email submission CTA visible

## Token Efficiency

Built for lowest-cost Claude tier:
- Plain HTML/CSS/JS (no frameworks)
- Minimal dependencies
- Concise, simple code
- No runtime AI generation

## Product Rules

1. Never fabricate source content
2. Preserve direct attribution
3. Keep expert commentary separate
4. Official sources primary, publications secondary
5. Clean, executive design
6. Shareable across teams
