const viewerState = {
  activeTab: 'calc',
  query: '',
  activeIndex: 0
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatJsonContent(content) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content || '';
  }
}

function getActiveContentEl() {
  return document.querySelector('.viewer-content.active');
}

function setContent(element, content) {
  if (!element) return;
  const text = content || '';
  element.dataset.rawContent = text;
  element.textContent = text;
}

function getMatches(text, query) {
  if (!query) return [];
  const normalizedText = String(text || '').toLowerCase();
  const normalizedQuery = String(query || '').toLowerCase();
  const matches = [];
  let index = normalizedText.indexOf(normalizedQuery);
  while (index !== -1) {
    matches.push({ index, end: index + query.length });
    index = normalizedText.indexOf(normalizedQuery, index + Math.max(query.length, 1));
  }
  return matches;
}

function renderSearch() {
  const contentEl = getActiveContentEl();
  const countEl = document.getElementById('viewerSearchCount');
  if (!contentEl) return;

  const rawContent = contentEl.dataset.rawContent || contentEl.textContent || '';
  const matches = getMatches(rawContent, viewerState.query);
  if (!viewerState.query || !matches.length) {
    contentEl.textContent = rawContent;
    if (countEl) countEl.textContent = '0 matches';
    return;
  }

  if (viewerState.activeIndex >= matches.length) viewerState.activeIndex = 0;
  if (viewerState.activeIndex < 0) viewerState.activeIndex = matches.length - 1;

  let html = '';
  let cursor = 0;
  matches.forEach((match, index) => {
    html += escapeHtml(rawContent.slice(cursor, match.index));
    html += `<mark class="calc-modal-search-match ${index === viewerState.activeIndex ? 'active' : ''}">${escapeHtml(rawContent.slice(match.index, match.end))}</mark>`;
    cursor = match.end;
  });
  html += escapeHtml(rawContent.slice(cursor));
  contentEl.innerHTML = html;
  if (countEl) countEl.textContent = `${viewerState.activeIndex + 1} of ${matches.length}`;
  contentEl.querySelector('.calc-modal-search-match.active')?.scrollIntoView({ block: 'center', inline: 'nearest' });
}

function updateSearch(query) {
  viewerState.query = query || '';
  viewerState.activeIndex = 0;
  renderSearch();
}

function stepSearch(delta) {
  const contentEl = getActiveContentEl();
  const rawContent = contentEl?.dataset.rawContent || '';
  const matches = getMatches(rawContent, viewerState.query);
  if (!matches.length) return;
  viewerState.activeIndex = (viewerState.activeIndex + delta + matches.length) % matches.length;
  renderSearch();
}

function setTab(tabKey) {
  viewerState.activeTab = tabKey === 'unitTest' ? 'unitTest' : 'calc';
  document.querySelectorAll('[data-viewer-tab]').forEach(tab => {
    const active = tab.dataset.viewerTab === viewerState.activeTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.viewer-content').forEach(pane => {
    const active = viewerState.activeTab === 'calc'
      ? pane.id === 'viewerCalcContent'
      : pane.id === 'viewerTestContent';
    pane.classList.toggle('active', active);
  });
  const pathEl = document.getElementById('viewerPath');
  if (pathEl) pathEl.textContent = viewerState.activeTab === 'calc' ? pathEl.dataset.calcPath || '' : pathEl.dataset.unitTestPath || '';
  renderSearch();
}

function loadReviewFiles(result) {
  const pathEl = document.getElementById('viewerPath');
  const calcContent = document.getElementById('viewerCalcContent');
  const testContent = document.getElementById('viewerTestContent');

  if (!result?.success) {
    setContent(calcContent, `Could not open review files: ${result?.message || 'Unknown error'}`);
    setContent(testContent, '');
    return;
  }

  if (pathEl) {
    pathEl.dataset.calcPath = result.calc?.relativePath || result.calc?.filePath || '';
    pathEl.dataset.unitTestPath = result.unitTest?.relativePath || result.unitTest?.filePath || '';
  }
  setContent(calcContent, formatJsonContent(result.calc?.content));
  setContent(testContent, formatJsonContent(result.unitTest?.content));
  setTab('calc');
}

function bindEvents() {
  document.querySelectorAll('[data-viewer-tab]').forEach(tab => {
    tab.addEventListener('click', () => setTab(tab.dataset.viewerTab));
  });
  const searchInput = document.getElementById('viewerSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', event => updateSearch(event.target.value));
    searchInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      stepSearch(event.shiftKey ? -1 : 1);
    });
  }
  document.getElementById('viewerSearchPrevBtn')?.addEventListener('click', () => stepSearch(-1));
  document.getElementById('viewerSearchNextBtn')?.addEventListener('click', () => stepSearch(1));
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });
  window.api?.onUnitTestReviewFilesLoaded?.(loadReviewFiles);
}

bindEvents();
