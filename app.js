const IS_PUBLIC = !window.location.hostname.includes('localhost');

// ─── Section display names ───────────────────────────────────────────────────
const SECTION_NAMES = {
  'daily':      'Daily Intelligence Brief',
  'deep-dives': 'Deep Dives',
  'expert':     'Expert Commentary',
  'reference':  'Reference Library',
  'partners':   'Partner Inputs',
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

  if (IS_PUBLIC) setPublicMode();
});

// ─── Sidebar / hamburger ──────────────────────────────────────────────────────
function setupSidebar() {
  const shell     = document.getElementById('app-shell');
  const hamburger = document.getElementById('hamburger');
  const overlay   = document.getElementById('sidebar-overlay');

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
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      showTab(btn.dataset.tab);
      if (window.innerWidth < 768) closeSidebar();
    });
  });
}

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    el.removeAttribute('aria-current');
  });

  const section = document.getElementById(tabName);
  if (section) section.classList.add('active');

  const navBtn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
    navBtn.setAttribute('aria-current', 'page');
  }

  const titleEl = document.getElementById('topbar-section-title');
  if (titleEl) titleEl.textContent = SECTION_NAMES[tabName] || tabName;

  if      (tabName === 'daily')       loadAndRenderDailyBrief();
  else if (tabName === 'deep-dives')  loadAndRenderDeepDives();
  else if (tabName === 'expert')      loadAndRenderExpert();
  else if (tabName === 'reference')   loadAndRenderReference();
  else if (tabName === 'partners')    loadAndRenderPartners();
}

// ─── Date / time helpers ──────────────────────────────────────────────────────
function updateTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function updateSidebarTimestamp() {
  const el = document.getElementById('sidebar-timestamp');
  if (!el) return;
  const now  = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  el.textContent = `${date} · ${time}`;
}

// ─── Data loading ─────────────────────────────────────────────────────────────
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(md) {
  if (!md) return '';

  // Collapse blank lines between consecutive list items of the same type
  md = md.replace(/^(\d+\..+)\n\n(?=\d+\.)/gm, '$1\n');
  md = md.replace(/^([-*]\s.+)\n\n(?=[-*]\s)/gm, '$1\n');

  const inline = t =>
    t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
     .replace(/`(.+?)`/g, '<code>$1</code>');

  const lines     = md.split('\n');
  const out       = [];
  let   listBuf   = [];
  let   listType  = '';
  let   tableBuf  = [];

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(`<${listType}>${listBuf.join('')}</${listType}>`);
    listBuf = []; listType = '';
  };

  const parseCells = row => {
    const p = row.split('|');
    if (p[0].trim() === '') p.shift();
    if (p.length && p[p.length - 1].trim() === '') p.pop();
    return p.map(c => c.trim());
  };

  const flushTable = () => {
    if (!tableBuf.length) return;
    const dataRows = tableBuf.filter(r => !r.replace(/\|/g, '').trim().match(/^[-:\s]+$/));
    if (!dataRows.length) { tableBuf = []; return; }
    const [hdr, ...body] = dataRows;
    let tbl = '<table><thead><tr>' +
      parseCells(hdr).map(h => `<th>${inline(h)}</th>`).join('') +
      '</tr></thead><tbody>';
    body.forEach(r => {
      tbl += '<tr>' + parseCells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
    });
    tbl += '</tbody></table>';
    out.push(tbl);
    tableBuf = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushList(); flushTable();
      out.push(`<h3>${inline(line.slice(3))}</h3>`);
    } else if (line.startsWith('### ')) {
      flushList(); flushTable();
      out.push(`<h4>${inline(line.slice(4))}</h4>`);
    } else if (line.match(/^\d+\.\s/)) {
      flushTable();
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuf.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
    } else if (line.match(/^[-*]\s/)) {
      flushTable();
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuf.push(`<li>${inline(line.replace(/^[-*]\s/, ''))}</li>`);
    } else if (line.startsWith('|')) {
      flushList();
      tableBuf.push(line);
    } else if (line.trim() === '') {
      flushList(); flushTable();
    } else {
      flushList(); flushTable();
      out.push(`<p>${inline(line)}</p>`);
    }
  }

  flushList(); flushTable();
  return out.join('');
}

// ─── Daily Intelligence Brief ─────────────────────────────────────────────────
async function loadAndRenderDailyBrief() {
  // Load all data
  const items    = await loadJSON('/api/content-items') || await loadJSON('./data/content_items.json') || [];
  const daily    = await loadJSON('/api/summary/daily') || await loadJSON('./data/daily_summary.json');
  const weekly   = await loadJSON('/api/summary/weekly') || await loadJSON('./data/weekly_summary.json');
  const monthly  = await loadJSON('/api/summary/monthly') || await loadJSON('./data/monthly_summary.json');

  // Render summaries
  renderSummarySection('daily-summary', daily);
  renderSummarySection('weekly-summary', weekly);
  renderSummarySection('monthly-summary', monthly);

  // Update today's date
  const todayEl = document.getElementById('today-date');
  if (todayEl) {
    todayEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Render detailed feed
  const filtered  = filterItems(items);
  const container = document.getElementById('feed-container');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No articles match your search.</div>';
    return;
  }

  filtered.forEach(item => container.appendChild(createCardElement(item)));
}

// Helper to render summary sections
function renderSummarySection(elId, data) {
  const el = document.getElementById(elId);
  if (!el || !data) {
    if (el) el.innerHTML = '<div class="summary-placeholder">Summary not yet available.</div>';
    return;
  }
  let html = '';
  if (data.period)   html += `<div class="summary-period">${data.period}</div>`;
  if (data.headline) html += `<div class="summary-headline">${data.headline}</div>`;
  html += renderMarkdown(data.summary || '');
  if (data.authorNote) html += `<div class="summary-author-note">${data.authorNote}</div>`;
  el.innerHTML = html;
}

// ─── Daily Feed (legacy - kept for compatibility) ────────────────────────────
async function loadAndRenderFeed() {
  await loadAndRenderDailyBrief();
}

function filterItems(items) {
  const search = (document.getElementById('search')?.value || '').toLowerCase().trim();
  if (!search) return items;
  return items.filter(item =>
    (item.title || '').toLowerCase().includes(search) ||
    (item.summary || '').toLowerCase().includes(search) ||
    (item.businessImpact || '').toLowerCase().includes(search)
  );
}

// ─── Card builder ─────────────────────────────────────────────────────────────
function createCardElement(item, options = {}) {
  const card = document.createElement('article');
  card.className = 'card' + (item.priorityBand ? ` priority-${item.priorityBand}` : '');

  const intelLabels = {
    threat:      '⚠ Competitive Threat',
    opportunity: '↑ Growth Opportunity',
    expansion:   '◈ Market Expansion',
    regulatory:  '§ Regulatory Alert'
  };

  const intelBadge = item.intelligenceType && intelLabels[item.intelligenceType]
    ? `<span class="intel-badge intel-${item.intelligenceType}">${intelLabels[item.intelligenceType]}</span>`
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

  const metaParts = [
    date             ? `<span>${date}</span>` : '',
    (date && item.sourceName) ? `<span class="sep">·</span>` : '',
    item.sourceName  ? `<span>${item.sourceName}</span>` : '',
    item.rail        ? `<span class="sep">·</span><span>${item.rail}</span>` : ''
  ].filter(Boolean).join('');

  const businessImpactHtml = item.businessImpact
    ? `<div class="business-impact"><span class="business-impact-label">Business Impact</span>${item.businessImpact}</div>`
    : '';

  const takeaways = [
    item.technicalTakeaway && `<div class="takeaway"><span class="takeaway-label">Technical</span>${item.technicalTakeaway}</div>`,
    item.businessTakeaway  && `<div class="takeaway"><span class="takeaway-label">Business</span>${item.businessTakeaway}</div>`,
    item.treasuryTakeaway  && `<div class="takeaway"><span class="takeaway-label">Treasury</span>${item.treasuryTakeaway}</div>`
  ].filter(Boolean);

  const takeawaysHtml = takeaways.length
    ? `<div class="takeaways-grid">${takeaways.join('')}</div>`
    : '';

  const tagsHtml = item.tags?.length
    ? `<div class="tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
    : '';

  const bodyHtml = options.showBody && item.body
    ? `<div class="deep-dive-body">${renderMarkdown(item.body)}</div>`
    : '';

  const sourceLink = item.sourceUrl
    ? `<a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link">
        Read article
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
      </a>`
    : '';

  card.innerHTML = `
    <div class="card-inner">
      ${commentaryBadge}
      ${intelBadge}
      <div class="card-header">
        <div class="card-title">${item.title}</div>
        <div class="card-meta">${metaParts}</div>
      </div>
      ${businessImpactHtml}
      <p class="card-summary">${item.summary}</p>
      ${bodyHtml}
      ${takeawaysHtml}
      ${tagsHtml}
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

  const renderSummary = (data, elId) => {
    const el = document.getElementById(elId);
    if (!el || !data) return;
    let html = '';
    if (data.period)   html += `<div class="summary-period">${data.period}</div>`;
    if (data.headline) html += `<div class="summary-headline">${data.headline}</div>`;
    html += renderMarkdown(data.summary || '');
    if (data.authorNote) html += `<div class="summary-author-note">${data.authorNote}</div>`;
    el.innerHTML = html;
  };

  renderSummary(weekly,  'weekly-summary');
  renderSummary(monthly, 'monthly-summary');
}

// ─── Deep Dives ───────────────────────────────────────────────────────────────
async function loadAndRenderDeepDives() {
  const items     = await loadJSON('/api/deep-dives') || await loadJSON('./data/deep_dives.json') || [];
  const container = document.getElementById('deep-dives-container');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">No deep dives available yet.</div>';
    return;
  }

  items.forEach(item => container.appendChild(createCardElement(item, { showBody: true })));
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
  const sources   = await loadJSON('/api/approved-sources') || await loadJSON('./data/approved_sources.json');
  const container = document.getElementById('sources-container');
  container.innerHTML = '';

  if (!sources) {
    container.innerHTML = '<div class="empty-state">Sources not available.</div>';
    return;
  }

  const tiers = { 'Tier 1': [], 'Tier 2': [] };
  sources.forEach(s => { if (tiers[s.tier]) tiers[s.tier].push(s); });

  Object.entries(tiers).forEach(([tier, items]) => {
    if (!items.length) return;
    const section = document.createElement('div');
    section.className = 'tier-section';
    section.innerHTML = `<div class="tier-heading">${tier}</div><div class="sources-grid"></div>`;
    const grid = section.querySelector('.sources-grid');
    items.forEach(s => {
      const d = document.createElement('div');
      d.className = 'source-item';
      d.innerHTML = `<h4>${s.name}</h4><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.url}</a>`;
      grid.appendChild(d);
    });
    container.appendChild(section);
  });
}

// ─── Expert Commentary ────────────────────────────────────────────────────────
async function loadAndRenderExpert() {
  const items     = await loadJSON('/api/expert-commentary') || await loadJSON('./data/expert_commentary.json') || [];
  const container = document.getElementById('expert-container');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">No expert commentary available.</div>';
    return;
  }

  items.forEach(item => container.appendChild(createCardElement(item, { isCommentary: true })));
}

// ─── Q&A ─────────────────────────────────────────────────────────────────────
async function loadAndRenderQA() {
  const qa        = await loadJSON('./data/qa.json') || [];
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

// ─── Reference Library (Watchlist + Sources + Q&A) ──────────────────────────
async function loadAndRenderReference() {
  await loadAndRenderWatchlist();
  await loadAndRenderSources();
  await loadAndRenderQA();
}

// ─── Partner Inputs ───────────────────────────────────────────────────────────
async function loadAndRenderPartners() {
  const data      = await loadJSON('./data/internal_partners.json');
  const container = document.getElementById('partners-container');
  container.innerHTML = '';

  if (!data?.groups?.length) {
    container.innerHTML = '<div class="empty-state">No partner inputs configured.</div>';
    return;
  }

  const statusLabels = {
    'pending':       'In Progress',
    'connected':     'Connected',
    'not-connected': 'Not Connected'
  };

  data.groups.forEach(group => {
    const card        = document.createElement('div');
    card.className    = 'partner-card';
    const statusKey   = group.status || 'not-connected';
    const statusClass = `partner-status-${statusKey}`;
    const statusLabel = statusLabels[statusKey] || 'Not Connected';

    card.innerHTML = `
      <div class="partner-name">${group.name}</div>
      <span class="partner-status-badge ${statusClass}">${statusLabel}</span>
      <div class="partner-desc">${group.description}</div>
      <div class="partner-meta">
        <span>Format: ${group.format}</span>
        <span>Frequency: ${group.frequency}</span>
      </div>
      ${group.statusNote ? `<div class="partner-note">${group.statusNote}</div>` : ''}
    `;
    container.appendChild(card);
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────
function setupFilters() {
  const el = document.getElementById('search');
  if (el) el.addEventListener('input', loadAndRenderFeed);
}

// ─── Submit form ──────────────────────────────────────────────────────────────
function setupSubmitForm() {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const articleUrl = document.getElementById('submit-url').value.trim();
    const title      = document.getElementById('submit-title').value.trim()   || '';
    const summary    = document.getElementById('submit-summary').value.trim() || '';

    if (!articleUrl) { alert('Please enter a URL'); return; }

    const original = btn.textContent;
    btn.textContent = 'Synthesizing…';
    btn.disabled = true;

    try {
      const res  = await fetch('/api/submissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: articleUrl, title, summary })
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Article added to feed');
        document.getElementById('submit-url').value     = '';
        document.getElementById('submit-title').value   = '';
        document.getElementById('submit-summary').value = '';
        // Refresh the feed so the new item appears immediately
        await loadAndRenderFeed();
      } else {
        alert('Error: ' + (data.error || 'Submission failed'));
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    }

    btn.textContent = original;
    btn.disabled = false;
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
  const styles = {
    pending: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    success: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    error:   { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }
  };
  const s = styles[type] || styles.pending;
  el.style.background = s.bg;
  el.style.color      = s.color;
  el.style.border     = `1px solid ${s.border}`;
}

// ─── Public mode ──────────────────────────────────────────────────────────────
function setPublicMode() {
  const opsNav = document.getElementById('ops-nav');
  if (opsNav) opsNav.style.display = 'none';

  const opsSection = document.getElementById('ops');
  if (opsSection) opsSection.style.display = 'none';
}
