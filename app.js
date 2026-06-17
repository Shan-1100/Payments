const IS_PUBLIC = !window.location.hostname.includes('localhost');

// ─── Section display names ───────────────────────────────────────────────────
const SECTION_NAMES = {
  'daily':      'Daily Feed',
  'archive':    'Archive',
  'deep-dives': 'Deep Dives',
  'watchlist':  'Watchlist',
  'sources':    'Sources',
  'expert':     'Expert Commentary',
  'qa':         'Q&A',
  'ops':        'Operations'
};

document.addEventListener('DOMContentLoaded', async () => {
  setupSidebar();
  setupNav();
  updateTopbarDate();
  updateSidebarTimestamp();
  setInterval(updateSidebarTimestamp, 60 * 1000);

  await loadAndRenderFeed();
  setupFilters();
  setupSubmitForm();
  setupMonitor();

  if (IS_PUBLIC) {
    setPublicMode();
  }
});

// ─── Sidebar / hamburger ──────────────────────────────────────────────────────
function setupSidebar() {
  const shell    = document.getElementById('app-shell');
  const hamburger = document.getElementById('hamburger');
  const overlay  = document.getElementById('sidebar-overlay');

  hamburger.addEventListener('click', () => {
    const isOpen = shell.classList.toggle('sidebar-open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
    overlay.setAttribute('aria-hidden', String(!isOpen));
  });

  overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  const shell     = document.getElementById('app-shell');
  const hamburger = document.getElementById('hamburger');
  const overlay   = document.getElementById('sidebar-overlay');
  shell.classList.remove('sidebar-open');
  hamburger.setAttribute('aria-expanded', 'false');
  overlay.setAttribute('aria-hidden', 'true');
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function setupNav() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      showTab(tabName);
      // Close sidebar on mobile after nav tap
      if (window.innerWidth < 768) {
        closeSidebar();
      }
    });
  });
}

function showTab(tabName) {
  // Hide all sections
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    el.removeAttribute('aria-current');
  });

  // Show target section
  const section = document.getElementById(tabName);
  if (section) section.classList.add('active');

  // Activate nav item
  const navBtn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
    navBtn.setAttribute('aria-current', 'page');
  }

  // Update topbar title
  const titleEl = document.getElementById('topbar-section-title');
  if (titleEl) titleEl.textContent = SECTION_NAMES[tabName] || tabName;

  // Load section data
  if (tabName === 'daily')      loadAndRenderFeed();
  else if (tabName === 'archive')    loadAndRenderArchive();
  else if (tabName === 'deep-dives') loadAndRenderDeepDives();
  else if (tabName === 'watchlist')  loadAndRenderWatchlist();
  else if (tabName === 'sources')    loadAndRenderSources();
  else if (tabName === 'expert')     loadAndRenderExpert();
  else if (tabName === 'qa')         loadAndRenderQA();
}

// ─── Date/time helpers ────────────────────────────────────────────────────────
function updateTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function updateSidebarTimestamp() {
  const el = document.getElementById('sidebar-timestamp');
  if (!el) return;
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  el.textContent = `${date} · ${time}`;
}

// ─── Data loading ─────────────────────────────────────────────────────────────
async function loadJSON(path) {
  try {
    const response = await fetch(path);
    if (response.ok) return await response.json();
    return null;
  } catch {
    return null;
  }
}

// ─── Daily Feed ───────────────────────────────────────────────────────────────
async function loadAndRenderFeed() {
  const items = await loadJSON('/api/content-items') || await loadJSON('./data/content_items.json') || [];
  const filtered = filterItems(items);
  const container = document.getElementById('feed-container');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No items match your filters.</div>';
    return;
  }

  filtered.forEach(item => container.appendChild(createCardElement(item)));
}

function filterItems(items) {
  const search   = document.getElementById('search')?.value?.toLowerCase() || '';
  const rail     = document.getElementById('rail-filter')?.value || '';
  const priority = document.getElementById('priority-filter')?.value || '';

  return items.filter(item => {
    const matchSearch   = !search ||
      item.title.toLowerCase().includes(search) ||
      item.summary.toLowerCase().includes(search);
    const matchRail     = !rail || item.rail === rail;
    const matchPriority = !priority || item.priorityBand === priority;
    return matchSearch && matchRail && matchPriority;
  });
}

// ─── Card builder ─────────────────────────────────────────────────────────────
function createCardElement(item, options = {}) {
  const card = document.createElement('article');
  card.className = 'card' + (item.priorityBand ? ` priority-${item.priorityBand}` : '');

  const tierBadge     = `<span class="badge badge-tier-${item.sourceTier === 'Tier 1' ? '1' : '2'}">${item.sourceTier || ''}</span>`;
  const priorityBadge = item.priorityBand
    ? `<span class="badge badge-${item.priorityBand}">${cap(item.priorityBand)}</span>`
    : '';
  const commentaryBadge = options.isCommentary
    ? `<span class="card-commentary-label">
        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
        Commentary
      </span>`
    : '';

  const date = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const takeawayItems = [
    item.technicalTakeaway && `<div class="takeaway"><span class="takeaway-label">Technical</span>${item.technicalTakeaway}</div>`,
    item.businessTakeaway  && `<div class="takeaway"><span class="takeaway-label">Business</span>${item.businessTakeaway}</div>`,
    item.treasuryTakeaway  && `<div class="takeaway"><span class="takeaway-label">Treasury</span>${item.treasuryTakeaway}</div>`
  ].filter(Boolean);

  const takeaways = takeawayItems.length
    ? `<div class="takeaways-grid">${takeawayItems.join('')}</div>`
    : '';

  const tags = item.tags?.length
    ? `<div class="tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
    : '';

  const sourceLink = item.sourceUrl
    ? `<a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link">
        Read article
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
      </a>`
    : '';

  const metaParts = [
    date ? `<span>${date}</span>` : '',
    date && item.sourceName ? `<span class="sep">·</span>` : '',
    item.sourceName ? `<span>${item.sourceName}</span>` : '',
    item.rail ? `<span class="sep">·</span><span>${item.rail}</span>` : '',
    item.sourceTier ? `<span class="sep">·</span>${tierBadge}` : '',
    priorityBadge ? ` ${priorityBadge}` : ''
  ].filter(Boolean).join('');

  card.innerHTML = `
    <div class="card-inner">
      ${commentaryBadge}
      <div class="card-header">
        <div class="card-title">${item.title}</div>
        <div class="card-meta">${metaParts}</div>
      </div>
      <p class="card-summary">${item.summary}</p>
      ${takeaways}
      ${tags}
    </div>
    ${sourceLink ? `<div class="card-footer">${sourceLink}</div>` : ''}
  `;

  return card;
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Archive ──────────────────────────────────────────────────────────────────
async function loadAndRenderArchive() {
  const weekly  = await loadJSON('/api/summary/weekly')  || await loadJSON('./data/weekly_summary.json');
  const monthly = await loadJSON('/api/summary/monthly') || await loadJSON('./data/monthly_summary.json');

  if (weekly)  document.getElementById('weekly-summary').innerHTML  = `<p>${weekly.summary}</p>`;
  if (monthly) document.getElementById('monthly-summary').innerHTML = `<p>${monthly.summary}</p>`;
}

// ─── Deep Dives ───────────────────────────────────────────────────────────────
async function loadAndRenderDeepDives() {
  const items = await loadJSON('/api/deep-dives') || await loadJSON('./data/deep_dives.json') || [];
  const container = document.getElementById('deep-dives-container');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">No deep dives available yet.</div>';
    return;
  }

  items.forEach(item => container.appendChild(createCardElement(item)));
}

// ─── Watchlist ────────────────────────────────────────────────────────────────
async function loadAndRenderWatchlist() {
  const watchlist = await loadJSON('/api/watchlist') || await loadJSON('./data/watchlist.json');
  const container = document.getElementById('watchlist-container');
  container.innerHTML = '';

  if (!watchlist?.categories) {
    container.innerHTML = '<div class="empty-state">Watchlist not available.</div>';
    return;
  }

  watchlist.categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'watchlist-category';
    div.innerHTML = `
      <div class="watchlist-category-name">${cat.name}</div>
      <div class="watchlist-items">
        ${cat.entities.map(e => `<div class="watchlist-item">${e}</div>`).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}

// ─── Sources ──────────────────────────────────────────────────────────────────
async function loadAndRenderSources() {
  const sources = await loadJSON('/api/approved-sources') || await loadJSON('./data/approved_sources.json');
  const container = document.getElementById('sources-container');
  container.innerHTML = '';

  if (!sources) {
    container.innerHTML = '<div class="empty-state">Sources not available.</div>';
    return;
  }

  const tierGroups = { 'Tier 1': [], 'Tier 2': [] };
  sources.forEach(s => { if (tierGroups[s.tier]) tierGroups[s.tier].push(s); });

  Object.entries(tierGroups).forEach(([tier, items]) => {
    if (items.length === 0) return;

    const section = document.createElement('div');
    section.className = 'tier-section';
    section.innerHTML = `<div class="tier-heading">${tier}</div><div class="sources-grid"></div>`;
    const grid = section.querySelector('.sources-grid');

    items.forEach(source => {
      const sourceDiv = document.createElement('div');
      sourceDiv.className = 'source-item';
      sourceDiv.innerHTML = `
        <h4>${source.name}</h4>
        <a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.url}</a>
      `;
      grid.appendChild(sourceDiv);
    });

    container.appendChild(section);
  });
}

// ─── Expert Commentary ────────────────────────────────────────────────────────
async function loadAndRenderExpert() {
  const items = await loadJSON('/api/expert-commentary') || await loadJSON('./data/expert_commentary.json') || [];
  const container = document.getElementById('expert-container');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">No expert commentary available.</div>';
    return;
  }

  items.forEach(item => container.appendChild(createCardElement(item, { isCommentary: true })));
}

// ─── Q&A (accordion) ─────────────────────────────────────────────────────────
async function loadAndRenderQA() {
  const qa = await loadJSON('./data/qa.json') || [];
  const container = document.getElementById('qa-container');
  container.innerHTML = '';

  if (qa.length === 0) {
    container.innerHTML = '<div class="empty-state">No Q&A entries yet.</div>';
    return;
  }

  qa.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    div.innerHTML = `
      <button class="qa-question" aria-expanded="false" aria-controls="qa-answer-${idx}" id="qa-q-${idx}">
        <span class="qa-question-text">${item.question}</span>
        <svg class="qa-chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
      <div class="qa-answer" id="qa-answer-${idx}" role="region" aria-labelledby="qa-q-${idx}">
        <p>${item.answer}</p>
      </div>
    `;

    div.querySelector('.qa-question').addEventListener('click', () => {
      const isOpen = div.classList.toggle('open');
      div.querySelector('.qa-question').setAttribute('aria-expanded', String(isOpen));
    });

    container.appendChild(div);
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────
function setupFilters() {
  ['search', 'rail-filter', 'priority-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', loadAndRenderFeed);
      el.addEventListener('input',  loadAndRenderFeed);
    }
  });
}

// ─── Submit form ──────────────────────────────────────────────────────────────
function setupSubmitForm() {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const url     = document.getElementById('submit-url').value;
    const title   = document.getElementById('submit-title').value || '';
    const summary = document.getElementById('submit-summary').value || '';

    if (!url) { alert('Please enter a URL'); return; }

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, summary })
      });
      if (res.ok) {
        alert('Submission received');
        document.getElementById('submit-url').value     = '';
        document.getElementById('submit-title').value   = '';
        document.getElementById('submit-summary').value = '';
      }
    } catch (e) {
      console.error('Submission error:', e);
    }
  });
}

// ─── Source monitor ───────────────────────────────────────────────────────────
function setupMonitor() {
  const btn = document.getElementById('run-monitor');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const status = document.getElementById('monitor-status');
    setStatus(status, 'Running source monitor…', 'pending');

    try {
      const res = await fetch('/api/run-monitor', { method: 'POST' });
      if (res.ok) {
        setStatus(status, 'Monitor completed successfully.', 'success');
        await loadAndRenderFeed();
      } else {
        setStatus(status, 'Monitor returned an error.', 'error');
      }
    } catch (e) {
      setStatus(status, 'Error: ' + e.message, 'error');
    }
    btn.disabled = false;
  });
}

function setStatus(el, text, type) {
  el.textContent = text;
  const map = {
    pending: { bg: '#fffbeb', color: '#92400e' },
    success: { bg: '#f0fdf4', color: '#166534' },
    error:   { bg: '#fef2f2', color: '#991b1b' }
  };
  const style = map[type] || map.pending;
  el.style.background = style.bg;
  el.style.color      = style.color;
  el.style.border     = `1px solid ${type === 'success' ? '#bbf7d0' : type === 'error' ? '#fecaca' : '#fde68a'}`;
}

// ─── Public mode ──────────────────────────────────────────────────────────────
function setPublicMode() {
  const opsNav = document.getElementById('ops-nav');
  if (opsNav) opsNav.style.display = 'none';

  const opsSection = document.getElementById('ops');
  if (opsSection) opsSection.style.display = 'none';

  const badge = document.getElementById('topbar-public-badge');
  if (badge) badge.style.display = 'inline-flex';

  const footerNote = document.getElementById('footer-public-note');
  if (footerNote) footerNote.style.display = 'inline';
}
