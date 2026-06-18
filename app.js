/**
 * Payments Intelligence Dashboard — app.js
 * Executive Intelligence Feed + Summaries + Analyst View
 */

/* ─── State ─────────────────────────────────────────────────── */
const state = {
  activeSection: 'intel-feed',
  currentTab: 'daily',
  currentAnalystTab: 'all-items',
  indices: { daily: 0, weekly: 0, monthly: 0 },
  data: {
    daily: [],
    weekly: [],
    monthly: [],
    deepDives: [],
    sources: [],
    watchlist: [],
    contentItems: [],
    suppressedItems: [],
    sourceHealth: [],
  },
  loaded: {
    'intel-feed': false,
    executive: false,
    deepdives: false,
    reference: false,
    analyst: false,
  },
};

/* ─── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initSummaryTabs();
  initPagination();
  initAnalystTabs();
  initIntelFilters();

  await loadIntelFeed();
  state.loaded['intel-feed'] = true;
});

/* ─── Section navigation ─────────────────────────────────────── */
function initNav() {
  document.querySelectorAll('.nav-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      if (target === state.activeSection) return;
      switchSection(target);
    });
  });
}

async function switchSection(name) {
  document.querySelectorAll('.nav-pill').forEach(btn => {
    const active = btn.dataset.section === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('.section').forEach(sec => {
    const match = sec.id === `section-${name}`;
    sec.hidden = !match;
    sec.classList.toggle('active', match);
  });

  state.activeSection = name;

  if (!state.loaded[name]) {
    await loadSection(name);
    state.loaded[name] = true;
  }
}

/* ─── Load intelligence feed (primary executive view) ─────────── */
async function loadIntelFeed() {
  try {
    const scored = (await fetchJSON('/api/scored-items').catch(() => ({ executiveItems: [], analystItems: [], suppressedItems: [] }))) || { executiveItems: [], analystItems: [], suppressedItems: [] };
    state.data.contentItems = [
      ...scored.executiveItems,
      ...scored.analystItems,
      ...scored.suppressedItems
    ];
  } catch {
    state.data.contentItems = [];
  }
  renderIntelFeed();
}

/* ─── Render intelligence feed ───────────────────────────────── */
function renderIntelFeed() {
  const container = document.getElementById('intel-feed-container');
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const railFilter    = document.getElementById('filter-rail')?.value    || 'all';
  const segmentFilter = document.getElementById('filter-segment')?.value || 'all';
  const impactFilter  = document.getElementById('filter-impact')?.value  || 'all';

  // Executive tier: non-suppressed, relevanceScore >= 4, last 14 days
  let items = state.data.contentItems.filter(i =>
    !i.suppressed &&
    (i.relevanceScore || 0) >= 4 &&
    new Date(i.publishedAt) >= fourteenDaysAgo
  );

  // Apply filters
  if (railFilter !== 'all')    items = items.filter(i => i.railRelevance === railFilter);
  if (segmentFilter !== 'all') items = items.filter(i => i.segment === segmentFilter || i.segment === 'Both');
  if (impactFilter !== 'all')  items = items.filter(i => i.strategicImpact === impactFilter);

  const countEl = document.getElementById('intel-item-count');
  if (countEl) countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

  if (!items.length) {
    container.innerHTML = `
      <div class="intel-empty">
        <p>No items match the current filters.</p>
        <p class="intel-empty-hint">The pipeline must run to populate this view. Run <code>npm run pipeline</code> to fetch and score articles.</p>
      </div>`;
    return;
  }

  // Group by strategicImpact → rail
  const grouped = {};
  for (const item of items) {
    const impact = item.strategicImpact || 'market signal';
    const rail   = item.railRelevance   || 'Other';
    const key    = impact;
    if (!grouped[key]) grouped[key] = { impact, items: [] };
    grouped[key].items.push(item);
  }

  // Sort groups by max relevanceScore descending
  const sortedGroups = Object.values(grouped).sort((a, b) => {
    const maxA = Math.max(...a.items.map(i => i.relevanceScore || 0));
    const maxB = Math.max(...b.items.map(i => i.relevanceScore || 0));
    return maxB - maxA;
  });

  container.innerHTML = sortedGroups.map(group => `
    <div class="intel-group">
      <div class="intel-group-label">${escapeHtml(humanizeImpact(group.impact))}</div>
      ${group.items
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .map(item => intelCard(item))
        .join('')}
    </div>
  `).join('');
}

function humanizeImpact(impact) {
  const labels = {
    'competitor launch':         'Competitor Launches',
    'rail adoption':             'Rail Adoption',
    'product expansion':         'Product Expansions',
    'regulatory shift':          'Regulatory Developments',
    'partnership':               'Partnerships',
    'pricing / economics':       'Pricing & Economics',
    'risk / fraud / compliance': 'Risk, Fraud & Compliance',
    'operational change':        'Operational Changes',
    'market signal':             'Market Signals',
    'expert analysis':           'Expert Analysis',
  };
  return labels[impact] || impact.replace(/\b\w/g, c => c.toUpperCase());
}

function intelCard(item) {
  const score   = item.relevanceScore || 0;
  const geo     = item.geography || '';
  const rail    = item.railRelevance || item.rail || '';
  const segment = item.segment || '';
  const conf    = item.confidence || '';
  const srcClass = item.sourceClass || '';
  const publisher = item.publisher || item.sourceName || item.monitoredSourceName || '';
  const url    = item.evidenceUrl || item.articleUrl || item.sourceUrl || '#';
  const date   = item.publishedAt ? formatDate(item.publishedAt, 'daily') : '';
  const actors = (item.mentionedActors || []).slice(0, 4);

  const scoreColor = score >= 5 ? '#0f6640' : score >= 4 ? '#1a7a52' : '#526883';
  const geoTag = geo === 'Global but US-relevant' ? 'Global→US' :
                 geo === 'US adjacent' ? 'US Adjacent' :
                 geo === 'US direct' ? 'US' : geo;

  return `
    <div class="intel-card">
      <div class="intel-card-eyebrow">
        <span class="intel-score" style="background:${scoreColor}" title="Relevance score: ${score}/5">${score}/5</span>
        ${rail ? `<span class="intel-tag intel-tag-rail">${escapeHtml(rail)}</span>` : ''}
        ${segment ? `<span class="intel-tag intel-tag-segment">${escapeHtml(segment)}</span>` : ''}
        ${geoTag ? `<span class="intel-tag intel-tag-geo">${escapeHtml(geoTag)}</span>` : ''}
        ${conf ? `<span class="intel-tag intel-tag-conf" title="Evidence confidence">${escapeHtml(conf)}</span>` : ''}
        ${srcClass ? `<span class="intel-tag intel-tag-srcclass">${escapeHtml(srcClass)}</span>` : ''}
      </div>
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="intel-card-title">
        ${escapeHtml(item.title || 'Untitled')}
      </a>
      <div class="intel-card-meta">
        <span class="intel-publisher">${escapeHtml(publisher)}</span>
        ${date ? `<span class="intel-date">${escapeHtml(date)}</span>` : ''}
      </div>
      ${item.whyItMatters ? `
        <div class="intel-why">
          <span class="intel-why-label">Why it matters</span>
          ${escapeHtml(item.whyItMatters)}
        </div>` : ''}
      ${actors.length ? `
        <div class="intel-actors">
          ${actors.map(a => `<span class="intel-actor-tag">${escapeHtml(a)}</span>`).join('')}
        </div>` : ''}
    </div>
  `;
}

/* ─── Intel filter event listeners ──────────────────────────── */
function initIntelFilters() {
  ['filter-rail', 'filter-segment', 'filter-impact'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderIntelFeed);
  });
}

/* ─── Section lazy-loaders ───────────────────────────────────── */
async function loadSection(name) {
  switch (name) {
    case 'executive':
      await loadExecutiveData();
      renderSummary();
      break;
    case 'deepdives':
      await loadDeepDives();
      break;
    case 'reference':
      await loadReference();
      break;
    case 'analyst':
      await loadAnalystView();
      break;
  }
}

async function loadExecutiveData() {
  try {
    const [daily, weekly, monthly] = await Promise.all([
      fetchJSON('data/daily_summaries_archive.json'),
      fetchJSON('data/weekly_summaries_archive.json'),
      fetchJSON('data/monthly_summaries_archive.json'),
    ]);
    state.data.daily   = Array.isArray(daily)   ? daily   : [];
    state.data.weekly  = Array.isArray(weekly)  ? weekly  : [];
    state.data.monthly = Array.isArray(monthly) ? monthly : [];
  } catch (err) {
    console.error('Failed to load summary data:', err);
  }
}

async function loadDeepDives() {
  try {
    const data = await fetchJSON('data/deep_dives.json');
    state.data.deepDives = Array.isArray(data) ? data : [];
    renderDeepDives();
  } catch (err) {
    document.getElementById('deepdives-container').innerHTML =
      '<div class="loading-msg">Unable to load deep dives.</div>';
  }
}

async function loadReference() {
  try {
    const [sources, watchlist] = await Promise.all([
      fetchJSON('data/approved_sources.json'),
      fetchJSON('data/watchlist.json'),
    ]);
    state.data.sources   = Array.isArray(sources)   ? sources   : [];
    state.data.watchlist = Array.isArray(watchlist) ? watchlist : [];
    renderReference();
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

async function loadAnalystView() {
  try {
    const [items, suppressed, health] = await Promise.all([
      fetchJSON('data/content_items.json').catch(() => []),
      fetchJSON('data/suppressed_items.json').catch(() => []),
      fetchJSON('data/source_health.json').catch(() => []),
    ]);
    state.data.contentItems    = Array.isArray(items)     ? items     : [];
    state.data.suppressedItems = Array.isArray(suppressed)? suppressed: [];
    state.data.sourceHealth    = Array.isArray(health)    ? health    : [];
  } catch (err) {
    console.error('Failed to load analyst data:', err);
  }
  renderAnalystTab(state.currentAnalystTab);
}

/* ─── Analyst tabs ───────────────────────────────────────────── */
function initAnalystTabs() {
  document.querySelectorAll('.analyst-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.analystTab;
      if (tab === state.currentAnalystTab) return;

      document.querySelectorAll('.analyst-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.analyst-panel').forEach(p => { p.hidden = true; });
      const panel = document.getElementById(`analyst-${tab}`);
      if (panel) panel.hidden = false;

      state.currentAnalystTab = tab;
      if (state.loaded.analyst) renderAnalystTab(tab);
    });
  });
}

function renderAnalystTab(tab) {
  if (tab === 'all-items')     renderAnalystAllItems();
  if (tab === 'suppressed')    renderAnalystSuppressed();
  if (tab === 'source-health') renderAnalystSourceHealth();
}

function renderAnalystAllItems() {
  const container = document.getElementById('analyst-all-items');
  const items = state.data.contentItems;

  if (!items.length) {
    container.innerHTML = '<div class="loading-msg">No scored items yet. Run <code>npm run pipeline</code>.</div>';
    return;
  }

  container.innerHTML = `
    <div class="analyst-summary-bar">
      <span>${items.length} total items</span>
      <span>${items.filter(i => (i.relevanceScore||0) >= 4).length} executive-tier (score ≥4)</span>
      <span>${items.filter(i => (i.relevanceScore||0) < 4).length} analyst-only (score &lt;4)</span>
    </div>
    ${items.map(item => analystItemRow(item)).join('')}
  `;
}

function renderAnalystSuppressed() {
  const container = document.getElementById('analyst-suppressed');
  const items = state.data.suppressedItems;

  if (!items.length) {
    container.innerHTML = '<div class="loading-msg">No suppressed items.</div>';
    return;
  }

  const reasonCounts = {};
  items.forEach(i => {
    const r = i.suppressionReason || 'unknown';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });

  container.innerHTML = `
    <div class="analyst-summary-bar">
      <span>${items.length} suppressed items</span>
      ${Object.entries(reasonCounts).map(([r, c]) => `<span>${c}× ${escapeHtml(r)}</span>`).join('')}
    </div>
    ${items.map(item => analystItemRow(item, true)).join('')}
  `;
}

function analystItemRow(item, showSuppression = false) {
  const score   = item.relevanceScore || 0;
  const rail    = item.railRelevance || item.rail || '—';
  const segment = item.segment || '—';
  const geo     = item.geography || '—';
  const conf    = item.confidence || '—';
  const impact  = item.strategicImpact || '—';
  const url     = item.evidenceUrl || item.articleUrl || item.sourceUrl || '#';
  const date    = item.publishedAt ? formatDate(item.publishedAt, 'daily') : '—';
  const publisher = item.publisher || item.sourceName || item.monitoredSourceName || '—';

  return `
    <div class="analyst-row ${score >= 4 ? 'analyst-row-exec' : ''}">
      <div class="analyst-row-header">
        <span class="analyst-score" title="Relevance score">${score}/5</span>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="analyst-title">${escapeHtml(item.title || 'Untitled')}</a>
        <span class="analyst-date">${escapeHtml(date)}</span>
      </div>
      <div class="analyst-row-meta">
        <span>${escapeHtml(publisher)}</span>
        <span>${escapeHtml(rail)}</span>
        <span>${escapeHtml(segment)}</span>
        <span>${escapeHtml(geo)}</span>
        <span>${escapeHtml(impact)}</span>
        <span>Conf: ${escapeHtml(conf)}</span>
      </div>
      ${item.whyItMatters ? `<div class="analyst-why">${escapeHtml(item.whyItMatters)}</div>` : ''}
      ${showSuppression && item.suppressionReason ? `
        <div class="analyst-suppressed-reason">Suppressed: ${escapeHtml(item.suppressionReason)}</div>` : ''}
    </div>
  `;
}

function renderAnalystSourceHealth() {
  const container = document.getElementById('analyst-source-health');
  const health = state.data.sourceHealth;

  if (!health.length) {
    container.innerHTML = '<div class="loading-msg">Source health data not yet available. Run <code>npm run pipeline</code>.</div>';
    return;
  }

  const working = health.filter(h => h.collectionStatus === 'Working');
  const failed  = health.filter(h => h.collectionStatus === 'Failed');
  const manual  = health.filter(h => h.collectionStatus === 'Manual Required');
  const untested = health.filter(h => h.collectionStatus === 'Untested');

  const statusColor = {
    'Working': '#0f6640',
    'Partial': '#7a5500',
    'Failed': '#c0392b',
    'Manual Required': '#526883',
    'Untested': '#888',
  };

  container.innerHTML = `
    <div class="analyst-summary-bar">
      <span class="health-stat health-working">${working.length} Working</span>
      <span class="health-stat health-failed">${failed.length} Failed</span>
      <span class="health-stat health-manual">${manual.length} Manual Required</span>
      <span class="health-stat health-untested">${untested.length} Untested</span>
    </div>
    <table class="source-health-table">
      <thead>
        <tr>
          <th>Source</th>
          <th>Class</th>
          <th>Method</th>
          <th>Status</th>
          <th>Last Checked</th>
          <th>Latest Article</th>
          <th>Failure Reason</th>
        </tr>
      </thead>
      <tbody>
        ${health.map(h => `
          <tr class="health-row health-row-${(h.collectionStatus || '').toLowerCase().replace(/\s+/g, '-')}">
            <td class="health-source-name">${escapeHtml(h.sourceName || '')}</td>
            <td><span class="health-class-tag">${escapeHtml(h.sourceClass || '')}</span></td>
            <td>${escapeHtml(h.collectionMethod || '')}</td>
            <td><span class="health-status-badge" style="color:${statusColor[h.collectionStatus] || '#888'}">${escapeHtml(h.collectionStatus || '')}</span></td>
            <td class="health-date">${h.lastCheckedAt ? formatDate(h.lastCheckedAt, 'daily') : '—'}</td>
            <td class="health-latest">${h.latestRetrievedUrl
              ? `<a href="${escapeHtml(h.latestRetrievedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml((h.latestRetrievedTitle || '').slice(0, 60))}</a>`
              : '—'}</td>
            <td class="health-failure">${escapeHtml(h.failureReason || '')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

/* ─── Summary tabs (Summaries section) ──────────────────────── */
function initSummaryTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab || tab === state.currentTab) return;

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      state.currentTab = tab;
      renderSummary();
    });
  });
}

/* ─── Pagination ─────────────────────────────────────────────── */
function initPagination() {
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    const key = state.currentTab;
    const len = state.data[key]?.length || 0;
    if (state.indices[key] < len - 1) {
      state.indices[key]++;
      renderSummary();
    }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    const key = state.currentTab;
    if (state.indices[key] > 0) {
      state.indices[key]--;
      renderSummary();
    }
  });
}

/* ─── Render summary ─────────────────────────────────────────── */
function renderSummary() {
  const tab      = state.currentTab;
  const summaries = state.data[tab];
  const index    = state.indices[tab];

  const labels = { daily: 'Daily Summary', weekly: 'Weekly Summary', monthly: 'Monthly Review' };
  document.getElementById('period-label').textContent = labels[tab] || 'Summary';

  if (!summaries || summaries.length === 0) {
    document.getElementById('summary-headline').textContent = 'No summaries available';
    document.getElementById('summary-date').textContent = '—';
    document.getElementById('summary-body').innerHTML = '<p>Navigate to Intelligence Feed above, or run the pipeline to populate summaries.</p>';
    document.getElementById('current-date').textContent = 'N/A';
    updatePaginationUI();
    return;
  }

  const item     = summaries[index];
  const dateStr  = item.date || item.publishedAt || '';
  const formatted = formatDate(dateStr, tab);

  if (item.briefs && typeof item.briefs === 'object') {
    document.getElementById('summary-headline').textContent = formatted;
    document.getElementById('summary-date').textContent = '';
    document.getElementById('current-date').textContent = formatted;

    let html = '';
    for (const [topic, content] of Object.entries(item.briefs)) {
      const links = content.sourceLinks || [];
      html += `<div class="brief-section">
        <h3 class="brief-topic">${escapeHtml(topic)}</h3>
        <p class="brief-text">${escapeHtml(content.brief)}</p>
        ${content.segments?.length ? `
          <div class="brief-segments">
            ${content.segments.map(s => `<span class="segment-tag segment-${s.toLowerCase()}">${s}</span>`).join('')}
          </div>` : ''}
        <div class="brief-sources">
          ${links.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="brief-source-link">${escapeHtml(s.name)} — ${escapeHtml(s.title)}</a>`).join('')}
        </div>
      </div>`;
    }
    document.getElementById('summary-body').innerHTML = html;
    document.getElementById('sources-container').style.display = 'none';
  } else {
    const headline = item.headline || item.title || 'Summary';
    const body     = item.summary  || item.body  || '';

    document.getElementById('summary-headline').textContent = headline;
    document.getElementById('summary-date').textContent = formatted;
    document.getElementById('current-date').textContent = formatted;
    document.getElementById('summary-body').innerHTML = formatBody(body);

    renderSources(item);
    document.getElementById('sources-container').style.display = '';
  }

  updatePaginationUI();
}

/* ─── Deep Dives renderer ────────────────────────────────────── */
function renderDeepDives() {
  const container = document.getElementById('deepdives-container');
  if (!state.data.deepDives.length) {
    container.innerHTML = '<div class="loading-msg">No deep dives available.</div>';
    return;
  }

  container.innerHTML = state.data.deepDives.map(dive => {
    const briefsHTML = (dive.relatedBriefs || []).slice(0, 8).map(brief => `
      <div class="brief-item">
        <div class="brief-header">
          <div class="brief-topic">${escapeHtml(brief.topic || 'Development')}</div>
          ${brief.segments ? `<div class="brief-segments">${brief.segments.map(s => `<span class="segment-tag segment-${s.toLowerCase()}">${s}</span>`).join('')}</div>` : ''}
        </div>
        <div class="brief-text">${escapeHtml(brief.brief?.slice(0, 300) || '')}</div>
        ${brief.links ? `<div class="brief-sources">${brief.links.slice(0, 3).map(l => `<a href="${escapeHtml(l.url)}" target="_blank" class="source-link">${escapeHtml(l.title || l.name)} →</a>`).join('')}</div>` : ''}
      </div>`).join('');

    return `<div class="content-card deep-dive-card">
      <div class="card-title">${escapeHtml(dive.title || '')}</div>
      <div class="card-summary">${escapeHtml(dive.summary || '')}</div>
      <div class="deep-dive-briefs">
        <div class="briefs-label">Key Developments (${dive.relatedBriefs?.length || 0} tracked)</div>
        ${briefsHTML}
      </div>
      ${dive.sourceList ? `<div class="dive-sources">Sources: ${escapeHtml(dive.sourceList.join(', '))}</div>` : ''}
    </div>`;
  }).join('');
}

/* ─── Reference library renderer ────────────────────────────── */
function renderReference() {
  const sourcesEl   = document.getElementById('ref-sources-container');
  const watchlistEl = document.getElementById('watchlist-container');

  const statusColor = { Working: '#0f6640', Failed: '#c0392b', 'Manual Required': '#526883', Untested: '#888' };

  if (state.data.sources.length) {
    sourcesEl.innerHTML = state.data.sources.map(s => `
      <div class="ref-item">
        <div class="ref-item-name">
          ${escapeHtml(s.name || '')}
          ${s.tier ? `<span class="ref-item-tier">${escapeHtml(s.tier)}</span>` : ''}
          ${s.sourceClass ? `<span class="ref-item-tier" style="background:#e8f4f0">${escapeHtml(s.sourceClass)}</span>` : ''}
        </div>
        <div class="ref-item-meta">${escapeHtml(s.category || '')}
          ${s.collectionStatus ? ` · <span style="color:${statusColor[s.collectionStatus]||'#888'}">${escapeHtml(s.collectionStatus)}</span>` : ''}
        </div>
      </div>`).join('');
  } else {
    sourcesEl.innerHTML = '<div class="loading-msg">No sources available.</div>';
  }

  if (state.data.watchlist.length) {
    watchlistEl.innerHTML = state.data.watchlist.map(w => `
      <div class="ref-item">
        <div class="ref-item-name">${escapeHtml(w.name || w.company || w.entity || '')}</div>
        <div class="ref-item-meta">${escapeHtml(w.category || w.reason || w.type || '')}</div>
      </div>`).join('');
  } else {
    watchlistEl.innerHTML = '<div class="loading-msg">No watchlist entries.</div>';
  }
}

/* ─── Sources renderer (summary section) ─────────────────────── */
async function renderSources(item) {
  const container = document.getElementById('sources-list');
  container.innerHTML = '';

  const links = item.sourceLinks;
  if (links && links.length > 0) {
    container.classList.remove('empty');
    container.innerHTML = '<ul class="source-inline-list">' +
      links.map(s => {
        const label = s.title ? `${escapeHtml(s.name)} — ${escapeHtml(s.title)}` : escapeHtml(s.name);
        return `<li><a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
      }).join('') + '</ul>';
    return;
  }

  if (!item.sources || item.sources.length === 0) {
    container.classList.add('empty');
    container.innerHTML = '<div>No sources linked to this summary</div>';
    return;
  }

  try {
    const sources = await fetchJSON('data/approved_sources.json');
    const sourceItems = item.sources.map(id => sources.find(s => s.id === id)).filter(Boolean);
    container.classList.remove('empty');
    container.innerHTML = '<ul class="source-inline-list">' +
      sourceItems.map(src =>
        `<li><a href="${escapeHtml(src.homepageUrl || src.url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.name || '')}</a></li>`
      ).join('') + '</ul>';
  } catch {
    container.innerHTML = '<div class="loading-msg">Error loading sources.</div>';
  }
}

/* ─── Pagination UI ──────────────────────────────────────────── */
function updatePaginationUI() {
  const tab = state.currentTab;
  const len = state.data[tab]?.length || 0;
  const idx = state.indices[tab];
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.disabled = idx >= len - 1;
  if (nextBtn) nextBtn.disabled = idx <= 0;
}

/* ─── Helpers ────────────────────────────────────────────────── */
function formatDate(dateStr, period) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    if (period === 'monthly') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
}

function formatBody(text) {
  if (!text) return '<p>No content available.</p>';
  return text.split('\n\n').map(block => {
    const t = block.trim();
    if (!t) return '';
    if (t.startsWith('## ')) return `<h3>${escapeHtml(t.slice(3))}</h3>`;
    if (t.startsWith('- ')) {
      const items = t.split('\n').filter(l => l.startsWith('- '))
        .map(l => `<li>${escapeHtml(l.slice(2))}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    // Render **bold** markdown
    const withBold = escapeHtml(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<p>${withBold}</p>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchJSON(url) {
  const sep     = url.includes('?') ? '&' : '?';
  const bustUrl = url.includes('data/') ? `${url}${sep}v=${Date.now()}` : url;
  const res     = await fetch(bustUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
