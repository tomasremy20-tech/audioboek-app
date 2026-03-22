// ===== Configuration =====
const MEDIA_TYPES = {
  boeken: { label: 'Boeken', singular: 'boek', makerLabel: 'Auteur', storageKey: 'audioboek-books', searchBase: 'https://nieuw.passendlezen.nl/zoeken?query=' },
  films: { label: 'Films', singular: 'film', makerLabel: 'Regisseur', storageKey: 'audioboek-films', searchBase: 'https://www.google.com/search?q=film+' },
  series: { label: 'Series', singular: 'serie', makerLabel: 'Maker', storageKey: 'audioboek-series', searchBase: 'https://www.google.com/search?q=serie+' }
};

const GENRES = {
  boeken: ['Thriller','Literaire fictie','Romantiek','Historische roman','Fantasy','Science fiction','Non-fictie','Biografie','Misdaadroman','Psychologische roman','Familieroman','Oorlogsroman','Avonturenroman','Humor','Young adult','Kinderboek','Anders'],
  films: ['Actie','Komedie','Drama','Thriller','Sci-fi','Horror','Romantiek','Documentaire','Animatie','Avontuur','Misdaad','Fantasy','Oorlog','Musical','Anders'],
  series: ['Drama','Komedie','Thriller','Misdaad','Sci-fi','Horror','Romantiek','Documentaire','Actie','Animatie','Fantasy','Reality','Anders']
};

// ===== State =====
let data = { boeken: [], films: [], series: [] };
let settings = {};
let currentPage = 'collectie';
let currentMedia = 'boeken';
let currentFilter = 'alle';
let currentItemId = null;
let importedBooks = [];
let deferredPrompt = null;
let selectedMood = '';
let tryNew = false;
let pendingReviewRating = null;

// ===== Page Titles =====
const pageTitles = {
  collectie: 'Mijn Collectie',
  toevoegen: 'Toevoegen',
  tips: 'Tips',
  instellingen: 'Instellingen'
};

// ===== Helpers =====
function cfg() { return MEDIA_TYPES[currentMedia]; }
function items() { return data[currentMedia]; }
function setItems(arr) { data[currentMedia] = arr; }

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadData();
  setupEventListeners();
  setupPWA();
  updateGenreDropdowns();
  renderCurrentPage();
  checkReminder();
  updateNotificationStatus();
}

function loadData() {
  try {
    for (const key of Object.keys(MEDIA_TYPES)) {
      data[key] = JSON.parse(localStorage.getItem(MEDIA_TYPES[key].storageKey) || '[]');
    }
    settings = JSON.parse(localStorage.getItem('audioboek-settings') || '{}');
  } catch (e) {
    data = { boeken: [], films: [], series: [] };
    settings = {};
  }
}

function saveItems() {
  localStorage.setItem(cfg().storageKey, JSON.stringify(items()));
}

function saveAllItems() {
  for (const key of Object.keys(MEDIA_TYPES)) {
    localStorage.setItem(MEDIA_TYPES[key].storageKey, JSON.stringify(data[key]));
  }
}

function saveSettings() {
  localStorage.setItem('audioboek-settings', JSON.stringify(settings));
}

// ===== Event Listeners =====
function setupEventListeners() {
  document.getElementById('form-add-item').addEventListener('submit', function(e) {
    e.preventDefault();
    const titel = document.getElementById('input-titel').value.trim();
    const maker = document.getElementById('input-maker').value.trim();
    const genre = document.getElementById('input-genre').value;
    if (titel && maker) {
      addItem(titel, maker, genre);
      this.reset();
      showToast(cfg().singular.charAt(0).toUpperCase() + cfg().singular.slice(1) + ' toegevoegd!');
    }
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      renderItems();
    });
  });

  document.getElementById('search-items').addEventListener('input', renderItems);

  document.getElementById('input-api-key').value = settings.claudeApiKey || '';
  const freqSelect = document.getElementById('input-reminder-freq');
  freqSelect.value = settings.herinneringsFrequentie !== undefined ? settings.herinneringsFrequentie : '3';
}

// ===== PWA Setup =====
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btn-install').style.display = 'flex';
  });
  document.getElementById('btn-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      document.getElementById('btn-install').style.display = 'none';
      deferredPrompt = null;
    }
  });
}

// ===== Media Type Switching =====
function switchMedia(type) {
  currentMedia = type;
  document.querySelectorAll('.media-chip').forEach(c => c.classList.remove('active'));
  document.querySelector(`.media-chip[data-media="${type}"]`).classList.add('active');
  updateGenreDropdowns();
  updatePageLabels();
  renderCurrentPage();
}

function updateGenreDropdowns() {
  const genres = GENRES[currentMedia] || [];
  const addGenre = document.getElementById('input-genre');
  addGenre.innerHTML = '<option value="">-- Kies een genre --</option>' +
    genres.map(g => `<option value="${g}">${g}</option>`).join('');

  const recGenre = document.getElementById('rec-genre');
  recGenre.innerHTML = '<option value="">Maakt niet uit</option>' +
    genres.map(g => `<option value="${g}">${g}</option>`).join('');
}

function updatePageLabels() {
  const c = cfg();
  document.getElementById('label-maker').textContent = c.makerLabel;
  document.getElementById('input-maker').placeholder = c.makerLabel;
  document.getElementById('add-form-title').textContent = c.singular.charAt(0).toUpperCase() + c.singular.slice(1) + ' toevoegen';
  document.getElementById('btn-add-item').textContent = 'Toevoegen';
  document.getElementById('import-section').style.display = currentMedia === 'boeken' ? 'block' : 'none';

  const tipWords = { boeken: 'luisteren', films: 'kijken', series: 'kijken' };
  document.getElementById('tips-title').textContent = `Wat wil je ${tipWords[currentMedia]}?`;
  document.getElementById('tips-subtitle').textContent = `Beantwoord een paar vragen en ik zoek de perfecte ${c.singular} voor je.`;
  document.getElementById('btn-rec-text').textContent = `Zoek voor mij`;

  document.getElementById('search-items').placeholder = `Zoek in je ${c.label.toLowerCase()}...`;
}

// ===== Navigation =====
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[page];

  // Show/hide media selector
  const showSelector = ['collectie', 'toevoegen', 'tips'].includes(page);
  document.getElementById('media-selector').style.display = showSelector ? 'flex' : 'none';

  updatePageLabels();
  renderCurrentPage();
  window.scrollTo(0, 0);
}

function renderCurrentPage() {
  switch (currentPage) {
    case 'collectie': renderItems(); break;
    case 'tips': renderTips(); break;
    case 'instellingen': updateNotificationStatus(); break;
  }
}

// ===== Item Management =====
function addItem(titel, maker, genre) {
  const item = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
    titel, auteur: maker, genre: genre || '',
    beoordeling: null, recensie: '',
    datumToegevoegd: new Date().toISOString()
  };
  items().push(item);
  saveItems();
}

function getFilteredItems() {
  let filtered = [...items()];
  const search = document.getElementById('search-items').value.toLowerCase().trim();

  switch (currentFilter) {
    case 'onbeoordeeld': filtered = filtered.filter(b => b.beoordeling === null); break;
    case 'onzeker': filtered = filtered.filter(b => b.beoordeling === 0); break;
    case 'beoordeeld': filtered = filtered.filter(b => b.beoordeling !== null && b.beoordeling !== 0); break;
  }

  if (search) {
    filtered = filtered.filter(b =>
      b.titel.toLowerCase().includes(search) ||
      b.auteur.toLowerCase().includes(search) ||
      (b.genre && b.genre.toLowerCase().includes(search))
    );
  }

  // Sort: unrated first (alphabetically by author), then rated by date
  filtered.sort((a, b) => {
    const aUnrated = a.beoordeling === null;
    const bUnrated = b.beoordeling === null;
    if (aUnrated && !bUnrated) return -1;
    if (!aUnrated && bUnrated) return 1;
    if (aUnrated && bUnrated) {
      return a.auteur.toLowerCase().localeCompare(b.auteur.toLowerCase());
    }
    return new Date(b.datumToegevoegd) - new Date(a.datumToegevoegd);
  });

  return filtered;
}

function renderItems() {
  const list = document.getElementById('items-list');
  const emptyState = document.getElementById('empty-state');
  const filtered = getFilteredItems();

  if (items().length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    document.getElementById('empty-state-text').textContent = `Nog geen ${cfg().label.toLowerCase()} toegevoegd`;
    return;
  }

  emptyState.style.display = 'none';

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Niets gevonden</p></div>';
    return;
  }

  list.innerHTML = filtered.map(item => {
    let ratingDisplay = '', ratingClass = 'rating-none';
    if (item.beoordeling === null) {
      ratingDisplay = '—'; ratingClass = 'rating-none';
    } else if (item.beoordeling === 0) {
      ratingDisplay = '?'; ratingClass = 'rating-unsure';
    } else if (item.beoordeling >= 8) {
      ratingDisplay = item.beoordeling; ratingClass = 'rating-high';
    } else if (item.beoordeling >= 6) {
      ratingDisplay = item.beoordeling; ratingClass = 'rating-mid';
    } else if (item.beoordeling >= 4) {
      ratingDisplay = item.beoordeling; ratingClass = 'rating-midlow';
    } else {
      ratingDisplay = item.beoordeling; ratingClass = 'rating-low';
    }
    const genreTag = item.genre ? `<span class="book-genre">${escapeHtml(item.genre)}</span>` : '';
    const reviewTag = item.recensie ? `<div class="book-review">"${escapeHtml(item.recensie)}"</div>` : '';
    return `
      <div class="book-card" onclick="openRatingModal('${item.id}')">
        <div class="book-info">
          <div class="book-title">${escapeHtml(item.titel)}</div>
          <div class="book-author">${escapeHtml(item.auteur)}</div>
          ${genreTag}${reviewTag}
        </div>
        <div class="book-rating ${ratingClass}">${ratingDisplay}</div>
      </div>
    `;
  }).join('');
}

// ===== Rating Modal =====
function openRatingModal(itemId) {
  currentItemId = itemId;
  const item = items().find(b => b.id === itemId);
  if (!item) return;

  document.getElementById('modal-item-title').textContent = item.titel;
  document.getElementById('modal-item-maker').textContent = item.auteur + (item.genre ? ' · ' + item.genre : '');
  document.getElementById('modal-review').value = item.recensie || '';

  document.querySelectorAll('.modal-content .rating-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', item.beoordeling === i + 1);
  });
  document.querySelector('.btn-unsure').classList.toggle('selected', item.beoordeling === 0);

  document.getElementById('rating-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeRatingModal() {
  document.getElementById('rating-modal').style.display = 'none';
  document.body.style.overflow = '';
  currentItemId = null;
}

function rateItem(rating) {
  if (!currentItemId) return;
  const item = items().find(b => b.id === currentItemId);
  if (!item) return;

  item.beoordeling = rating;
  item.datumBeoordeeld = new Date().toISOString();
  item.recensie = document.getElementById('modal-review').value.trim();
  saveItems();
  closeRatingModal();
  renderItems();

  const label = rating === 0 ? 'Onzeker' : rating + '/10';
  showToast(`"${item.titel}" beoordeeld: ${label}`);
}

function deleteCurrentItem() {
  if (!currentItemId) return;
  const item = items().find(b => b.id === currentItemId);
  if (!item) return;

  if (confirm(`Weet je zeker dat je "${item.titel}" wilt verwijderen?`)) {
    setItems(items().filter(b => b.id !== currentItemId));
    saveItems();
    closeRatingModal();
    renderItems();
    showToast('Verwijderd');
  }
}

// ===== Import =====
function switchImportTab(tab, el) {
  document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('import-tab-csv').style.display = tab === 'csv' ? 'block' : 'none';
  document.getElementById('import-tab-text').style.display = tab === 'text' ? 'block' : 'none';
}

function parseCsvFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    importedBooks = [];

    // Detect separator (comma or semicolon)
    const sep = lines[0] && lines[0].includes(';') ? ';' : ',';

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      // Skip header row
      const firstLower = cols[0].toLowerCase();
      if (i === 0 && (firstLower === 'auteur' || firstLower === 'titel' || firstLower === 'author' || firstLower === 'name')) continue;

      // Columns: Auteur, Titel, Cijfer
      let auteur = cols[0] || '';
      let titel = cols[1] || '';
      let beoordeling = null;
      if (cols[2]) {
        const n = parseInt(cols[2]);
        if (n >= 1 && n <= 10) beoordeling = n;
      }
      if (titel) importedBooks.push({ titel, auteur, genre: '', beoordeling });
    }

    event.target.value = '';
    if (importedBooks.length === 0) { showToast('Geen items gevonden — controleer de kolommen (Auteur, Titel, Cijfer)'); return; }
    renderImportPreview();
  };
  reader.readAsText(file, 'UTF-8');
}

function parseImportText() {
  const text = document.getElementById('import-text').value.trim();
  if (!text) { showToast('Plak eerst een lijst'); return; }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  importedBooks = [];
  const dashPattern = /^(.+?)\s*[-–—]\s*(.+)$/;
  const doorPattern = /^(.+?)\s+door\s+(.+)$/i;
  const tabPattern = /^(.+?)\t(.+)$/;

  for (let line of lines) {
    if (line.match(/^(eerder geleend|mijn boeken|datum|pagina|resultaat)/i)) continue;
    if (line.match(/^\d+\s*(van|\/)\s*\d+$/)) continue;
    if (line.length < 3) continue;

    // Extract rating from end of line (e.g. "Titel - Auteur 8" or "Titel - Auteur - 8")
    let beoordeling = null;
    const ratingMatch = line.match(/[\s\-–—]+([1-9]|10)\s*$/);
    if (ratingMatch) {
      beoordeling = parseInt(ratingMatch[1]);
      line = line.slice(0, ratingMatch.index).trim();
    }

    let titel = '', auteur = '';
    let match = line.match(tabPattern);
    if (match) { titel = match[1].trim(); auteur = match[2].trim(); }
    if (!titel) { match = line.match(doorPattern); if (match) { titel = match[1].trim(); auteur = match[2].trim(); } }
    if (!titel) { match = line.match(dashPattern); if (match) { titel = match[1].trim(); auteur = match[2].trim(); } }
    if (!titel) { titel = line; auteur = ''; }

    titel = titel.replace(/^["']|["']$/g, '').trim();
    auteur = auteur.replace(/^["']|["']$/g, '').trim();
    if (titel) importedBooks.push({ titel, auteur, genre: '', beoordeling });
  }

  if (importedBooks.length === 0) { showToast('Geen items gevonden'); return; }
  renderImportPreview();
}

function renderImportPreview() {
  const preview = document.getElementById('import-preview');
  document.getElementById('import-preview-list').innerHTML = importedBooks.map((book, i) => `
    <div class="import-item" data-index="${i}">
      <input type="text" value="${escapeAttr(book.titel)}" placeholder="Titel" onchange="importedBooks[${i}].titel = this.value">
      <input type="text" value="${escapeAttr(book.auteur)}" placeholder="${cfg().makerLabel}" onchange="importedBooks[${i}].auteur = this.value">
      <input type="number" min="1" max="10" value="${book.beoordeling || ''}" placeholder="Cijfer" class="import-rating" onchange="importedBooks[${i}].beoordeling = this.value ? parseInt(this.value) : null">
      <button class="btn-remove" onclick="removeImportItem(${i})">&times;</button>
    </div>
  `).join('');
  preview.style.display = 'block';
  preview.scrollIntoView({ behavior: 'smooth' });
}

function removeImportItem(index) {
  importedBooks.splice(index, 1);
  importedBooks.length === 0 ? cancelImport() : renderImportPreview();
}

function cancelImport() {
  importedBooks = [];
  document.getElementById('import-preview').style.display = 'none';
}

function confirmImport() {
  let added = 0;
  for (const book of importedBooks) {
    if (book.titel.trim()) {
      addItem(book.titel.trim(), book.auteur.trim(), book.genre);
      if (book.beoordeling) {
        const item = items().find(b => b.titel.toLowerCase() === book.titel.trim().toLowerCase());
        if (item) { item.beoordeling = book.beoordeling; item.datumBeoordeeld = new Date().toISOString(); }
      }
      added++;
    }
  }
  saveItems();
  importedBooks = [];
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-text').value = '';
  showToast(`${added} item${added !== 1 ? 's' : ''} geimporteerd!`);
  setTimeout(() => navigateTo('collectie'), 500);
}

// ===== Tips / Recommendations =====
function selectMood(el) {
  document.querySelectorAll('#mood-chips .mood-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedMood = el.dataset.mood;
}

function selectTryNew(el) {
  el.parentElement.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  tryNew = el.dataset.try === 'nieuw';
}

function renderTips() {
  const total = items().length;
  const rated = items().filter(b => b.beoordeling !== null && b.beoordeling > 0).length;
  const unrated = items().filter(b => b.beoordeling === null).length;

  document.getElementById('recommendation-stats').innerHTML = `
    <div class="stat-item"><div class="stat-value">${total}</div><div class="stat-label">Totaal</div></div>
    <div class="stat-item"><div class="stat-value">${rated}</div><div class="stat-label">Beoordeeld</div></div>
    <div class="stat-item"><div class="stat-value">${unrated}</div><div class="stat-label">Onbeoordeeld</div></div>
  `;

  const btn = document.getElementById('btn-get-recs');
  btn.disabled = false;

  // Check if there's a pending review for this media type
  const lastRec = getLastRecommendation();
  const reviewBanner = document.getElementById('review-banner');
  const questionsSection = document.getElementById('rec-questions');

  const recsResult = document.getElementById('recommendations-result');

  if (lastRec && !lastRec.reviewed) {
    reviewBanner.style.display = 'block';
    questionsSection.style.display = 'none';
    recsResult.style.display = 'none';
    document.getElementById('review-item-info').innerHTML = `
      <div class="book-card" style="cursor:default">
        <div class="book-info">
          <div class="book-title">${escapeHtml(lastRec.titel)}</div>
          <div class="book-author">${escapeHtml(lastRec.auteur)}</div>
        </div>
      </div>
    `;
    pendingReviewRating = null;
    document.querySelectorAll('#review-banner .rating-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('review-text').value = '';
  } else {
    reviewBanner.style.display = 'none';
    questionsSection.style.display = 'block';
  }

  // Onzeker section
  const onzekerItems = items().filter(b => b.beoordeling === 0);
  const onzekerSection = document.getElementById('onzeker-section');
  if (onzekerItems.length > 0) {
    onzekerSection.style.display = 'block';
    document.getElementById('onzeker-list').innerHTML = onzekerItems.map(item => `
      <div class="onzeker-item">
        <div class="onzeker-info">
          <div class="onzeker-title">${escapeHtml(item.titel)}</div>
          <div class="onzeker-author">${escapeHtml(item.auteur)}</div>
        </div>
        <a href="${cfg().searchBase}${encodeURIComponent(item.titel)}" target="_blank" class="btn-search-pl" rel="noopener">Zoeken</a>
      </div>
    `).join('');
  } else {
    onzekerSection.style.display = 'none';
  }
}

function selectReviewRating(rating) {
  pendingReviewRating = rating;
  document.querySelectorAll('#review-banner .rating-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', (i + 1) === rating);
  });
}

function submitReview() {
  if (!pendingReviewRating) { showToast('Kies eerst een cijfer'); return; }
  const reviewText = document.getElementById('review-text').value.trim();

  const lastRec = getLastRecommendation();
  if (!lastRec) return;

  // Find or add the item
  let item = items().find(b => b.titel.toLowerCase() === lastRec.titel.toLowerCase());
  if (!item) {
    addItem(lastRec.titel, lastRec.auteur, lastRec.genre || '');
    item = items().find(b => b.titel.toLowerCase() === lastRec.titel.toLowerCase());
  }

  if (item) {
    item.beoordeling = pendingReviewRating;
    if (reviewText) item.recensie = reviewText;
    item.datumBeoordeeld = new Date().toISOString();
    saveItems();
  }

  // Mark as reviewed
  lastRec.reviewed = true;
  saveLastRecommendation(lastRec);

  pendingReviewRating = null;
  showToast(`"${lastRec.titel}" beoordeeld: ${item.beoordeling}/10`);
  renderTips();
}

function getLastRecommendation() {
  try {
    const key = `audioboek-lastRec-${currentMedia}`;
    return JSON.parse(localStorage.getItem(key));
  } catch { return null; }
}

function saveLastRecommendation(rec) {
  const key = `audioboek-lastRec-${currentMedia}`;
  localStorage.setItem(key, JSON.stringify(rec));
}

// Check if a book is available on Passend Lezen

async function getRecommendations() {
  const apiKey = settings.claudeApiKey;
  const ratedItems = items().filter(b => b.beoordeling !== null);

  const preferredGenre = document.getElementById('rec-genre').value;
  const freeText = (document.getElementById('rec-free-text').value || '').trim();

  document.getElementById('recommendations-loading').style.display = 'block';
  document.getElementById('recommendations-result').style.display = 'none';
  document.getElementById('btn-get-recs').disabled = true;

  if (!apiKey) {
    try {
      const result = await getOfflineRecommendations(ratedItems, selectedMood, preferredGenre, tryNew, freeText);
      displayRecommendations(JSON.stringify(result));
    } finally {
      document.getElementById('recommendations-loading').style.display = 'none';
      document.getElementById('btn-get-recs').disabled = false;
    }
    return;
  }

  const prompt = buildRecommendationPrompt(ratedItems, selectedMood, preferredGenre, tryNew, freeText);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API fout (${response.status})`);
    }
    const d = await response.json();
    displayRecommendations(d.content[0].text);
  } catch (error) {
    console.error('API error:', error);
    const result = await getOfflineRecommendations(ratedItems, selectedMood, preferredGenre, tryNew);
    displayRecommendations(JSON.stringify(result));
  } finally {
    document.getElementById('recommendations-loading').style.display = 'none';
    document.getElementById('btn-get-recs').disabled = false;
  }
}

function buildRecommendationPrompt(ratedItems, mood, genre, wantNew, freeText) {
  const c = cfg();
  const itemList = ratedItems.map(b => {
    const rating = b.beoordeling === 0 ? 'Onzeker' : `${b.beoordeling}/10`;
    const review = b.recensie ? ` — Recensie: "${b.recensie}"` : '';
    return `- "${b.titel}" door ${b.auteur}${b.genre ? ` (${b.genre})` : ''} — ${rating}${review}`;
  }).join('\n');

  const allTitles = items().map(b => `"${b.titel}"`).join(', ');

  let prefs = '';
  if (mood) prefs += `\nDe gebruiker is in een ${mood}e stemming.`;
  if (genre) prefs += `\nVoorkeur voor genre: ${genre}.`;
  if (wantNew) prefs += `\nDe gebruiker wil iets NIEUWS proberen — raad iets aan dat BUITEN de gebruikelijke voorkeuren valt.`;
  else prefs += `\nDe gebruiker wil iets binnen de eigen smaak.`;
  if (freeText) prefs += `\nDe gebruiker zegt: "${freeText}" — houd hier sterk rekening mee bij je aanbeveling.`;

  const typeLabel = c.label.toLowerCase();

  return `Je bent een ${typeLabel}-adviseur.

Hier zijn de ${typeLabel} die de gebruiker heeft beoordeeld (schaal 1-10):

${itemList}

Reeds bekende titels (NIET opnieuw aanbevelen): ${allTitles}
${prefs}

Analyseer de smaak en geef PRECIES 3 verschillende aanbevelingen. Let op de recensies — die geven inzicht in WAAROM de gebruiker iets wel of niet goed vond. Zorg voor variatie in genre of stijl tussen de 3 opties.
${currentMedia === 'boeken' ? '\nBELANGRIJK: Controleer of het boek beschikbaar is als audioboek op nieuw.passendlezen.nl. Raad ALLEEN boeken aan die daar waarschijnlijk te vinden zijn (Nederlandstalige audioboeken, populaire titels, bekende auteurs). Als je twijfelt, kies dan een bekender alternatief.' : ''}

Geef je antwoord in het Nederlands, strikt in dit JSON-formaat:
{
  "smaakanalyse": "korte persoonlijke analyse van de smaak van deze gebruiker",
  "aanbevelingen": [
    {
      "titel": "Titel",
      "auteur": "${c.makerLabel}",
      "genre": "Genre",
      "samenvatting": "korte samenvatting van 2-3 zinnen over waar het over gaat, zonder spoilers",
      "motivatie": "persoonlijke motivatie waarom juist deze gebruiker dit zou moeten ${currentMedia === 'boeken' ? 'luisteren' : 'kijken'}, gebaseerd op hun smaak",
      "zoekterm": "zoekterm"
    },
    { "titel": "...", "auteur": "...", "genre": "...", "samenvatting": "...", "motivatie": "...", "zoekterm": "..." },
    { "titel": "...", "auteur": "...", "genre": "...", "samenvatting": "...", "motivatie": "...", "zoekterm": "..." }
  ]
}

Geef ALLEEN het JSON-object terug, zonder extra tekst.`;
}

let pendingRecommendations = [];

function displayRecommendations(text) {
  const container = document.getElementById('recommendations-result');
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Geen JSON');
    const d = JSON.parse(jsonMatch[0]);
    let html = '';

    if (d.smaakanalyse) {
      html += `<div class="taste-analysis"><h3>Jouw opties</h3><p>${escapeHtml(d.smaakanalyse)}</p></div>`;
    }

    pendingRecommendations = d.aanbevelingen || [];
    const searchLabel = currentMedia === 'boeken' ? 'Zoeken op Passend Lezen' : 'Zoeken';

    pendingRecommendations.forEach((rec, i) => {
      const summary = rec.samenvatting || rec.reden || '';
      const motivation = rec.motivatie || rec.reden || '';

      html += `
        <div class="rec-card">
          <div class="rec-number">Optie ${i + 1}</div>
          <h3>${escapeHtml(rec.titel)}</h3>
          <div class="rec-author">${escapeHtml(rec.auteur)}</div>
          ${rec.genre ? `<span class="rec-genre">${escapeHtml(rec.genre)}</span>` : ''}
          ${summary ? `<div class="rec-section"><div class="rec-section-title">Waar gaat het over?</div><p class="rec-summary">${escapeHtml(summary)}</p></div>` : ''}
          ${motivation ? `<div class="rec-section"><div class="rec-section-title">Waarom voor jou?</div><p class="rec-motivation">${escapeHtml(motivation)}</p></div>` : ''}
          ${currentMedia === 'boeken' && rec.plVerified === true ? '<div class="pl-status pl-available">✓ Beschikbaar op Passend Lezen</div>' : ''}
          ${currentMedia === 'boeken' && rec.plVerified === false ? '<div class="pl-status pl-unavailable">Beschikbaarheid niet geverifieerd</div>' : ''}
          <a href="${cfg().searchBase}${encodeURIComponent(rec.zoekterm || rec.titel)}" target="_blank" class="btn-search-pl" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ${searchLabel}
          </a>
          <div class="rec-actions">
            <button class="btn-primary btn-choose" onclick="chooseRecommendation(${i})">Kies deze</button>
            <button class="btn-secondary btn-seen" onclick="showQuickRate(${i})">Al ${currentMedia === 'boeken' ? 'gelezen' : 'gezien'}</button>
          </div>
          <div class="quick-rate" id="quick-rate-${i}" style="display:none">
            <label class="question-label">Geef een cijfer</label>
            <div class="rating-row rating-row-compact">
              ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="rating-btn" onclick="selectQuickRating(${i}, ${n}, this)">${n}</button>`).join('')}
            </div>
            <input type="text" class="quick-review-text" id="quick-review-${i}" placeholder="Optioneel: wat vond je ervan?" maxlength="200">
            <button class="btn-primary" onclick="submitQuickRate(${i})">Beoordeling opslaan</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="card"><div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(text)}</div></div>`;
  }
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

function chooseRecommendation(index) {
  const rec = pendingRecommendations[index];
  if (!rec) return;

  saveLastRecommendation({
    titel: rec.titel,
    auteur: rec.auteur,
    genre: rec.genre || '',
    mediaType: currentMedia,
    datum: new Date().toISOString(),
    reviewed: false
  });

  pendingRecommendations = [];
  showToast(`"${rec.titel}" gekozen! Beoordeel deze de volgende keer.`);
  renderTips();
}

let quickRatings = {};

function showQuickRate(index) {
  const el = document.getElementById(`quick-rate-${index}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function selectQuickRating(index, rating, btn) {
  quickRatings[index] = rating;
  btn.closest('.quick-rate').querySelectorAll('.rating-btn').forEach((b, i) => {
    b.classList.toggle('selected', i + 1 === rating);
  });
}

function submitQuickRate(index) {
  const rating = quickRatings[index];
  if (!rating) { showToast('Kies eerst een cijfer'); return; }

  const rec = pendingRecommendations[index];
  if (!rec) return;

  const reviewText = (document.getElementById(`quick-review-${index}`)?.value || '').trim();

  let item = items().find(b => b.titel.toLowerCase() === rec.titel.toLowerCase());
  if (!item) {
    addItem(rec.titel, rec.auteur, rec.genre || '');
    item = items().find(b => b.titel.toLowerCase() === rec.titel.toLowerCase());
  }
  if (item) {
    item.beoordeling = rating;
    if (reviewText) item.recensie = reviewText;
    item.datumBeoordeeld = new Date().toISOString();
    saveItems();
  }

  delete quickRatings[index];
  pendingRecommendations.splice(index, 1);
  showToast(`"${rec.titel}" beoordeeld: ${rating}/10`);
  renderTips();
}

// ===== Offline Recommendation Engine =====
const OFFLINE_DB = {
  boeken: [
    { titel: "De meeste mensen deugen", auteur: "Rutger Bregman", genre: "Non-fictie", tags: ["maatschappij","psychologie"], passendLezen: true, samenvatting: "Bregman betoogt dat de mens van nature goed is en ontkracht bekende experimenten die het tegendeel beweren. Een hoopvol en verrassend boek over de menselijke natuur." },
    { titel: "Het diner", auteur: "Herman Koch", genre: "Thriller", tags: ["spanning","psychologisch"], passendLezen: true, samenvatting: "Twee echtparen dineren in een chic restaurant, maar achter de beleefde gesprekken schuilt een duister geheim over hun kinderen dat alles op scherp zet." },
    { titel: "Turks fruit", auteur: "Jan Wolkers", genre: "Literaire fictie", tags: ["liefde","klassiek"], passendLezen: true, samenvatting: "Een beeldhouwer blikt terug op zijn hartstochtelijke maar destructieve liefde voor Olga. Een rauwe, ongeremde roman over passie en verlies." },
    { titel: "De ontdekking van de hemel", auteur: "Harry Mulisch", genre: "Literaire fictie", tags: ["filosofie","klassiek"], passendLezen: true, samenvatting: "Een hemels complot brengt twee mannen samen wier levens verweven raken. Hun kinderen spelen een cruciale rol in een kosmisch plan." },
    { titel: "Sonny Boy", auteur: "Annejet van der Zijl", genre: "Non-fictie", tags: ["oorlog","liefde"], passendLezen: true, samenvatting: "Het waargebeurde verhaal van de verboden liefde tussen Rika, een Haagse huisvrouw, en Waldemar, een zwarte student uit Suriname, tijdens de Tweede Wereldoorlog." },
    { titel: "Joe Speedboot", auteur: "Tommy Wieringa", genre: "Literaire fictie", tags: ["humor","coming-of-age"], passendLezen: true, samenvatting: "In een klein dorp aan de rivier groeit Frankie op met zijn excentrieke vrienden. De komst van de mysterieuze Joe verandert alles." },
    { titel: "Tirza", auteur: "Arnon Grunberg", genre: "Psychologische roman", tags: ["psychologisch","donker"], passendLezen: true, samenvatting: "Jorgen Hofmeester, een ogenschijnlijk succesvolle man, organiseert een afscheidsfeest voor zijn dochter Tirza. Langzaam onthult zich hoe zijn leven uit elkaar is gevallen." },
    { titel: "Bonita Avenue", auteur: "Peter Buwalda", genre: "Literaire fictie", tags: ["spanning","familie"], passendLezen: true, samenvatting: "Het perfecte gezin van wiskundeprofessor Siem Sigerius wordt bedreigd door een duister geheim uit het verleden dat steeds dichterbij kruipt." },
    { titel: "De helaasheid der dingen", auteur: "Dimitri Verhulst", genre: "Humor", tags: ["humor","familie"], passendLezen: true, samenvatting: "Een jongen groeit op in een Vlaams arbeidersgezin vol dronkaards en zonderlingen. Hilarisch en tegelijk ontroerend over armoede en familieliefde." },
    { titel: "Sapiens", auteur: "Yuval Noah Harari", genre: "Non-fictie", tags: ["geschiedenis","wetenschap"], passendLezen: true, samenvatting: "Een meeslepend overzicht van de menselijke geschiedenis, van de eerste Homo sapiens tot nu. Harari laat zien hoe verhalen en geloof onze wereld vormgaven." },
    { titel: "Het smelt", auteur: "Lize Spit", genre: "Literaire fictie", tags: ["psychologisch","donker"], passendLezen: true, samenvatting: "Eva keert terug naar haar geboortedorp met een blok ijs in de kofferbak. Langzaam onthult zich het trauma van de zomer toen alles veranderde." },
    { titel: "Het meisje in de trein", auteur: "Paula Hawkins", genre: "Thriller", tags: ["spanning","psychologisch"], passendLezen: true, samenvatting: "Rachel ziet elke dag vanuit de trein een perfect koppel. Als de vrouw verdwijnt, raakt Rachel betrokken bij het onderzoek met gevaarlijke gevolgen." },
    { titel: "Het meisje in het ijs", auteur: "Robert Bryndza", genre: "Thriller", tags: ["spanning","detective"], passendLezen: true, samenvatting: "Rechercheur Erika Foster onderzoekt de moord op een jong meisje wiens lichaam in een bevroren vijver wordt gevonden. Een ijzingwekkende whodunit." },
    { titel: "Knielen op een bed violen", auteur: "Jan Siebelink", genre: "Literaire fictie", tags: ["religie","familie"], passendLezen: true, samenvatting: "Hans Siebelink raakt in de ban van een strenge geloofsgemeenschap, wat zijn huwelijk en gezin langzaam kapotmaakt. Gebaseerd op het leven van de auteur." },
    { titel: "Hex", auteur: "Thomas Olde Heuvelt", genre: "Fantasy", tags: ["horror","spanning"], passendLezen: true, samenvatting: "Het dorpje Beek wordt al eeuwen achtervolgd door een heks. De bewoners houden het geheim, maar tieners beginnen de regels te breken." },
    { titel: "Brief aan de koning", auteur: "Tonke Dragt", genre: "Fantasy", tags: ["avontuur","jeugd"], passendLezen: true, samenvatting: "Schildknaap Tiuri krijgt een geheime opdracht: een brief bezorgen aan de koning van een buurland. Een klassiek ridderavontuur vol gevaar en moed." },
    { titel: "De zeven zussen", auteur: "Lucinda Riley", genre: "Romantiek", tags: ["liefde","avontuur"], passendLezen: true, samenvatting: "Na het overlijden van hun vader gaan zes geadopteerde zussen elk op zoek naar hun oorsprong. Een episch verhaal over liefde en identiteit." },
    { titel: "Ik weet je wachtwoord", auteur: "Daniel Verlaan", genre: "Non-fictie", tags: ["technologie","maatschappij"], passendLezen: true, samenvatting: "Tech-journalist Verlaan laat zien hoe kwetsbaar we online zijn. Van gehackte babyfoons tot gestolen identiteiten: een eye-opener over digitale veiligheid." },
    { titel: "Oorlogswinter", auteur: "Jan Terlouw", genre: "Historische roman", tags: ["oorlog","jeugd"], passendLezen: true, samenvatting: "De 15-jarige Michiel raakt betrokken bij het verzet in de laatste winter van de Tweede Wereldoorlog. Een spannend en aangrijpend verhaal over moed." },
    { titel: "De avonden", auteur: "Gerard Reve", genre: "Literaire fictie", tags: ["klassiek","psychologisch"], passendLezen: true, samenvatting: "Tien dagen uit het leven van Frits van Egters aan het eind van 1946. Een meesterlijk portret van verveling, angst en de zoektocht naar betekenis." }
  ],
  films: [
    { titel: "Turks Fruit", auteur: "Paul Verhoeven", genre: "Drama", tags: ["liefde","klassiek"], samenvatting: "Een beeldhouwer herinnert zich zijn stormachtige liefdesrelatie met Olga. Rauwe passie, humor en verdriet in de meest succesvolle Nederlandse film ooit." },
    { titel: "Soldaat van Oranje", auteur: "Paul Verhoeven", genre: "Oorlog", tags: ["spanning","oorlog"], samenvatting: "Een groep Leidse studenten wordt door de Tweede Wereldoorlog uit elkaar gedreven. Sommigen kiezen voor het verzet, anderen voor collaboratie." },
    { titel: "De Aanslag", auteur: "Fons Rademakers", genre: "Drama", tags: ["oorlog","psychologisch"], samenvatting: "Na een aanslag op een NSB'er wordt de familie van de jonge Anton uitgemoord. Decennia later zoekt hij naar de waarheid over die nacht." },
    { titel: "Karakter", auteur: "Mike van Diem", genre: "Drama", tags: ["familie","spanning"], samenvatting: "Een jonge advocaat wordt verdacht van de moord op zijn tirannieke vader, een deurwaarder. Een Oscar-winnend drama over vaderschap en wraak." },
    { titel: "Zwartboek", auteur: "Paul Verhoeven", genre: "Thriller", tags: ["oorlog","spanning"], samenvatting: "Een Joodse zangeres infiltreert het nazi-hoofdkwartier in Den Haag. Een bloedstollende oorlogsthriller vol verraad en dubbelspel." },
    { titel: "Borgman", auteur: "Alex van Warmerdam", genre: "Thriller", tags: ["psychologisch","donker"], samenvatting: "Een mysterieuze zwerver dringt het leven binnen van een welgesteld gezin en brengt langzaam chaos en onheil. Verontrustend en raadselachtig." },
    { titel: "Instinct", auteur: "Halina Reijn", genre: "Thriller", tags: ["psychologisch","spanning"], samenvatting: "Een psychologe in een tbs-kliniek raakt gefascineerd door een charmante zedendelinquent. De grens tussen behandelaar en patient vervaagt." },
    { titel: "De Marathon", auteur: "Diederick Koopal", genre: "Komedie", tags: ["humor","familie"], samenvatting: "De chaotische eigenaren van een snackbar besluiten de marathon van Rotterdam te lopen. Een hartverwarmende komedie over doorzetten." },
    { titel: "Alles is liefde", auteur: "Joram Lursen", genre: "Romantiek", tags: ["liefde","humor"], samenvatting: "Meerdere verhaallijnen over de liefde kruisen elkaar in aanloop naar Sinterklaas in Amsterdam. De Nederlandse Love Actually." },
    { titel: "Loft", auteur: "Antoinette Beumer", genre: "Thriller", tags: ["spanning","psychologisch"], samenvatting: "Vijf vrienden delen een geheim penthouse voor hun affaires. Als daar een dood lichaam wordt gevonden, verdenken ze elkaar." },
    { titel: "Bankier van het Verzet", auteur: "Joram Lursen", genre: "Drama", tags: ["oorlog","spanning"], samenvatting: "Het waargebeurde verhaal van bankier Walraven van Hall die tijdens de bezetting miljoenen wegsluist naar het verzet." },
    { titel: "Brimstone", auteur: "Martin Koolhoven", genre: "Thriller", tags: ["spanning","donker"], samenvatting: "Een stomme vrouw in het Wilde Westen wordt achtervolgd door een sinistere predikant met een duister verleden. Rauw en intens." },
    { titel: "The Forgotten Battle", auteur: "Matthijs van Heijningen Jr.", genre: "Oorlog", tags: ["oorlog","actie"], samenvatting: "Drie jonge levens raken verweven tijdens de Slag om de Schelde in 1944. Een spectaculair oorlogsdrama over keuzes en overleven." },
    { titel: "De Oost", auteur: "Jim Taihuttu", genre: "Drama", tags: ["oorlog","geschiedenis"], samenvatting: "Een jonge Nederlandse soldaat wordt in 1946 naar Indonesie gestuurd. Daar raakt hij verwikkeld in het geweld van de koloniale oorlog." },
    { titel: "Do Not Disturb", auteur: "Will Koopman", genre: "Komedie", tags: ["humor","vakantie"], samenvatting: "Een Nederlandse familie beleeft hilarische avonturen tijdens hun vakantie in Frankrijk. Herkenbaar en grappig familyvermaak." }
  ],
  series: [
    { titel: "Penoza", auteur: "Diederik van Rooijen", genre: "Misdaad", tags: ["misdaad","spanning"], samenvatting: "Na de moord op haar man neemt Carmen het criminele imperium over. Een keiharde misdaadserie over een vrouw in een mannenwereld." },
    { titel: "Mocro Maffia", auteur: "Achmed Akkabi", genre: "Misdaad", tags: ["misdaad","spanning"], samenvatting: "Twee jeugdvrienden belanden in de Amsterdamse drugswereld. Loyaliteit en verraad leiden tot een bloedige oorlog. Gebaseerd op waargebeurde feiten." },
    { titel: "Undercover", auteur: "Nico Moolenaar", genre: "Thriller", tags: ["spanning","misdaad"], samenvatting: "Twee undercoveragenten infiltreren op een camping aan de Belgisch-Nederlandse grens om een ecstasyproducent te ontmaskeren." },
    { titel: "Klem", auteur: "Frank Ketelaar", genre: "Thriller", tags: ["psychologisch","spanning"], samenvatting: "Advocaat Hugo raakt verstrikt in een web van corruptie en chantage. Zijn perfecte leven dreigt in te storten." },
    { titel: "Tabula Rasa", auteur: "Kaat Beels", genre: "Thriller", tags: ["psychologisch","spanning"], samenvatting: "Een man met geheugenverlies zit vast in een psychiatrische instelling. Is hij getuige of dader van een verdwijning?" },
    { titel: "Overspel", auteur: "Paul Verhoeven", genre: "Drama", tags: ["liefde","psychologisch"], samenvatting: "Een buitenechtelijke affaire leidt tot een kettingreactie van leugens, bedrog en uiteindelijk moord. Vier levens raken onherroepelijk verstrengeld." },
    { titel: "Nieuwe Buren", auteur: "Pieter Kuijpers", genre: "Thriller", tags: ["spanning","buren"], samenvatting: "Nieuwe buren in een rustige wijk blijken een duister geheim te verbergen. Wat begint als nieuwsgierigheid verandert in een nachtmerrie." },
    { titel: "De Twaalf", auteur: "Wouter Bouvijn", genre: "Thriller", tags: ["misdaad","rechtbank"], samenvatting: "Twaalf juryleden moeten oordelen over een vrouw die beschuldigd wordt van drie moorden. Maar elk jurylid heeft eigen geheimen." },
    { titel: "De Luizenmoeder", auteur: "Ilse Warringa", genre: "Komedie", tags: ["humor","school"], samenvatting: "Het reilen en zeilen op een basisschool gezien door de ogen van ouders, leraren en de directeur. Hilarisch en herkenbaar." },
    { titel: "Oogappels", auteur: "Will Koopman", genre: "Komedie", tags: ["humor","familie"], samenvatting: "Vier ouderparen worstelen met de opvoeding van hun pubers. Grappig, pijnlijk en herkenbaar over het moderne ouderschap." },
    { titel: "Ferry", auteur: "Cecilia Verheyden", genre: "Misdaad", tags: ["misdaad","humor"], samenvatting: "Het voorverhaal van de populaire Ferry Bouman uit Undercover. Hoe een Brabantse jongen uitgroeide tot drugsbaron." },
    { titel: "Het Verhaal van Nederland", auteur: "NTR", genre: "Documentaire", tags: ["geschiedenis","maatschappij"], samenvatting: "Een meeslepende documentaireserie over de Nederlandse geschiedenis, van de prehistorie tot nu, met spectaculaire reconstructies." },
    { titel: "Ares", auteur: "Pieter Kuijpers", genre: "Horror", tags: ["horror","spanning"], samenvatting: "Een studente wordt lid van een geheim genootschap in Amsterdam. Al snel ontdekt ze de duistere waarheid achter de eeuwenoude organisatie." },
    { titel: "Anne+", auteur: "Valerie Bisscheroux", genre: "Drama", tags: ["liefde","lgbtq"], samenvatting: "Anne navigeert door het leven als jonge vrouw in Amsterdam: liefde, vriendschap en het ontdekken van wie ze werkelijk is." },
    { titel: "Grenslanders", auteur: "Eshref Reybrouck", genre: "Misdaad", tags: ["misdaad","spanning"], samenvatting: "Een Belgische en Nederlandse rechercheur werken samen om een drugsbende op te rollen aan de grens. Maar wie is te vertrouwen?" }
  ]
};

const MOOD_TAG_MAP = {
  'spannend': ['spanning','misdaad','detective','psychologisch','horror'],
  'ontspannend': ['liefde','humor','familie'],
  'grappig': ['humor','satire','komisch'],
  'emotioneel': ['verlies','liefde','eenzaamheid','familie','psychologisch'],
  'leerzaam': ['geschiedenis','wetenschap','maatschappij','filosofie','technologie'],
  'meeslepend': ['avontuur','oorlog','coming-of-age','spanning','actie']
};

async function getOfflineRecommendations(ratedItems, mood, genre, wantNew, freeText) {
  const db = OFFLINE_DB[currentMedia] || [];
  const genreScores = {};
  const existingTitles = new Set(items().map(b => b.titel.toLowerCase()));

  for (const item of ratedItems) {
    const score = item.beoordeling === 0 ? 5 : item.beoordeling;
    const weight = score - 5.5;
    if (item.genre) {
      const g = item.genre.toLowerCase();
      genreScores[g] = (genreScores[g] || 0) + weight;
    }
  }

  const topGenres = Object.entries(genreScores).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).map(([g]) => g);
  const moodTags = mood ? (MOOD_TAG_MAP[mood] || []) : [];

  const candidates = db
    .filter(b => !existingTitles.has(b.titel.toLowerCase()))
    .map(b => {
      let score = 0;
      const g = b.genre.toLowerCase();
      if (wantNew) {
        if (genreScores[g] === undefined) score += 5;
        if (topGenres.includes(g)) score -= 3;
      } else {
        if (genreScores[g]) score += genreScores[g] * 2;
      }
      if (genre && b.genre === genre) score += 6;
      if (genre && b.genre !== genre) score -= 4;
      if (moodTags.length > 0) score += b.tags.filter(t => moodTags.includes(t)).length * 3;
      if (freeText) {
        const words = freeText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const searchIn = `${b.titel} ${b.auteur} ${b.genre} ${b.tags.join(' ')} ${b.samenvatting || ''}`.toLowerCase();
        score += words.filter(w => searchIn.includes(w)).length * 4;
      }
      score += Math.random() * 2;
      return { ...b, score };
    })
    .sort((a,b) => b.score - a.score);

  // For books: only recommend titles verified on Passend Lezen
  let picks;
  if (currentMedia === 'boeken') {
    picks = candidates.filter(c => c.passendLezen === true).slice(0, 3);
    if (picks.length === 0) picks = candidates.slice(0, 3);
  } else {
    picks = candidates.slice(0, 3);
  }

  if (picks.length === 0) picks = [{ titel: 'Geen suggestie', auteur: 'Onbekend', genre: '', samenvatting: '' }];
  const c = cfg();

  let smaak = freeText
    ? `Op basis van je wens: "${freeText}"${mood ? ', je ' + mood + 'e stemming' : ''}${genre ? ' en voorkeur voor ' + genre.toLowerCase() : ''}.`
    : wantNew
      ? `Je wilde iets nieuws proberen! Kies een van deze 3 opties.`
      : `Op basis van je beoordelingen${mood ? ', je ' + mood + 'e stemming' : ''}${genre ? ' en voorkeur voor ' + genre.toLowerCase() : ''}. Kies een van deze 3 opties.`;

  return {
    smaakanalyse: smaak,
    aanbevelingen: picks.map(pick => {
      const plStatus = pick.passendLezen === true;
      const motivatie = freeText
        ? `Je zocht naar "${freeText}" — dit past daar goed bij${mood ? ' en bij je ' + mood + 'e stemming' : ''}.`
        : wantNew
          ? `Dit is iets anders dan wat je normaal ${currentMedia === 'boeken' ? 'luistert' : 'kijkt'} — een kans om ${pick.genre.toLowerCase()} te ontdekken!`
          : mood
            ? `Past bij je ${mood}e stemming${topGenres.length > 0 ? ' en je voorkeur voor ' + topGenres[0] : ''}`
            : `Past bij je smaakprofiel${topGenres.length > 0 ? ' — je houdt van ' + topGenres.slice(0,2).join(' en ') : ''}`;
      return {
        titel: pick.titel, auteur: pick.auteur, genre: pick.genre,
        samenvatting: pick.samenvatting || '',
        motivatie: motivatie,
        zoekterm: pick.titel,
        plVerified: currentMedia === 'boeken' ? plStatus : undefined
      };
    })
  };
}

// ===== Notifications & Reminders =====
function checkReminder() {
  const freq = settings.herinneringsFrequentie;
  if (freq === undefined || freq === 0) return;
  const last = parseInt(localStorage.getItem('audioboek-lastReminder') || '0');
  const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
  const totalUnrated = Object.values(data).reduce((sum, arr) => sum + arr.filter(b => b.beoordeling === null).length, 0);

  if (daysSince >= freq && totalUnrated > 0) {
    showReminderBanner(totalUnrated);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Beoordelingen', { body: `Je hebt nog ${totalUnrated} onbeoordeelde items. Beoordeel er een paar!`, icon: 'icon.svg', tag: 'audioboek-reminder' }); } catch {}
    }
    localStorage.setItem('audioboek-lastReminder', Date.now().toString());
  }
}

function showReminderBanner(count) {
  document.getElementById('reminder-text').textContent = `Je hebt nog ${count} onbeoordeeld${count !== 1 ? 'e items' : ' item'}!`;
  document.getElementById('reminder-banner').style.display = 'flex';
}

function dismissReminder() { document.getElementById('reminder-banner').style.display = 'none'; }

async function requestNotificationPermission() {
  if (!('Notification' in window)) { showToast('Meldingen niet ondersteund'); return; }
  const result = await Notification.requestPermission();
  updateNotificationStatus();
  showToast(result === 'granted' ? 'Meldingen ingeschakeld!' : 'Meldingen geweigerd');
}

function updateNotificationStatus() {
  const s = document.getElementById('notification-status');
  const b = document.getElementById('btn-enable-notifications');
  if (!('Notification' in window)) { s.textContent = 'Niet ondersteund.'; b.style.display = 'none'; return; }
  if (Notification.permission === 'granted') { s.textContent = 'Meldingen zijn ingeschakeld.'; b.style.display = 'none'; }
  else if (Notification.permission === 'denied') { s.textContent = 'Meldingen geblokkeerd.'; b.style.display = 'none'; }
  else { s.textContent = 'Schakel meldingen in.'; b.style.display = 'block'; }
}

// ===== Settings =====
function saveApiKey() {
  settings.claudeApiKey = document.getElementById('input-api-key').value.trim();
  saveSettings();
  showToast(settings.claudeApiKey ? 'API-sleutel opgeslagen' : 'API-sleutel verwijderd');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('input-api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function saveReminderFreq() {
  settings.herinneringsFrequentie = parseInt(document.getElementById('input-reminder-freq').value);
  saveSettings();
}

// ===== Data Export/Import =====
function exportData() {
  const exp = { versie: '2.0', exportDatum: new Date().toISOString(), boeken: data.boeken, films: data.films, series: data.series, instellingen: { herinneringsFrequentie: settings.herinneringsFrequentie } };
  const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `beoordelingen-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('Geexporteerd');
}

function importDataFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const d = JSON.parse(e.target.result);
      let added = 0;
      for (const type of ['boeken','films','series']) {
        if (d[type] && Array.isArray(d[type])) {
          for (const item of d[type]) {
            const exists = data[type].some(b => b.titel.toLowerCase() === item.titel.toLowerCase() && b.auteur.toLowerCase() === item.auteur.toLowerCase());
            if (!exists) { data[type].push(item); added++; }
          }
        }
      }
      // Backward compat: old format had only boeken
      if (!d.films && !d.series && d.boeken) {
        // already handled above
      }
      saveAllItems();
      renderItems();
      showToast(`${added} item${added !== 1 ? 's' : ''} toegevoegd`);
    } catch { showToast('Fout bij het lezen'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (confirm('Weet je zeker dat je ALLE gegevens wilt wissen?')) {
    if (confirm('Dit verwijdert alles permanent. Doorgaan?')) {
      data = { boeken: [], films: [], series: [] };
      settings = {};
      for (const key of Object.keys(MEDIA_TYPES)) localStorage.removeItem(MEDIA_TYPES[key].storageKey);
      localStorage.removeItem('audioboek-settings');
      localStorage.removeItem('audioboek-lastReminder');
      for (const key of Object.keys(MEDIA_TYPES)) localStorage.removeItem(`audioboek-lastRec-${key}`);
      document.getElementById('input-api-key').value = '';
      document.getElementById('input-reminder-freq').value = '3';
      renderItems();
      showToast('Alle gegevens gewist');
    }
  }
}

// ===== Utility =====
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
function escapeAttr(text) { return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function showToast(message) {
  const t = document.getElementById('toast');
  t.textContent = message; t.style.display = 'block';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.style.display = 'none'; }, 2500);
}
