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
function parseImportText() {
  const text = document.getElementById('import-text').value.trim();
  if (!text) { showToast('Plak eerst een lijst'); return; }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  importedBooks = [];
  const dashPattern = /^(.+?)\s*[-–—]\s*(.+)$/;
  const doorPattern = /^(.+?)\s+door\s+(.+)$/i;
  const tabPattern = /^(.+?)\t(.+)$/;

  for (const line of lines) {
    if (line.match(/^(eerder geleend|mijn boeken|datum|pagina|resultaat)/i)) continue;
    if (line.match(/^\d+\s*(van|\/)\s*\d+$/)) continue;
    if (line.length < 3) continue;

    let titel = '', auteur = '';
    let match = line.match(tabPattern);
    if (match) { titel = match[1].trim(); auteur = match[2].trim(); }
    if (!titel) { match = line.match(doorPattern); if (match) { titel = match[1].trim(); auteur = match[2].trim(); } }
    if (!titel) { match = line.match(dashPattern); if (match) { titel = match[1].trim(); auteur = match[2].trim(); } }
    if (!titel) { titel = line; auteur = ''; }

    titel = titel.replace(/^["']|["']$/g, '').trim();
    auteur = auteur.replace(/^["']|["']$/g, '').trim();
    if (titel) importedBooks.push({ titel, auteur, genre: '' });
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
    if (book.titel.trim()) { addItem(book.titel.trim(), book.auteur.trim(), book.genre); added++; }
  }
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
  btn.disabled = rated < 3;

  // Check if there's a pending review for this media type
  const lastRec = getLastRecommendation();
  const reviewBanner = document.getElementById('review-banner');
  const questionsSection = document.getElementById('rec-questions');

  if (lastRec && !lastRec.reviewed) {
    reviewBanner.style.display = 'block';
    questionsSection.style.display = 'none';
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
  if (!reviewText) { showToast('Schrijf een korte recensie'); return; }

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
    item.recensie = reviewText;
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

async function getRecommendations() {
  const apiKey = settings.claudeApiKey;
  const ratedItems = items().filter(b => b.beoordeling !== null);
  if (ratedItems.length < 3) { showToast('Beoordeel minstens 3 items'); return; }

  const preferredGenre = document.getElementById('rec-genre').value;

  document.getElementById('recommendations-loading').style.display = 'block';
  document.getElementById('recommendations-result').style.display = 'none';
  document.getElementById('btn-get-recs').disabled = true;

  if (!apiKey) {
    setTimeout(() => {
      const result = getOfflineRecommendations(ratedItems, selectedMood, preferredGenre, tryNew);
      displayRecommendations(JSON.stringify(result));
      document.getElementById('recommendations-loading').style.display = 'none';
      document.getElementById('btn-get-recs').disabled = false;
    }, 400);
    return;
  }

  const prompt = buildRecommendationPrompt(ratedItems, selectedMood, preferredGenre, tryNew);

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
    const result = getOfflineRecommendations(ratedItems, selectedMood, preferredGenre, tryNew);
    displayRecommendations(JSON.stringify(result));
  } finally {
    document.getElementById('recommendations-loading').style.display = 'none';
    document.getElementById('btn-get-recs').disabled = false;
  }
}

function buildRecommendationPrompt(ratedItems, mood, genre, wantNew) {
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

  const typeLabel = c.label.toLowerCase();

  return `Je bent een ${typeLabel}-adviseur.

Hier zijn de ${typeLabel} die de gebruiker heeft beoordeeld (schaal 1-10):

${itemList}

Reeds bekende titels (NIET opnieuw aanbevelen): ${allTitles}
${prefs}

Analyseer de smaak en geef PRECIES 1 aanbeveling. Let op de recensies — die geven inzicht in WAAROM de gebruiker iets wel of niet goed vond.

Geef je antwoord in het Nederlands, strikt in dit JSON-formaat:
{
  "smaakanalyse": "korte beschrijving waarom deze ${c.singular} bij de gebruiker past",
  "aanbevelingen": [
    {
      "titel": "Titel",
      "auteur": "${c.makerLabel}",
      "genre": "Genre",
      "reden": "Waarom dit perfect is voor nu",
      "zoekterm": "zoekterm"
    }
  ]
}

Geef ALLEEN het JSON-object terug, zonder extra tekst.`;
}

function displayRecommendations(text) {
  const container = document.getElementById('recommendations-result');
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Geen JSON');
    const d = JSON.parse(jsonMatch[0]);
    let html = '';

    if (d.smaakanalyse) {
      html += `<div class="taste-analysis"><h3>Waarom deze tip</h3><p>${escapeHtml(d.smaakanalyse)}</p></div>`;
    }

    if (d.aanbevelingen && d.aanbevelingen.length > 0) {
      const rec = d.aanbevelingen[0];
      html += `
        <div class="rec-card">
          <h3>${escapeHtml(rec.titel)}</h3>
          <div class="rec-author">${escapeHtml(rec.auteur)}</div>
          ${rec.genre ? `<span class="rec-genre">${escapeHtml(rec.genre)}</span>` : ''}
          <p class="rec-reason">${escapeHtml(rec.reden)}</p>
          <a href="${cfg().searchBase}${encodeURIComponent(rec.zoekterm || rec.titel)}" target="_blank" class="btn-search-pl" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Zoeken
          </a>
        </div>
      `;

      // Save as last recommendation (needs review next time)
      saveLastRecommendation({
        titel: rec.titel,
        auteur: rec.auteur,
        genre: rec.genre || '',
        mediaType: currentMedia,
        datum: new Date().toISOString(),
        reviewed: false
      });
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="card"><div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(text)}</div></div>`;
  }
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

// ===== Offline Recommendation Engine =====
const OFFLINE_DB = {
  boeken: [
    { titel: "De meeste mensen deugen", auteur: "Rutger Bregman", genre: "Non-fictie", tags: ["maatschappij","psychologie"] },
    { titel: "Het diner", auteur: "Herman Koch", genre: "Thriller", tags: ["spanning","psychologisch"] },
    { titel: "Turks fruit", auteur: "Jan Wolkers", genre: "Literaire fictie", tags: ["liefde","klassiek"] },
    { titel: "De ontdekking van de hemel", auteur: "Harry Mulisch", genre: "Literaire fictie", tags: ["filosofie","klassiek"] },
    { titel: "Sonny Boy", auteur: "Annejet van der Zijl", genre: "Non-fictie", tags: ["oorlog","liefde"] },
    { titel: "Joe Speedboot", auteur: "Tommy Wieringa", genre: "Literaire fictie", tags: ["humor","coming-of-age"] },
    { titel: "Tirza", auteur: "Arnon Grunberg", genre: "Psychologische roman", tags: ["psychologisch","donker"] },
    { titel: "Bonita Avenue", auteur: "Peter Buwalda", genre: "Literaire fictie", tags: ["spanning","familie"] },
    { titel: "De helaasheid der dingen", auteur: "Dimitri Verhulst", genre: "Humor", tags: ["humor","familie"] },
    { titel: "Sapiens", auteur: "Yuval Noah Harari", genre: "Non-fictie", tags: ["geschiedenis","wetenschap"] },
    { titel: "De vader van Phoebe", auteur: "Karin Slaughter", genre: "Thriller", tags: ["spanning","misdaad"] },
    { titel: "Girl on the Train", auteur: "Paula Hawkins", genre: "Thriller", tags: ["spanning","psychologisch"] },
    { titel: "De vrouw in het ijs", auteur: "Robert Bryndza", genre: "Thriller", tags: ["spanning","detective"] },
    { titel: "Knielen op een bed violen", auteur: "Jan Siebelink", genre: "Literaire fictie", tags: ["religie","familie"] },
    { titel: "Hex", auteur: "Thomas Olde Heuvelt", genre: "Fantasy", tags: ["horror","spanning"] },
    { titel: "Brief aan de koning", auteur: "Tonke Dragt", genre: "Fantasy", tags: ["avontuur","jeugd"] },
    { titel: "De zeven zussen", auteur: "Lucinda Riley", genre: "Romantiek", tags: ["liefde","avontuur"] },
    { titel: "Ik weet je wachtwoord", auteur: "Daniel Verlaan", genre: "Non-fictie", tags: ["technologie","maatschappij"] },
    { titel: "Oorlogswinter", auteur: "Jan Terlouw", genre: "Historische roman", tags: ["oorlog","jeugd"] },
    { titel: "Verdwijnen", auteur: "Lize Spit", genre: "Literaire fictie", tags: ["psychologisch","donker"] }
  ],
  films: [
    { titel: "Turks Fruit", auteur: "Paul Verhoeven", genre: "Drama", tags: ["liefde","klassiek"] },
    { titel: "Soldaat van Oranje", auteur: "Paul Verhoeven", genre: "Oorlog", tags: ["spanning","oorlog"] },
    { titel: "De Aanslag", auteur: "Fons Rademakers", genre: "Drama", tags: ["oorlog","psychologisch"] },
    { titel: "Karakter", auteur: "Mike van Diem", genre: "Drama", tags: ["familie","spanning"] },
    { titel: "Zwartboek", auteur: "Paul Verhoeven", genre: "Thriller", tags: ["oorlog","spanning"] },
    { titel: "Borgman", auteur: "Alex van Warmerdam", genre: "Thriller", tags: ["psychologisch","donker"] },
    { titel: "Instinct", auteur: "Halina Reijn", genre: "Thriller", tags: ["psychologisch","spanning"] },
    { titel: "De Marathon", auteur: "Diederick Koopal", genre: "Komedie", tags: ["humor","familie"] },
    { titel: "Alles is liefde", auteur: "Joram Lursen", genre: "Romantiek", tags: ["liefde","humor"] },
    { titel: "Loft", auteur: "Antoinette Beumer", genre: "Thriller", tags: ["spanning","psychologisch"] },
    { titel: "Bankier van het Verzet", auteur: "Joram Lursen", genre: "Drama", tags: ["oorlog","spanning"] },
    { titel: "Aanmoddansen", auteur: "Nicole van Kilsdonk", genre: "Komedie", tags: ["humor","liefde"] },
    { titel: "Ciske de Rat", auteur: "Wolfgang Staudte", genre: "Drama", tags: ["jeugd","klassiek"] },
    { titel: "Brimstone", auteur: "Martin Koolhoven", genre: "Thriller", tags: ["spanning","donker"] },
    { titel: "Publieke Werken", auteur: "Joram Lursen", genre: "Drama", tags: ["maatschappij","amsterdam"] },
    { titel: "Penoza: The Final Chapter", auteur: "Diederik van Rooijen", genre: "Misdaad", tags: ["misdaad","spanning"] },
    { titel: "The Forgotten Battle", auteur: "Matthijs van Heijningen Jr.", genre: "Oorlog", tags: ["oorlog","actie"] },
    { titel: "Do Not Disturb", auteur: "Will Koopman", genre: "Komedie", tags: ["humor","vakantie"] },
    { titel: "Judas", auteur: "Paul Verhoeven", genre: "Documentaire", tags: ["misdaad","maatschappij"] },
    { titel: "De Oost", auteur: "Jim Taihuttu", genre: "Drama", tags: ["oorlog","geschiedenis"] }
  ],
  series: [
    { titel: "Penoza", auteur: "Diederik van Rooijen", genre: "Misdaad", tags: ["misdaad","spanning"] },
    { titel: "Mocro Maffia", auteur: "Achmed Akkabi", genre: "Misdaad", tags: ["misdaad","spanning"] },
    { titel: "Undercover", auteur: "Nico Moolenaar", genre: "Thriller", tags: ["spanning","misdaad"] },
    { titel: "Klem", auteur: "Frank Ketelaar", genre: "Thriller", tags: ["psychologisch","spanning"] },
    { titel: "Tabula Rasa", auteur: "Kaat Beels", genre: "Thriller", tags: ["psychologisch","spanning"] },
    { titel: "Overspel", auteur: "Paul Verhoeven", genre: "Drama", tags: ["liefde","psychologisch"] },
    { titel: "Nieuwe Buren", auteur: "Pieter Kuijpers", genre: "Thriller", tags: ["spanning","buren"] },
    { titel: "De Twaalf", auteur: "Wouter Bouvijn", genre: "Thriller", tags: ["misdaad","rechtbank"] },
    { titel: "Fenix", auteur: "Shariff Nasr", genre: "Drama", tags: ["familie","misdaad"] },
    { titel: "De Luizenmoeder", auteur: "Ilse Warringa", genre: "Komedie", tags: ["humor","school"] },
    { titel: "Oogappels", auteur: "Will Koopman", genre: "Komedie", tags: ["humor","familie"] },
    { titel: "Soof", auteur: "Antoinette Beumer", genre: "Drama", tags: ["familie","liefde"] },
    { titel: "Toon", auteur: "Joram Lursen", genre: "Drama", tags: ["muziek","biografie"] },
    { titel: "Het Verhaal van Nederland", auteur: "NTR", genre: "Documentaire", tags: ["geschiedenis","maatschappij"] },
    { titel: "Bankier van het Verzet", auteur: "Joram Lursen", genre: "Drama", tags: ["oorlog","spanning"] },
    { titel: "Ferry", auteur: "Cecilia Verheyden", genre: "Misdaad", tags: ["misdaad","humor"] },
    { titel: "Dirty Lines", auteur: "Pieter Kuijpers", genre: "Drama", tags: ["humor","amsterdam"] },
    { titel: "Anne+", auteur: "Valerie Bisscheroux", genre: "Drama", tags: ["liefde","lgbtq"] },
    { titel: "Ares", auteur: "Pieter Kuijpers", genre: "Horror", tags: ["horror","spanning"] },
    { titel: "Grenslanders", auteur: "Eshref Reybrouck", genre: "Misdaad", tags: ["misdaad","spanning"] }
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

function getOfflineRecommendations(ratedItems, mood, genre, wantNew) {
  const db = OFFLINE_DB[currentMedia] || [];
  const genreScores = {};
  const existingTitles = new Set(items().map(b => b.titel.toLowerCase()));

  for (const item of ratedItems) {
    const score = item.beoordeling === 0 ? 5 : item.beoordeling;
    const weight = score - 5.5; // -4.5 to +4.5
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
      score += Math.random() * 2;
      return { ...b, score };
    })
    .sort((a,b) => b.score - a.score);

  const pick = candidates[0] || { titel: 'Geen suggestie', auteur: 'Onbekend', genre: '' };
  const c = cfg();

  let reden = wantNew
    ? `Dit is iets anders dan wat je normaal ${currentMedia === 'boeken' ? 'luistert' : 'kijkt'} — een kans om ${pick.genre.toLowerCase()} te ontdekken!`
    : mood
      ? `Past bij je ${mood}e stemming${topGenres.length > 0 ? ' en je voorkeur voor ' + topGenres[0] : ''}`
      : `Past bij je smaakprofiel${topGenres.length > 0 ? ' — je houdt van ' + topGenres.slice(0,2).join(' en ') : ''}`;

  let smaak = wantNew
    ? `Je wilde iets nieuws proberen! Deze ${c.singular} valt buiten je gebruikelijke voorkeuren.`
    : `Op basis van je beoordelingen${mood ? ', je ' + mood + 'e stemming' : ''}${genre ? ' en voorkeur voor ' + genre.toLowerCase() : ''}.`;
  smaak += ' (offline modus)';

  return {
    smaakanalyse: smaak,
    aanbevelingen: [{ titel: pick.titel, auteur: pick.auteur, genre: pick.genre, reden, zoekterm: pick.titel }]
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
