// State management
let state = {
  currentTab: 'daily',
  currentDailyIndex: 0,
  currentWeeklyIndex: 0,
  currentMonthlyIndex: 0,
  dailySummaries: [],
  weeklySummaries: [],
  monthlySummaries: [],
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await loadSummaryData();
  setupTabListeners();
  setupPaginationListeners();
  renderSummary();
});

// Load summary data from JSON files
async function loadSummaryData() {
  try {
    const [daily, weekly, monthly] = await Promise.all([
      fetch('data/daily_summaries_archive.json').then(r => r.json()),
      fetch('data/weekly_summaries_archive.json').then(r => r.json()),
      fetch('data/monthly_summaries_archive.json').then(r => r.json()),
    ]);

    state.dailySummaries = Array.isArray(daily) ? daily.reverse() : [];
    state.weeklySummaries = Array.isArray(weekly) ? weekly.reverse() : [];
    state.monthlySummaries = Array.isArray(monthly) ? monthly.reverse() : [];
  } catch (error) {
    console.error('Error loading summaries:', error);
    state.dailySummaries = [];
    state.weeklySummaries = [];
    state.monthlySummaries = [];
  }
}

// Setup tab listeners
function setupTabListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === state.currentTab) return;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTab = tab;
      renderSummary();
    });
  });

  // Set initial active tab
  document.querySelector('[data-tab="daily"]').classList.add('active');
}

// Setup pagination listeners
function setupPaginationListeners() {
  document.getElementById('prev-btn').addEventListener('click', () => {
    const summaries = getCurrentSummaries();
    if (summaries.length === 0) return;

    const key = state.currentTab === 'daily' ? 'currentDailyIndex' :
                state.currentTab === 'weekly' ? 'currentWeeklyIndex' :
                'currentMonthlyIndex';
    if (state[key] < summaries.length - 1) {
      state[key]++;
      renderSummary();
    }
  });

  document.getElementById('next-btn').addEventListener('click', () => {
    const key = state.currentTab === 'daily' ? 'currentDailyIndex' :
                state.currentTab === 'weekly' ? 'currentWeeklyIndex' :
                'currentMonthlyIndex';
    if (state[key] > 0) {
      state[key]--;
      renderSummary();
    }
  });
}

// Get current summaries based on tab
function getCurrentSummaries() {
  switch (state.currentTab) {
    case 'daily':
      return state.dailySummaries;
    case 'weekly':
      return state.weeklySummaries;
    case 'monthly':
      return state.monthlySummaries;
    default:
      return [];
  }
}

// Get current index
function getCurrentIndex() {
  switch (state.currentTab) {
    case 'daily':
      return state.currentDailyIndex;
    case 'weekly':
      return state.currentWeeklyIndex;
    case 'monthly':
      return state.currentMonthlyIndex;
    default:
      return 0;
  }
}

// Render current summary
function renderSummary() {
  const summaries = getCurrentSummaries();
  const index = getCurrentIndex();

  if (summaries.length === 0) {
    document.getElementById('summary-headline').textContent = 'No summaries available';
    document.getElementById('summary-date').textContent = '—';
    document.getElementById('summary-body').innerHTML = '<p>Loading summary data...</p>';
    document.getElementById('current-date').textContent = 'N/A';
    updatePaginationState();
    return;
  }

  const summary = summaries[index];
  const headline = summary.headline || summary.title || 'Summary';
  const body = summary.summary || summary.body || '';
  const date = summary.date || summary.publishedAt || new Date().toISOString();

  document.getElementById('summary-headline').textContent = headline;
  document.getElementById('summary-date').textContent = formatDate(date);
  document.getElementById('summary-body').innerHTML = formatBody(body);
  document.getElementById('current-date').textContent = formatDate(date);

  // Load related articles
  loadArticles(summary);
  updatePaginationState();
}

// Format date
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Format body text (handle markdown-like content)
function formatBody(text) {
  if (!text) return '<p>No content available</p>';

  let html = text
    .split('\n\n')
    .map(para => {
      if (para.startsWith('##')) {
        return `<h3>${para.replace('## ', '')}</h3>`;
      }
      if (para.startsWith('- ')) {
        const items = para.split('\n').filter(l => l.startsWith('- '));
        return `<ul>${items.map(item => `<li>${item.replace('- ', '')}</li>`).join('')}</ul>`;
      }
      return `<p>${para}</p>`;
    })
    .join('');

  return html;
}

// Load and display related articles
async function loadArticles(summary) {
  const container = document.getElementById('articles-container');
  container.innerHTML = '';

  if (!summary.sources || summary.sources.length === 0) {
    return;
  }

  try {
    const sources = await fetch('data/approved_sources.json').then(r => r.json());

    summary.sources.forEach(sourceId => {
      const source = sources.find(s => s.id === sourceId);
      if (source) {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.innerHTML = `
          <div class="article-title">${source.name || source.institution}</div>
          <div class="article-source">${source.category || 'Source'}</div>
        `;
        container.appendChild(card);
      }
    });
  } catch (error) {
    console.error('Error loading articles:', error);
  }
}

// Update pagination button states
function updatePaginationState() {
  const summaries = getCurrentSummaries();
  const index = getCurrentIndex();

  document.getElementById('prev-btn').disabled = index >= summaries.length - 1;
  document.getElementById('next-btn').disabled = index <= 0;

  // Add visual styling for disabled state
  if (index >= summaries.length - 1) {
    document.getElementById('prev-btn').style.opacity = '0.5';
    document.getElementById('prev-btn').style.cursor = 'not-allowed';
  } else {
    document.getElementById('prev-btn').style.opacity = '1';
    document.getElementById('prev-btn').style.cursor = 'pointer';
  }

  if (index <= 0) {
    document.getElementById('next-btn').style.opacity = '0.5';
    document.getElementById('next-btn').style.cursor = 'not-allowed';
  } else {
    document.getElementById('next-btn').style.opacity = '1';
    document.getElementById('next-btn').style.cursor = 'pointer';
  }
}
