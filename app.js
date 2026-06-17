/**
 * Payments Intelligence — app.js
 * Vanilla JS, no frameworks. Single-page with section switching,
 * daily/weekly/monthly tabs, and paginated summary cards.
 */

/* ─── State ─────────────────────────────────────────────────── */
const state = {
  activeSection: 'executive',
  currentTab: 'daily',
  indices: { daily: 0, weekly: 0, monthly: 0 },
  data: {
    daily: [],
    weekly: [],
    monthly: [],
    deepDives: [],
    expert: [],
    sources: [],
    watchlist: [],
    partners: [],
  },
  loaded: {
    executive: false,
    deepdives: false,
    expert: false,
    reference: false,
    partners: false,
  },
};

/* ─── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initSummaryTabs();
  initPagination();

  // Start loading executive data immediately (default section)
  await loadExecutiveData();
  renderSummary();
  state.loaded.executive = true;
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
  // Update nav pills
  document.querySelectorAll('.nav-pill').forEach(btn => {
    const active = btn.dataset.section === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  // Update section visibility
  document.querySelectorAll('.section').forEach(sec => {
    const match = sec.id === `section-${name}`;
    sec.hidden = !match;
    sec.classList.toggle('active', match);
  });

  state.activeSection = name;

  // Lazy-load section data
  if (!state.loaded[name]) {
    await loadSection(name);
    state.loaded[name] = true;
  }
}

/* ─── Load executive (summary) data ─────────────────────────── */
async function loadExecutiveData() {
  try {
    const [daily, weekly, monthly] = await Promise.all([
      fetchJSON('data/daily_summaries_archive.json'),
      fetchJSON('data/weekly_summaries_archive.json'),
      fetchJSON('data/monthly_summaries_archive.json'),
    ]);

    // Store newest-first (JSON is already newest-first but normalise)
    state.data.daily = Array.isArray(daily) ? daily : [];
    state.data.weekly = Array.isArray(weekly) ? weekly : [];
    state.data.monthly = Array.isArray(monthly) ? monthly : [];
  } catch (err) {
    console.error('Failed to load summary data:', err);
  }
}

/* ─── Lazy section loaders ───────────────────────────────────── */
async function loadSection(name) {
  switch (name) {
    case 'deepdives':
      await loadDeepDives();
      break;
    case 'expert':
      await loadExpert();
      break;
    case 'reference':
      await loadReference();
      break;
    case 'partners':
      await loadPartners();
      break;
  }
}

async function loadDeepDives() {
  try {
    const data = await fetchJSON('data/deep_dives.json');
    state.data.deepDives = Array.isArray(data) ? data : [];
    renderDeepDives();
  } catch (err) {
    console.error('Failed to load deep dives:', err);
    document.getElementById('deepdives-container').innerHTML =
      '<div class="loading-msg">Unable to load deep dives.</div>';
  }
}

async function loadExpert() {
  try {
    const data = await fetchJSON('data/expert_commentary.json');
    state.data.expert = Array.isArray(data) ? data : [];
    renderExpert();
  } catch (err) {
    console.error('Failed to load expert commentary:', err);
    document.getElementById('expert-container').innerHTML =
      '<div class="loading-msg">Unable to load expert commentary.</div>';
  }
}

async function loadReference() {
  try {
    const [sources, watchlist] = await Promise.all([
      fetchJSON('data/approved_sources.json'),
      fetchJSON('data/watchlist.json'),
    ]);
    state.data.sources = Array.isArray(sources) ? sources : [];
    state.data.watchlist = Array.isArray(watchlist) ? watchlist : [];
    renderReference();
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

async function loadPartners() {
  try {
    const data = await fetchJSON('data/internal_partners.json');
    // internal_partners.json may be an object {groups:[]} or a flat array
    state.data.partners = data;
    renderPartners();
  } catch (err) {
    console.error('Failed to load partner data:', err);
    document.getElementById('partners-container').innerHTML =
      '<div class="loading-msg">Unable to load partner data.</div>';
  }
}

/* ─── Summary tabs ───────────────────────────────────────────── */
function initSummaryTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === state.currentTab) return;

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
  document.getElementById('prev-btn').addEventListener('click', () => {
    const key = state.currentTab;
    const len = state.data[key].length;
    if (state.indices[key] < len - 1) {
      state.indices[key]++;
      renderSummary();
    }
  });

  document.getElementById('next-btn').addEventListener('click', () => {
    const key = state.currentTab;
    if (state.indices[key] > 0) {
      state.indices[key]--;
      renderSummary();
    }
  });
}

/* ─── Render summary ─────────────────────────────────────────── */
function renderSummary() {
  const tab = state.currentTab;
  const summaries = state.data[tab];
  const index = state.indices[tab];

  // Update period label
  const labels = { daily: 'Daily Summary', weekly: 'Weekly Summary', monthly: 'Monthly Review' };
  document.getElementById('period-label').textContent = labels[tab] || 'Summary';

  if (!summaries || summaries.length === 0) {
    document.getElementById('summary-headline').textContent = 'No summaries available';
    document.getElementById('summary-date').textContent = '—';
    document.getElementById('summary-body').innerHTML =
      '<p>Summary data is loading or unavailable.</p>';
    document.getElementById('current-date').textContent = 'N/A';
    updatePaginationUI();
    return;
  }

  const item = summaries[index];
  const headline = item.headline || item.title || 'Summary';
  const body = item.summary || item.body || '';
  const dateStr = item.date || item.publishedAt || '';
  const formatted = formatDate(dateStr, tab);

  document.getElementById('summary-headline').textContent = headline;
  // id="summary-date" is the in-card date display
  document.getElementById('summary-date').textContent = formatted;
  // id="current-date" is the nav bar date
  document.getElementById('current-date').textContent = formatted;
  document.getElementById('summary-body').innerHTML = formatBody(body);

  loadArticles(item);
  renderSources(item);
  updatePaginationUI();
}

/* ─── Render helpers ─────────────────────────────────────────── */
function formatDate(dateStr, period) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    if (period === 'monthly') {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
    return d.toLocaleDateString('en-US', opts);
  } catch {
    return dateStr;
  }
}

function formatBody(text) {
  if (!text) return '<p>No content available.</p>';
  const lines = text.split('\n\n');
  return lines.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('## ')) {
      return `<h3>${escapeHtml(trimmed.slice(3))}</h3>`;
    }
    if (trimmed.startsWith('- ')) {
      const items = trimmed.split('\n')
        .filter(l => l.startsWith('- '))
        .map(l => `<li>${escapeHtml(l.slice(2))}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }
    return `<p>${escapeHtml(trimmed)}</p>`;
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

/* ─── Article loader ─────────────────────────────────────────── */
async function loadArticles(item) {
  const container = document.getElementById('articles-container');
  container.innerHTML = '';

  if (!item.sources || item.sources.length === 0) return;

  try {
    const sources = await fetchJSON('data/approved_sources.json');
    item.sources.forEach(id => {
      const src = sources.find(s => s.id === id);
      if (!src) return;
      const card = document.createElement('div');
      card.className = 'article-card';
      card.innerHTML = `
        <div class="article-title">${escapeHtml(src.name || src.institution || '')}</div>
        <div class="article-source">${escapeHtml(src.category || 'Source')}</div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load articles:', err);
  }
}

/* ─── Sources renderer ───────────────────────────────────────── */
async function renderSources(item) {
  const container = document.getElementById('sources-list');
  container.innerHTML = '';

  if (!item.sources || item.sources.length === 0) {
    container.classList.add('empty');
    container.innerHTML = '<div>No sources linked to this summary</div>';
    return;
  }

  try {
    const sources = await fetchJSON('data/approved_sources.json');
    const sourceItems = item.sources
      .map(id => sources.find(s => s.id === id))
      .filter(Boolean);

    if (sourceItems.length === 0) {
      container.classList.add('empty');
      container.innerHTML = '<div>No sources linked to this summary</div>';
      return;
    }

    container.classList.remove('empty');
    sourceItems.forEach(src => {
      const link = document.createElement('a');
      link.className = 'source-link';
      link.href = src.url || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      const iconLetter = (src.id || '').charAt(0).toUpperCase();

      link.innerHTML = `
        <div class="source-link-icon">${escapeHtml(iconLetter)}</div>
        <div class="source-link-content">
          <div class="source-link-name">${escapeHtml(src.name || '')}</div>
          <div class="source-link-category">${escapeHtml(src.category || 'Source')}</div>
        </div>
      `;

      container.appendChild(link);
    });
  } catch (err) {
    console.error('Failed to render sources:', err);
    container.innerHTML = '<div class="loading-msg">Error loading sources.</div>';
  }
}

/* ─── Pagination UI state ────────────────────────────────────── */
function updatePaginationUI() {
  const tab = state.currentTab;
  const len = state.data[tab].length;
  const idx = state.indices[tab];

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  prevBtn.disabled = idx >= len - 1;
  nextBtn.disabled = idx <= 0;
}

/* ─── Deep Dives renderer ────────────────────────────────────── */
function renderDeepDives() {
  const container = document.getElementById('deepdives-container');
  if (!state.data.deepDives.length) {
    container.innerHTML = '<div class="loading-msg">No deep dives available.</div>';
    return;
  }
  container.innerHTML = state.data.deepDives.map(item => contentCard(item)).join('');
}

/* ─── Expert Commentary renderer ─────────────────────────────── */
function renderExpert() {
  const container = document.getElementById('expert-container');
  if (!state.data.expert.length) {
    container.innerHTML = '<div class="loading-msg">No expert commentary available.</div>';
    return;
  }
  container.innerHTML = state.data.expert.map(item => contentCard(item)).join('');
}

/* ─── Shared content card template ──────────────────────────── */
function contentCard(item) {
  const tier = escapeHtml(item.sourceTier || '');
  const type = escapeHtml(item.intelligenceType || '');
  const band = item.priorityBand || 'medium';
  const bandLabel = band === 'high' ? 'High Priority' : band === 'medium' ? 'Medium' : band;
  const date = item.publishedAt || item.collectedAt || '';

  const takeaway = item.businessImpact || item.businessTakeaway || '';

  return `
    <div class="content-card">
      <div class="card-eyebrow">
        ${tier ? `<span class="card-tag card-tag-tier1">${tier}</span>` : ''}
        ${type ? `<span class="card-tag card-tag-type">${type}</span>` : ''}
        <span class="card-tag card-tag-band-${band}">${bandLabel}</span>
      </div>
      <div class="card-title">${escapeHtml(item.title || '')}</div>
      <div class="card-source">${escapeHtml(item.sourceName || '')}</div>
      <div class="card-summary">${escapeHtml(item.summary || '')}</div>
      ${takeaway ? `
        <div class="card-impact">
          <div class="card-impact-label">Business Impact</div>
          ${escapeHtml(takeaway)}
        </div>
      ` : ''}
      ${date ? `<div class="card-date">${formatDate(date, 'daily')}</div>` : ''}
    </div>
  `;
}

/* ─── Reference library renderer ────────────────────────────── */
function renderReference() {
  const sourcesEl = document.getElementById('ref-sources-container');
  const watchlistEl = document.getElementById('watchlist-container');

  if (state.data.sources.length) {
    sourcesEl.innerHTML = state.data.sources.map(s => `
      <div class="ref-item">
        <div class="ref-item-name">
          ${escapeHtml(s.name || s.institution || s.sourceName || '')}
          ${s.tier ? `<span class="ref-item-tier">${escapeHtml(s.tier)}</span>` : ''}
        </div>
        <div class="ref-item-meta">${escapeHtml(s.category || s.type || '')}</div>
      </div>
    `).join('');
  } else {
    sourcesEl.innerHTML = '<div class="loading-msg">No sources available.</div>';
  }

  if (state.data.watchlist.length) {
    watchlistEl.innerHTML = state.data.watchlist.map(w => `
      <div class="ref-item">
        <div class="ref-item-name">${escapeHtml(w.name || w.company || w.entity || '')}</div>
        <div class="ref-item-meta">${escapeHtml(w.category || w.reason || w.type || '')}</div>
      </div>
    `).join('');
  } else {
    watchlistEl.innerHTML = '<div class="loading-msg">No watchlist entries.</div>';
  }
}

/* ─── Partner inputs renderer ────────────────────────────────── */
function renderPartners() {
  const container = document.getElementById('partners-container');
  // internal_partners.json is an object with a `groups` array
  const raw = state.data.partners;
  const groups = Array.isArray(raw) ? raw : (raw && raw.groups ? raw.groups : []);

  if (!groups.length) {
    container.innerHTML = '<div class="loading-msg">No partner data available.</div>';
    return;
  }

  const statusLabel = { pending: 'Pending', 'not-connected': 'Not Connected', active: 'Active' };
  const statusColor = { pending: '#7a5500', 'not-connected': '#526883', active: '#0f6640' };

  container.innerHTML = groups.map(p => {
    const status = p.status || 'pending';
    const color = statusColor[status] || '#526883';
    const label = statusLabel[status] || status;
    return `
      <div class="content-card">
        <div class="card-eyebrow">
          <span class="card-tag card-tag-type">${escapeHtml(p.format || 'Input Feed')}</span>
          <span class="card-tag" style="background:rgba(0,0,0,0.05);color:${color}">${label}</span>
        </div>
        <div class="card-title">${escapeHtml(p.name || '')}</div>
        <div class="card-source">${escapeHtml(p.frequency || '')}</div>
        <div class="card-summary">${escapeHtml(p.description || '')}</div>
        ${p.statusNote ? `
          <div class="card-impact">
            <div class="card-impact-label">Status Note</div>
            ${escapeHtml(p.statusNote)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/* ─── Fetch utility ──────────────────────────────────────────── */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
