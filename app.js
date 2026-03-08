// ===== State =====
let books = [];
let settings = {};
let currentPage = 'boeken';
let currentFilter = 'alle';
let currentBookId = null;
let importedBooks = [];
let deferredPrompt = null;

// ===== Page Titles =====
const pageTitles = {
  boeken: 'Mijn Boeken',
  toevoegen: 'Boek Toevoegen',
  aanbevelingen: 'Aanbevelingen',
  instellingen: 'Instellingen'
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadData();
  setupEventListeners();
  setupPWA();
  renderCurrentPage();
  checkReminder();
  updateNotificationStatus();
}

function loadData() {
  try {
    books = JSON.parse(localStorage.getItem('audioboek-books') || '[]');
    settings = JSON.parse(localStorage.getItem('audioboek-settings') || '{}');
  } catch (e) {
    books = [];
    settings = {};
  }
}

function saveBooks() {
  localStorage.setItem('audioboek-books', JSON.stringify(books));
}

function saveSettings() {
  localStorage.setItem('audioboek-settings', JSON.stringify(settings));
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Add book form
  document.getElementById('form-add-book').addEventListener('submit', function(e) {
    e.preventDefault();
    const titel = document.getElementById('input-titel').value.trim();
    const auteur = document.getElementById('input-auteur').value.trim();
    const genre = document.getElementById('input-genre').value;
    if (titel && auteur) {
      addBook(titel, auteur, genre);
      this.reset();
      showToast('Boek toegevoegd!');
    }
  });

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      renderBoeken();
    });
  });

  // Search
  document.getElementById('search-books').addEventListener('input', function() {
    renderBoeken();
  });

  // API key
  document.getElementById('input-api-key').value = settings.claudeApiKey || '';

  // Reminder frequency
  const freqSelect = document.getElementById('input-reminder-freq');
  freqSelect.value = settings.herinneringsFrequentie !== undefined ? settings.herinneringsFrequentie : '3';
}

// ===== PWA Setup =====
function setupPWA() {
  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  }

  // Install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btn-install').style.display = 'flex';
  });

  document.getElementById('btn-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        document.getElementById('btn-install').style.display = 'none';
      }
      deferredPrompt = null;
    }
  });
}

// ===== Navigation =====
function navigateTo(page) {
  currentPage = page;
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  // Update nav
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn[data-page="' + page + '"]').classList.add('active');
  // Update title
  document.getElementById('page-title').textContent = pageTitles[page];
  // Render page-specific content
  renderCurrentPage();
  // Scroll to top
  window.scrollTo(0, 0);
}

function renderCurrentPage() {
  switch (currentPage) {
    case 'boeken':
      renderBoeken();
      break;
    case 'aanbevelingen':
      renderAanbevelingen();
      break;
    case 'instellingen':
      updateNotificationStatus();
      break;
  }
}

// ===== Book Management =====
function addBook(titel, auteur, genre) {
  const book = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
    titel: titel,
    auteur: auteur,
    genre: genre || '',
    beoordeling: null,
    datumToegevoegd: new Date().toISOString()
  };
  books.push(book);
  saveBooks();
}

function getFilteredBooks() {
  let filtered = [...books];
  const search = document.getElementById('search-books').value.toLowerCase().trim();

  // Apply filter
  switch (currentFilter) {
    case 'onbeoordeeld':
      filtered = filtered.filter(b => b.beoordeling === null);
      break;
    case 'onzeker':
      filtered = filtered.filter(b => b.beoordeling === 0);
      break;
    case 'beoordeeld':
      filtered = filtered.filter(b => b.beoordeling !== null && b.beoordeling !== 0);
      break;
  }

  // Apply search
  if (search) {
    filtered = filtered.filter(b =>
      b.titel.toLowerCase().includes(search) ||
      b.auteur.toLowerCase().includes(search) ||
      (b.genre && b.genre.toLowerCase().includes(search))
    );
  }

  // Sort: unrated first, then by date added (newest first)
  filtered.sort((a, b) => {
    if (a.beoordeling === null && b.beoordeling !== null) return -1;
    if (a.beoordeling !== null && b.beoordeling === null) return 1;
    return new Date(b.datumToegevoegd) - new Date(a.datumToegevoegd);
  });

  return filtered;
}

function renderBoeken() {
  const list = document.getElementById('books-list');
  const emptyState = document.getElementById('empty-state');
  const filtered = getFilteredBooks();

  if (books.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Geen boeken gevonden</p></div>';
    return;
  }

  list.innerHTML = filtered.map(book => {
    let ratingDisplay = '';
    let ratingClass = 'rating-none';

    if (book.beoordeling === null) {
      ratingDisplay = '—';
      ratingClass = 'rating-none';
    } else if (book.beoordeling === 0) {
      ratingDisplay = '?';
      ratingClass = 'rating-unsure';
    } else if (book.beoordeling >= 6) {
      ratingDisplay = book.beoordeling;
      ratingClass = 'rating-high';
    } else if (book.beoordeling >= 4) {
      ratingDisplay = book.beoordeling;
      ratingClass = 'rating-mid';
    } else {
      ratingDisplay = book.beoordeling;
      ratingClass = 'rating-low';
    }

    const genreTag = book.genre ? `<span class="book-genre">${escapeHtml(book.genre)}</span>` : '';

    return `
      <div class="book-card" onclick="openRatingModal('${book.id}')">
        <div class="book-info">
          <div class="book-title">${escapeHtml(book.titel)}</div>
          <div class="book-author">${escapeHtml(book.auteur)}</div>
          ${genreTag}
        </div>
        <div class="book-rating ${ratingClass}">${ratingDisplay}</div>
      </div>
    `;
  }).join('');
}

// ===== Rating Modal =====
function openRatingModal(bookId) {
  currentBookId = bookId;
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  document.getElementById('modal-book-title').textContent = book.titel;
  document.getElementById('modal-book-author').textContent = book.auteur + (book.genre ? ' · ' + book.genre : '');

  // Highlight current rating
  document.querySelectorAll('.rating-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', book.beoordeling === i + 1);
  });
  document.querySelector('.btn-unsure').classList.toggle('selected', book.beoordeling === 0);

  document.getElementById('rating-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeRatingModal() {
  document.getElementById('rating-modal').style.display = 'none';
  document.body.style.overflow = '';
  currentBookId = null;
}

function rateBook(rating) {
  if (!currentBookId) return;
  const book = books.find(b => b.id === currentBookId);
  if (!book) return;

  book.beoordeling = rating;
  book.datumBeoordeeld = new Date().toISOString();
  saveBooks();

  closeRatingModal();
  renderBoeken();

  const label = rating === 0 ? 'Onzeker' : rating + '/7';
  showToast(`"${book.titel}" beoordeeld: ${label}`);
}

function deleteCurrentBook() {
  if (!currentBookId) return;
  const book = books.find(b => b.id === currentBookId);
  if (!book) return;

  if (confirm(`Weet je zeker dat je "${book.titel}" wilt verwijderen?`)) {
    books = books.filter(b => b.id !== currentBookId);
    saveBooks();
    closeRatingModal();
    renderBoeken();
    showToast('Boek verwijderd');
  }
}

// ===== Import =====
function parseImportText() {
  const text = document.getElementById('import-text').value.trim();
  if (!text) {
    showToast('Plak eerst een boekenlijst');
    return;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  importedBooks = [];

  // Try to detect format
  // Format 1: "Titel - Auteur" or "Titel — Auteur"
  const dashPattern = /^(.+?)\s*[-–—]\s*(.+)$/;
  // Format 2: "Titel door Auteur"
  const doorPattern = /^(.+?)\s+door\s+(.+)$/i;
  // Format 3: "Auteur: Titel" or "Auteur - Titel"
  // Format 4: Tab-separated
  const tabPattern = /^(.+?)\t(.+)$/;

  let matched = 0;

  for (const line of lines) {
    // Skip common header/noise lines
    if (line.match(/^(eerder geleend|mijn boeken|datum|pagina|resultaat)/i)) continue;
    if (line.match(/^\d+\s*(van|\/)\s*\d+$/)) continue; // pagination
    if (line.length < 3) continue;

    let titel = '';
    let auteur = '';

    // Try tab-separated first
    let match = line.match(tabPattern);
    if (match) {
      titel = match[1].trim();
      auteur = match[2].trim();
    }

    // Try "door" format
    if (!titel) {
      match = line.match(doorPattern);
      if (match) {
        titel = match[1].trim();
        auteur = match[2].trim();
      }
    }

    // Try dash format
    if (!titel) {
      match = line.match(dashPattern);
      if (match) {
        titel = match[1].trim();
        auteur = match[2].trim();
      }
    }

    // Fallback: treat entire line as title
    if (!titel) {
      titel = line;
      auteur = '';
    }

    // Clean up
    titel = titel.replace(/^["']|["']$/g, '').trim();
    auteur = auteur.replace(/^["']|["']$/g, '').trim();

    if (titel) {
      importedBooks.push({ titel, auteur, genre: '' });
      if (auteur) matched++;
    }
  }

  if (importedBooks.length === 0) {
    showToast('Geen boeken gevonden in de tekst');
    return;
  }

  renderImportPreview();
}

function renderImportPreview() {
  const preview = document.getElementById('import-preview');
  const list = document.getElementById('import-preview-list');

  list.innerHTML = importedBooks.map((book, i) => `
    <div class="import-item" data-index="${i}">
      <input type="text" value="${escapeAttr(book.titel)}" placeholder="Titel"
             onchange="importedBooks[${i}].titel = this.value">
      <input type="text" value="${escapeAttr(book.auteur)}" placeholder="Auteur"
             onchange="importedBooks[${i}].auteur = this.value">
      <button class="btn-remove" onclick="removeImportItem(${i})">&times;</button>
    </div>
  `).join('');

  preview.style.display = 'block';
  preview.scrollIntoView({ behavior: 'smooth' });
}

function removeImportItem(index) {
  importedBooks.splice(index, 1);
  if (importedBooks.length === 0) {
    cancelImport();
  } else {
    renderImportPreview();
  }
}

function cancelImport() {
  importedBooks = [];
  document.getElementById('import-preview').style.display = 'none';
}

function confirmImport() {
  let added = 0;
  for (const book of importedBooks) {
    if (book.titel.trim()) {
      addBook(book.titel.trim(), book.auteur.trim(), book.genre);
      added++;
    }
  }

  importedBooks = [];
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-text').value = '';

  showToast(`${added} boek${added !== 1 ? 'en' : ''} geïmporteerd!`);

  // Switch to books view
  setTimeout(() => navigateTo('boeken'), 500);
}

// ===== Aanbevelingen =====
function renderAanbevelingen() {
  const statsBar = document.getElementById('recommendation-stats');
  const total = books.length;
  const rated = books.filter(b => b.beoordeling !== null && b.beoordeling > 0).length;
  const unrated = books.filter(b => b.beoordeling === null).length;

  statsBar.innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Totaal</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${rated}</div>
      <div class="stat-label">Beoordeeld</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${unrated}</div>
      <div class="stat-label">Onbeoordeeld</div>
    </div>
  `;

  // Enable/disable recommendation button
  const btn = document.getElementById('btn-get-recs');
  const hasRatings = rated >= 3;
  btn.disabled = !hasRatings;
  if (!hasRatings) {
    btn.title = 'Beoordeel minstens 3 boeken voor aanbevelingen';
  }

  // Render onzeker section
  const onzekerBooks = books.filter(b => b.beoordeling === 0);
  const onzekerSection = document.getElementById('onzeker-section');

  if (onzekerBooks.length > 0) {
    onzekerSection.style.display = 'block';
    document.getElementById('onzeker-list').innerHTML = onzekerBooks.map(book => `
      <div class="onzeker-item">
        <div class="onzeker-info">
          <div class="onzeker-title">${escapeHtml(book.titel)}</div>
          <div class="onzeker-author">${escapeHtml(book.auteur)}</div>
        </div>
        <a href="https://nieuw.passendlezen.nl/zoeken?query=${encodeURIComponent(book.titel)}"
           target="_blank" class="btn-search-pl" rel="noopener">Zoeken</a>
      </div>
    `).join('');
  } else {
    onzekerSection.style.display = 'none';
  }
}

async function getRecommendations() {
  const apiKey = settings.claudeApiKey;
  if (!apiKey) {
    showToast('Stel eerst je API-sleutel in bij Instellingen');
    navigateTo('instellingen');
    return;
  }

  const ratedBooks = books.filter(b => b.beoordeling !== null);
  if (ratedBooks.length < 3) {
    showToast('Beoordeel minstens 3 boeken');
    return;
  }

  // Show loading
  document.getElementById('recommendations-loading').style.display = 'block';
  document.getElementById('recommendations-result').style.display = 'none';
  document.getElementById('btn-get-recs').disabled = true;

  const prompt = buildRecommendationPrompt(ratedBooks);

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
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API fout (${response.status})`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    displayRecommendations(text);
  } catch (error) {
    console.error('API error:', error);
    document.getElementById('recommendations-result').innerHTML = `
      <div class="card" style="border: 1.5px solid var(--error-light);">
        <h3 style="color: var(--error);">Er ging iets mis</h3>
        <p class="text-secondary">${escapeHtml(error.message)}</p>
        <p class="text-secondary" style="margin-top:8px;">Controleer je API-sleutel in Instellingen en probeer het opnieuw.</p>
      </div>
    `;
    document.getElementById('recommendations-result').style.display = 'block';
  } finally {
    document.getElementById('recommendations-loading').style.display = 'none';
    document.getElementById('btn-get-recs').disabled = false;
  }
}

function buildRecommendationPrompt(ratedBooks) {
  const bookList = ratedBooks.map(b => {
    const rating = b.beoordeling === 0 ? 'Onzeker (weet niet of ik het goed vond)' : `${b.beoordeling}/7`;
    return `- "${b.titel}" door ${b.auteur}${b.genre ? ` (${b.genre})` : ''} — Beoordeling: ${rating}`;
  }).join('\n');

  const allTitles = books.map(b => `"${b.titel}"`).join(', ');

  return `Je bent een audioboek-adviseur voor de Nederlandse dienst Passend Lezen (nieuw.passendlezen.nl).

Hier zijn de audioboeken die de gebruiker heeft beluisterd en beoordeeld:

${bookList}

Alle reeds geluisterde boeken (NIET opnieuw aanbevelen): ${allTitles}

Analyseer de smaak van deze luisteraar en doe 5 persoonlijke aanbevelingen voor audioboeken die beschikbaar zijn via Passend Lezen. Let op:
1. Welke genres, auteurs en thema's scoren hoog (6-7)?
2. Welke scoren laag (1-3)?
3. Boeken met "Onzeker" zijn twijfelgevallen.

Geef je antwoord in het Nederlands, strikt in dit JSON-formaat:
{
  "smaakanalyse": "korte beschrijving van de smaak van de luisteraar",
  "aanbevelingen": [
    {
      "titel": "Boektitel",
      "auteur": "Auteursnaam",
      "genre": "Genre",
      "reden": "Waarom dit boek bij de smaak past",
      "zoekterm": "zoekterm voor nieuw.passendlezen.nl/zoeken"
    }
  ]
}

Geef ALLEEN het JSON-object terug, zonder extra tekst.
Zorg ervoor dat de aanbevolen boeken realistisch zijn en waarschijnlijk beschikbaar als audioboek in het Nederlands via Passend Lezen.`;
}

function displayRecommendations(text) {
  const container = document.getElementById('recommendations-result');

  try {
    // Try to parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Geen JSON gevonden');

    const data = JSON.parse(jsonMatch[0]);

    let html = '';

    // Taste analysis
    if (data.smaakanalyse) {
      html += `
        <div class="taste-analysis">
          <h3>Jouw smaakprofiel</h3>
          <p>${escapeHtml(data.smaakanalyse)}</p>
        </div>
      `;
    }

    // Recommendations
    if (data.aanbevelingen && data.aanbevelingen.length > 0) {
      html += data.aanbevelingen.map((rec, i) => `
        <div class="rec-card">
          <h3>${i + 1}. ${escapeHtml(rec.titel)}</h3>
          <div class="rec-author">${escapeHtml(rec.auteur)}</div>
          ${rec.genre ? `<span class="rec-genre">${escapeHtml(rec.genre)}</span>` : ''}
          <p class="rec-reason">${escapeHtml(rec.reden)}</p>
          <a href="https://nieuw.passendlezen.nl/zoeken?query=${encodeURIComponent(rec.zoekterm || rec.titel)}"
             target="_blank" class="btn-search-pl" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Zoeken op Passend Lezen
          </a>
        </div>
      `).join('');
    }

    container.innerHTML = html;
  } catch (e) {
    // Fallback: display as formatted text
    container.innerHTML = `
      <div class="card">
        <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(text)}</div>
      </div>
    `;
  }

  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

// ===== Notifications & Reminders =====
function checkReminder() {
  const freq = settings.herinneringsFrequentie;
  if (freq === undefined || freq === 0) return;

  const lastReminder = localStorage.getItem('audioboek-lastReminder');
  const now = Date.now();
  const last = lastReminder ? parseInt(lastReminder) : 0;
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);

  const unrated = books.filter(b => b.beoordeling === null).length;

  if (daysSince >= freq && unrated > 0) {
    showReminderBanner(unrated);
    // Try notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Audioboek Beoordelingen', {
          body: `Je hebt nog ${unrated} onbeoordeelde boek${unrated !== 1 ? 'en' : ''}. Beoordeel er een paar!`,
          icon: 'icon.svg',
          tag: 'audioboek-reminder'
        });
      } catch (e) {
        // Notifications not supported in this context
      }
    }
    localStorage.setItem('audioboek-lastReminder', now.toString());
  }
}

function showReminderBanner(count) {
  const banner = document.getElementById('reminder-banner');
  document.getElementById('reminder-text').textContent =
    `Je hebt nog ${count} onbeoordeeld${count !== 1 ? 'e boeken' : ' boek'}. Beoordeel er een paar!`;
  banner.style.display = 'flex';
}

function dismissReminder() {
  document.getElementById('reminder-banner').style.display = 'none';
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Meldingen worden niet ondersteund in deze browser');
    return;
  }

  const result = await Notification.requestPermission();
  updateNotificationStatus();

  if (result === 'granted') {
    showToast('Meldingen ingeschakeld!');
  } else if (result === 'denied') {
    showToast('Meldingen geweigerd. Wijzig dit in je browserinstellingen.');
  }
}

function updateNotificationStatus() {
  const statusEl = document.getElementById('notification-status');
  const btnEl = document.getElementById('btn-enable-notifications');

  if (!('Notification' in window)) {
    statusEl.textContent = 'Meldingen worden niet ondersteund in deze browser.';
    btnEl.style.display = 'none';
    return;
  }

  switch (Notification.permission) {
    case 'granted':
      statusEl.textContent = 'Meldingen zijn ingeschakeld.';
      btnEl.style.display = 'none';
      break;
    case 'denied':
      statusEl.textContent = 'Meldingen zijn geblokkeerd. Wijzig dit in je browserinstellingen.';
      btnEl.style.display = 'none';
      break;
    default:
      statusEl.textContent = 'Schakel meldingen in om herinneringen te ontvangen.';
      btnEl.style.display = 'block';
  }
}

// ===== Settings =====
function saveApiKey() {
  const key = document.getElementById('input-api-key').value.trim();
  settings.claudeApiKey = key;
  saveSettings();
  showToast(key ? 'API-sleutel opgeslagen' : 'API-sleutel verwijderd');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('input-api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function saveReminderFreq() {
  const freq = parseInt(document.getElementById('input-reminder-freq').value);
  settings.herinneringsFrequentie = freq;
  saveSettings();
  showToast(freq === 0 ? 'Herinneringen uitgeschakeld' : `Herinnering ingesteld: om de ${freq} dag${freq !== 1 ? 'en' : ''}`);
}

// ===== Data Export/Import =====
function exportData() {
  const data = {
    versie: '1.0',
    exportDatum: new Date().toISOString(),
    boeken: books,
    instellingen: {
      herinneringsFrequentie: settings.herinneringsFrequentie
    }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audioboek-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Gegevens geëxporteerd');
}

function importDataFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.boeken && Array.isArray(data.boeken)) {
        const count = data.boeken.length;
        if (confirm(`${count} boek${count !== 1 ? 'en' : ''} importeren? Dit vervangt je huidige gegevens niet, maar voegt toe.`)) {
          // Merge: add books that don't exist yet (by title+author)
          let added = 0;
          for (const book of data.boeken) {
            const exists = books.some(b =>
              b.titel.toLowerCase() === book.titel.toLowerCase() &&
              b.auteur.toLowerCase() === book.auteur.toLowerCase()
            );
            if (!exists) {
              books.push(book);
              added++;
            }
          }
          saveBooks();
          renderBoeken();
          showToast(`${added} nieuw${added !== 1 ? 'e' : ''} boek${added !== 1 ? 'en' : ''} toegevoegd`);
        }
      } else {
        showToast('Ongeldig bestandsformaat');
      }
    } catch (err) {
      showToast('Fout bij het lezen van het bestand');
    }
  };
  reader.readAsText(file);
  // Reset file input
  event.target.value = '';
}

function clearAllData() {
  if (confirm('Weet je zeker dat je ALLE gegevens wilt wissen? Dit kan niet ongedaan worden gemaakt.')) {
    if (confirm('Dit verwijdert al je boeken en beoordelingen permanent. Doorgaan?')) {
      books = [];
      settings = {};
      localStorage.removeItem('audioboek-books');
      localStorage.removeItem('audioboek-settings');
      localStorage.removeItem('audioboek-lastReminder');
      document.getElementById('input-api-key').value = '';
      document.getElementById('input-reminder-freq').value = '3';
      renderBoeken();
      showToast('Alle gegevens gewist');
    }
  }
}

// ===== Utility =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}
