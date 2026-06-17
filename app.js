const IS_PUBLIC = !window.location.hostname.includes('localhost');

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadAndRenderFeed();
  setupFilters();
  setupSubmitForm();
  setupMonitor();

  if (IS_PUBLIC) {
    setPublicMode();
  }
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      showTab(tabName);
    });
  });
}

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  const tab = document.getElementById(tabName);
  if (tab) {
    tab.classList.add('active');
  }

  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) {
    btn.classList.add('active');
  }

  if (tabName === 'daily') {
    loadAndRenderFeed();
  } else if (tabName === 'archive') {
    loadAndRenderArchive();
  } else if (tabName === 'deep-dives') {
    loadAndRenderDeepDives();
  } else if (tabName === 'watchlist') {
    loadAndRenderWatchlist();
  } else if (tabName === 'sources') {
    loadAndRenderSources();
  } else if (tabName === 'expert') {
    loadAndRenderExpert();
  } else if (tabName === 'qa') {
    loadAndRenderQA();
  }
}

async function loadJSON(path) {
  try {
    const response = await fetch(path);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

async function loadAndRenderFeed() {
  const items = await loadJSON('/api/content-items') || await loadJSON('./data/content_items.json') || [];
  const filtered = filterItems(items);
  const container = document.getElementById('feed-container');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No items to display</p>';
    return;
  }

  filtered.forEach(item => {
    container.appendChild(createCardElement(item));
  });
}

function filterItems(items) {
  const search = document.getElementById('search')?.value || '';
  const rail = document.getElementById('rail-filter')?.value || '';
  const priority = document.getElementById('priority-filter')?.value || '';

  return items.filter(item => {
    const matchSearch = !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.summary.toLowerCase().includes(search.toLowerCase());
    const matchRail = !rail || item.rail === rail;
    const matchPriority = !priority || item.priorityBand === priority;
    return matchSearch && matchRail && matchPriority;
  });
}

function createCardElement(item) {
  const card = document.createElement('div');
  card.className = 'card';

  const tierBadge = `<span class="badge badge-tier-${item.sourceTier === 'Tier 1' ? '1' : '2'}">
    ${item.sourceTier}
  </span>`;

  const priorityBadge = `<span class="badge badge-${item.priorityBand}">
    ${item.priorityBand}
  </span>`;

  const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'N/A';

  let takeaways = '';
  if (item.technicalTakeaway) {
    takeaways += `<div class="takeaway">
      <span class="takeaway-label">Technical:</span> ${item.technicalTakeaway}
    </div>`;
  }
  if (item.businessTakeaway) {
    takeaways += `<div class="takeaway">
      <span class="takeaway-label">Business:</span> ${item.businessTakeaway}
    </div>`;
  }
  if (item.treasuryTakeaway) {
    takeaways += `<div class="takeaway">
      <span class="takeaway-label">Treasury:</span> ${item.treasuryTakeaway}
    </div>`;
  }

  const tags = item.tags ? item.tags.map(t => `<span class="tag">${t}</span>`).join('') : '';

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${item.title}</div>
        <div class="card-meta">
          <span>${date}</span>
          <span>${item.sourceName}</span>
          <span>${item.rail}</span>
          ${tierBadge}
          ${priorityBadge}
        </div>
      </div>
    </div>
    <p>${item.summary}</p>
    ${takeaways}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link">
      → Read Full Article
    </a>
  `;

  return card;
}

async function loadAndRenderArchive() {
  const weekly = await loadJSON('/api/summary/weekly') || await loadJSON('./data/weekly_summary.json');
  const monthly = await loadJSON('/api/summary/monthly') || await loadJSON('./data/monthly_summary.json');

  if (weekly) {
    document.getElementById('weekly-summary').innerHTML = `<p>${weekly.summary}</p>`;
  }
  if (monthly) {
    document.getElementById('monthly-summary').innerHTML = `<p>${monthly.summary}</p>`;
  }
}

async function loadAndRenderDeepDives() {
  const items = await loadJSON('/api/deep-dives') || await loadJSON('./data/deep_dives.json') || [];
  const container = document.getElementById('deep-dives-container');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<p style="color: #999;">No deep dives available yet</p>';
    return;
  }

  items.forEach(item => {
    container.appendChild(createCardElement(item));
  });
}

async function loadAndRenderWatchlist() {
  const watchlist = await loadJSON('/api/watchlist') || await loadJSON('./data/watchlist.json');
  const container = document.getElementById('watchlist-container');
  container.innerHTML = '';

  if (!watchlist || !watchlist.categories) {
    container.innerHTML = '<p style="color: #999;">Watchlist not available</p>';
    return;
  }

  watchlist.categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'watchlist-category';
    div.innerHTML = `
      <h4>${cat.name}</h4>
      <div class="watchlist-items">
        ${cat.entities.map(e => `<div class="watchlist-item">${e}</div>`).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}

async function loadAndRenderSources() {
  const sources = await loadJSON('/api/approved-sources') || await loadJSON('./data/approved_sources.json');
  const container = document.getElementById('sources-container');
  container.innerHTML = '';

  if (!sources) {
    container.innerHTML = '<p style="color: #999;">Sources not available</p>';
    return;
  }

  const tierGroups = { 'Tier 1': [], 'Tier 2': [] };
  sources.forEach(s => {
    if (tierGroups[s.tier]) {
      tierGroups[s.tier].push(s);
    }
  });

  Object.entries(tierGroups).forEach(([tier, items]) => {
    if (items.length > 0) {
      const div = document.createElement('div');
      div.innerHTML = `<h3 style="grid-column: 1/-1; margin-top: 1rem; margin-bottom: 1rem;">${tier}</h3>`;
      container.appendChild(div);

      items.forEach(source => {
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'source-item';
        sourceDiv.innerHTML = `
          <h4>${source.name}</h4>
          <a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.url}</a>
        `;
        container.appendChild(sourceDiv);
      });
    }
  });
}

async function loadAndRenderExpert() {
  const items = await loadJSON('/api/expert-commentary') || await loadJSON('./data/expert_commentary.json') || [];
  const container = document.getElementById('expert-container');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<p style="color: #999;">No expert commentary available</p>';
    return;
  }

  items.forEach(item => {
    container.appendChild(createCardElement(item));
  });
}

async function loadAndRenderQA() {
  const qa = await loadJSON('./data/qa.json') || [];
  const container = document.getElementById('qa-container');
  container.innerHTML = '';

  qa.forEach(item => {
    const div = document.createElement('div');
    div.style.marginBottom = '1.5rem';
    div.innerHTML = `
      <h4 style="color: var(--primary); margin-bottom: 0.5rem;">${item.question}</h4>
      <p style="color: var(--gray-700);">${item.answer}</p>
    `;
    container.appendChild(div);
  });
}

function setupFilters() {
  const search = document.getElementById('search');
  const railFilter = document.getElementById('rail-filter');
  const priorityFilter = document.getElementById('priority-filter');

  [search, railFilter, priorityFilter].forEach(el => {
    if (el) {
      el.addEventListener('change', loadAndRenderFeed);
      el.addEventListener('input', loadAndRenderFeed);
    }
  });
}

function setupSubmitForm() {
  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const url = document.getElementById('submit-url').value;
      const title = document.getElementById('submit-title').value || '';
      const summary = document.getElementById('submit-summary').value || '';

      if (!url) {
        alert('Please enter a URL');
        return;
      }

      try {
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, title, summary })
        });

        if (res.ok) {
          alert('Submission received');
          document.getElementById('submit-url').value = '';
          document.getElementById('submit-title').value = '';
          document.getElementById('submit-summary').value = '';
        }
      } catch (e) {
        console.error('Submission error:', e);
      }
    });
  }
}

function setupMonitor() {
  const btn = document.getElementById('run-monitor');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const status = document.getElementById('monitor-status');
      status.textContent = 'Running source monitor...';
      status.style.background = '#fff3cd';
      status.style.color = '#856404';

      try {
        const res = await fetch('/api/run-monitor', { method: 'POST' });
        if (res.ok) {
          status.textContent = 'Monitor completed successfully';
          status.style.background = '#d4edda';
          status.style.color = '#155724';
          await loadAndRenderFeed();
        } else {
          status.textContent = 'Monitor error';
          status.style.background = '#f8d7da';
          status.style.color = '#721c24';
        }
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
        status.style.background = '#f8d7da';
        status.style.color = '#721c24';
      }
      btn.disabled = false;
    });
  }
}

function setPublicMode() {
  document.getElementById('ops-tab').style.display = 'none';
  const opsTab = document.getElementById('ops');
  if (opsTab) {
    opsTab.style.display = 'none';
  }
  document.querySelector('.public-note').style.display = 'block';
}
