// ===== STATE =====
let currentTab = 'home';
let currentBooks = [];
let selectedBook = null;
let searchTimeout = null;
let currentLang = 'all'; // 'all', 'uk', 'ru', 'en'
let currentStatusFilter = 'all';
let modalDescExpanded = false;
let selectedRating = 0;
let viewMode = 'grid'; // 'grid' | 'list'

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
  await renderHome();
  setupSearch();
});

// ===== NAVIGATION =====
function navigate(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-nav="${tab}"]`).classList.add('active');
  renderPage();
}

async function renderPage() {
  const main = document.getElementById('main');
  switch (currentTab) {
    case 'home': await renderHome(); break;
    case 'library': await renderLibrary(); break;
    case 'search': renderSearch(); break;
    case 'recommendations': await renderRecommendations(); break;
    case 'stats': await renderStats(); break;
  }
}

// ===== HOME =====
async function renderHome() {
  const main = document.getElementById('main');
  const reading = await getBooksByStatus('reading');
  const read = await getBooksByStatus('read');
  const want = await getBooksByStatus('want');

  main.innerHTML = `
    <div class="header">
      <span>📚</span>
      <h1>BookShelf</h1>
      <button onclick="toggleView()" style="background:none;border:none;color:var(--text2);font-size:1.2rem;cursor:pointer">
        ${viewMode === 'grid' ? '☰' : '⊞'}
      </button>
    </div>

    <div class="stats-bar">
      <div class="stat-card"><div class="num">${reading.length}</div><div class="lbl">Читаю</div></div>
      <div class="stat-card"><div class="num">${read.length}</div><div class="lbl">Прочитав</div></div>
      <div class="stat-card"><div class="num">${want.length}</div><div class="lbl">Хочу</div></div>
      <div class="stat-card"><div class="num">${reading.length + read.length + want.length}</div><div class="lbl">Всього</div></div>
    </div>

    ${reading.length ? `
      <div class="section">
        <div class="section-title">📖 Зараз читаю</div>
        <div class="books-list">
          ${reading.map(b => renderBookListItem(b)).join('')}
        </div>
      </div>` : ''}

    ${want.length ? `
      <div class="section">
        <div class="section-title">🔖 Хочу прочитати</div>
        <div class="books-${viewMode}">
          ${viewMode === 'grid'
            ? want.slice(0, 6).map(b => renderBookCard(b)).join('')
            : want.slice(0, 6).map(b => renderBookListItem(b)).join('')
          }
        </div>
      </div>` : `
      <div class="empty-state">
        <div class="emoji">📚</div>
        <h3>Бібліотека порожня</h3>
        <p>Знайди цікаві книги<br>через пошук або рекомендації</p>
      </div>`
    }
  `;
}

// ===== LIBRARY =====
async function renderLibrary() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="header"><span>📚</span><h1>Бібліотека</h1></div>
    <div class="tabs">
      ${['all','reading','want','read'].map(s => `
        <button class="tab-btn ${currentStatusFilter === s ? 'active' : ''}"
          onclick="filterLibrary('${s}')">
          ${s === 'all' ? 'Всі' : s === 'reading' ? '📖 Читаю' : s === 'want' ? '🔖 Хочу' : '✅ Прочитав'}
        </button>`).join('')}
    </div>
  `;

  let books;
  if (currentStatusFilter === 'all') books = await getAllBooks();
  else books = await getBooksByStatus(currentStatusFilter);

  if (!books.length) {
    main.innerHTML += `
      <div class="empty-state">
        <div class="emoji">${currentStatusFilter === 'all' ? '📚' : currentStatusFilter === 'read' ? '✅' : '📖'}</div>
        <h3>Тут поки порожньо</h3>
        <p>Додай книги через пошук</p>
      </div>`;
    return;
  }

  main.innerHTML += `
    <div class="section">
      <div class="books-${viewMode}">
        ${books.map(b => viewMode === 'grid' ? renderBookCard(b) : renderBookListItem(b)).join('')}
      </div>
    </div>`;
}

async function filterLibrary(status) {
  currentStatusFilter = status;
  await renderLibrary();
}

// ===== SEARCH PAGE =====
function renderSearch() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="header"><span>🔍</span><h1>Пошук книг</h1></div>
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="Назва, автор, ISBN..."
        value="" autocomplete="off" autocorrect="off" spellcheck="false">
      <button onclick="doSearch()">🔍</button>
    </div>
    <div class="lang-toggle">
      ${[['all','Всі'],['uk','🇺🇦 UA'],['ru','RU'],['en','EN']].map(([v,l]) => `
        <button class="lang-btn ${currentLang === v ? 'active' : ''}"
          onclick="setLang('${v}')">${l}</button>`).join('')}
    </div>
    <div id="searchResults">
      <div class="empty-state">
        <div class="emoji">🔍</div>
        <h3>Шукай книги</h3>
        <p>Google Books + Open Library<br>Мільйони книг на всіх мовах</p>
      </div>
    </div>
  `;

  const input = document.getElementById('searchInput');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    if (input.value.length > 2) searchTimeout = setTimeout(doSearch, 600);
  });
  input.focus();
}

function setLang(lang) {
  currentLang = lang;
  renderSearch();
}

async function doSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;

  const container = document.getElementById('searchResults');
  container.innerHTML = '<div class="search-loading"><div class="spinner"></div></div>';

  let results = await searchBooks(q);

  if (currentLang !== 'all') {
    results = results.filter(b => {
      if (currentLang === 'uk') return b.language === 'uk' || b.language === 'ukr';
      if (currentLang === 'ru') return b.language === 'ru' || b.language === 'rus';
      if (currentLang === 'en') return b.language === 'en' || b.language === 'eng';
      return true;
    });
  }

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">😔</div>
        <h3>Нічого не знайдено</h3>
        <p>Спробуй іншу назву або автора</p>
      </div>`;
    return;
  }

  currentBooks = results;
  container.innerHTML = `
    <div class="section">
      <div class="section-title">${results.length} результатів</div>
      <div class="books-list">
        ${results.map(b => renderBookListItem(b, true)).join('')}
      </div>
    </div>`;
}

// ===== RECOMMENDATIONS =====
async function renderRecommendations() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="header"><span>✨</span><h1>Рекомендації</h1></div>
    <div class="search-loading"><div class="spinner"></div></div>
  `;

  const recs = await getRecommendations();
  if (!recs.length) {
    main.innerHTML += `<div class="empty-state"><div class="emoji">✨</div><h3>Немає рекомендацій</h3><p>Додай кілька книг, щоб отримати персональні рекомендації</p></div>`;
    return;
  }

  main.innerHTML = `
    <div class="header"><span>✨</span><h1>Рекомендації</h1></div>
    <div class="section">
      <div class="section-title">На основі твоїх смаків</div>
      <div class="books-grid">
        ${recs.map(b => renderBookCard(b)).join('')}
      </div>
    </div>`;
}

// ===== STATS =====
async function renderStats() {
  const main = document.getElementById('main');
  const all = await getAllBooks();
  const reading = all.filter(b => b.status === 'reading');
  const read = all.filter(b => b.status === 'read');
  const want = all.filter(b => b.status === 'want');

  const totalPages = read.reduce((s, b) => s + (b.pageCount || 0), 0);
  const avgRating = read.filter(b => b.userRating).length
    ? (read.reduce((s, b) => s + (b.userRating || 0), 0) / read.filter(b => b.userRating).length).toFixed(1)
    : '—';

  // Жанровий розподіл
  const cats = {};
  all.forEach(b => b.categories?.forEach(c => { cats[c] = (cats[c] || 0) + 1; }));
  const topCats = Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0,5);

  main.innerHTML = `
    <div class="header"><span>📊</span><h1>Статистика</h1></div>
    <div class="section">
      <div class="section-title">Загальне</div>
      <div class="stats-bar" style="margin:0 0 16px">
        <div class="stat-card"><div class="num">${read.length}</div><div class="lbl">Прочитано</div></div>
        <div class="stat-card"><div class="num">${reading.length}</div><div class="lbl">Читаю</div></div>
        <div class="stat-card"><div class="num">${totalPages.toLocaleString()}</div><div class="lbl">Сторінок</div></div>
        <div class="stat-card"><div class="num">${avgRating}</div><div class="lbl">Рейтинг</div></div>
      </div>

      ${topCats.length ? `
        <div class="section-title" style="margin-top:16px">Топ жанрів</div>
        ${topCats.map(([cat, cnt]) => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
              <span>${cat}</span><span style="color:var(--text2)">${cnt}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${Math.round(cnt/all.length*100)}%"></div>
            </div>
          </div>`).join('')}
      ` : ''}

      ${read.filter(b => b.userRating >= 4).length ? `
        <div class="section-title" style="margin-top:16px">⭐ Найкращі прочитані</div>
        <div class="books-list">
          ${read.filter(b => b.userRating >= 4).sort((a,b)=>(b.userRating||0)-(a.userRating||0)).slice(0,5)
            .map(b => renderBookListItem(b)).join('')}
        </div>` : ''}
    </div>`;
}

// ===== RENDER HELPERS =====
function renderBookCard(book) {
  const statusBadge = book.status ? `
    <span class="status-badge badge-${book.status}">
      ${book.status === 'reading' ? '📖' : book.status === 'read' ? '✅' : '🔖'}
    </span>` : '';

  return `
    <div class="book-card" onclick="openBook('${book.id}')">
      ${statusBadge}
      <div class="cover">
        ${book.cover
          ? `<img src="${book.cover}" alt="${escHtml(book.title)}" loading="lazy">`
          : '📚'}
      </div>
      <div class="info">
        <div class="title">${escHtml(book.title)}</div>
        <div class="author">${escHtml(book.authors?.[0] || '')}</div>
        ${book.userRating ? `<div class="stars">${'★'.repeat(book.userRating)}${'☆'.repeat(5-book.userRating)}</div>` : ''}
      </div>
    </div>`;
}

function renderBookListItem(book, showSource = false) {
  const progress = book.status === 'reading' && book.currentPage && book.pageCount
    ? Math.round(book.currentPage / book.pageCount * 100) : 0;

  return `
    <div class="book-list-item" onclick="openBook('${book.id}')">
      <div class="mini-cover">
        ${book.cover ? `<img src="${book.cover}" loading="lazy">` : '📚'}
      </div>
      <div class="meta">
        <div class="title">${escHtml(book.title)}</div>
        <div class="author">${escHtml(book.authors?.[0] || 'Невідомий автор')}</div>
        <div class="extra">
          ${book.status ? `<span class="tag ${book.status === 'reading' ? 'badge-reading' : book.status === 'read' ? 'badge-read' : 'badge-want'}">
            ${book.status === 'reading' ? '📖 Читаю' : book.status === 'read' ? '✅ Прочитав' : '🔖 Хочу'}
          </span>` : ''}
          ${book.publishedDate ? `<span class="tag">${book.publishedDate.substring(0,4)}</span>` : ''}
          ${book.pageCount ? `<span class="tag">${book.pageCount} стор.</span>` : ''}
          ${showSource ? `<span class="tag">${book.source === 'google' ? '🔵 Google' : '📗 OpenLib'}</span>` : ''}
        </div>
        ${progress ? `
          <div class="progress-bar" style="margin-top:6px">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          <div style="font-size:0.7rem;color:var(--text2);margin-top:2px">${progress}%</div>
        ` : ''}
        ${book.userRating ? `<div class="stars" style="margin-top:4px">${'★'.repeat(book.userRating)}${'☆'.repeat(5-book.userRating)}</div>` : ''}
      </div>
    </div>`;
}

// ===== BOOK MODAL =====
async function openBook(bookId) {
  // Шукаємо в збережених, потім у поточних результатах пошуку
  let book = await getBook(bookId);
  if (!book) book = currentBooks.find(b => b.id === bookId);
  if (!book) return;

  selectedBook = book;
  selectedRating = book.userRating || 0;
  modalDescExpanded = false;

  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  const isSaved = !!(await getBook(bookId));

  content.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-content">
      <div class="modal-cover">
        ${book.cover ? `<img src="${book.cover}" alt="">` : '📚'}
      </div>
      <div class="modal-title">${escHtml(book.title)}</div>
      <div class="modal-author">${escHtml(book.authors?.join(', ') || '')}</div>

      ${book.description ? `
        <div class="modal-desc" id="modalDesc">${escHtml(book.description)}</div>
        <button onclick="toggleDesc()" style="background:none;border:none;color:var(--accent);font-size:0.82rem;cursor:pointer;margin-bottom:12px">
          Читати більше
        </button>` : ''}

      <div class="modal-info-row">
        ${book.publishedDate ? `<span class="info-chip">📅 ${book.publishedDate.substring(0,4)}</span>` : ''}
        ${book.pageCount ? `<span class="info-chip">📄 ${book.pageCount} стор.</span>` : ''}
        ${book.language ? `<span class="info-chip">🌐 ${langName(book.language)}</span>` : ''}
        ${book.rating ? `<span class="info-chip">⭐ ${book.rating} (${book.ratingsCount})</span>` : ''}
      </div>

      <div class="section-title" style="margin-bottom:8px">Статус</div>
      <div class="status-btns">
        <button class="status-btn ${book.status === 'want' ? 'active-want' : ''}"
          onclick="setStatus('want')">
          <span class="s-icon">🔖</span>Хочу
        </button>
        <button class="status-btn ${book.status === 'reading' ? 'active-reading' : ''}"
          onclick="setStatus('reading')">
          <span class="s-icon">📖</span>Читаю
        </button>
        <button class="status-btn ${book.status === 'read' ? 'active-read' : ''}"
          onclick="setStatus('read')">
          <span class="s-icon">✅</span>Прочитав
        </button>
      </div>

      ${book.status === 'reading' ? `
        <div class="section-title" style="margin-bottom:8px">Прогрес читання</div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
          <input type="number" id="currentPageInput"
            value="${book.currentPage || 0}"
            min="0" max="${book.pageCount || 9999}"
            style="width:80px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:var(--surface2);color:var(--text);font-size:0.9rem"
            onchange="updateProgress(this.value)"
            placeholder="Стор.">
          <span style="color:var(--text2);font-size:0.85rem">з ${book.pageCount || '?'}</span>
          ${book.pageCount ? `
            <div style="flex:1">
              <div class="progress-bar">
                <div class="progress-fill" id="modalProgressFill"
                  style="width:${book.currentPage ? Math.round(book.currentPage/book.pageCount*100) : 0}%"></div>
              </div>
            </div>` : ''}
        </div>` : ''}

      ${book.status === 'read' ? `
        <div class="section-title" style="margin-bottom:8px">Моя оцінка</div>
        <div class="rating-input" id="ratingInput">
          ${[1,2,3,4,5].map(i => `
            <span class="rating-star ${i <= selectedRating ? 'active' : ''}"
              onclick="setRating(${i})">★</span>`).join('')}
        </div>` : ''}

      <div class="section-title" style="margin-bottom:8px">Нотатки</div>
      <textarea class="notes-area" id="notesArea"
        placeholder="Думки, цитати, враження...">${escHtml(book.notes || '')}</textarea>

      ${isSaved ? `
        <button class="btn-primary" onclick="saveBookData()">💾 Зберегти</button>
        ${book.previewLink ? `
          <button class="btn-secondary" onclick="openPreview()">🔗 Читати онлайн</button>` : ''}
        <button class="btn-secondary" onclick="removeBook()" style="color:#e74c3c">🗑 Видалити</button>
      ` : `
        <button class="btn-primary" onclick="addBookAndSave('want')">🔖 Хочу прочитати</button>
        <button class="btn-secondary" onclick="addBookAndSave('reading')">📖 Зараз читаю</button>
        ${book.previewLink ? `
          <button class="btn-secondary" onclick="openPreview()">🔗 Читати онлайн</button>` : ''}
      `}
    </div>`;

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  selectedBook = null;
}

function toggleDesc() {
  const el = document.getElementById('modalDesc');
  if (!el) return;
  modalDescExpanded = !modalDescExpanded;
  el.classList.toggle('expanded', modalDescExpanded);
}

async function setStatus(status) {
  if (!selectedBook) return;
  selectedBook.status = status;
  // Оновлюємо кнопки
  document.querySelectorAll('.status-btn').forEach(b => {
    b.className = 'status-btn';
  });
  const map = { want: 'active-want', reading: 'active-reading', read: 'active-read' };
  event.currentTarget.className = `status-btn ${map[status]}`;

  // Якщо читаю — показуємо прогрес
  if (status === 'reading' && !document.getElementById('currentPageInput')) {
    await openBook(selectedBook.id);
  }

  const existing = await getBook(selectedBook.id);
  if (existing) {
    existing.status = status;
    await saveBook(existing);
    showToast(`Статус оновлено: ${status === 'reading' ? 'Читаю' : status === 'read' ? 'Прочитав' : 'Хочу'}`);
  }
}

async function addBookAndSave(status) {
  if (!selectedBook) return;
  const book = { ...selectedBook, status, addedAt: Date.now() };
  await saveBook(book);
  showToast('📚 Додано до бібліотеки!');
  await openBook(book.id);
}

async function saveBookData() {
  if (!selectedBook) return;
  const notes = document.getElementById('notesArea')?.value || '';
  const existing = await getBook(selectedBook.id);
  if (existing) {
    existing.notes = notes;
    existing.userRating = selectedRating;
    await saveBook(existing);
    showToast('✅ Збережено!');
  }
}

async function removeBook() {
  if (!selectedBook) return;
  await deleteBook(selectedBook.id);
  closeModal();
  showToast('🗑 Видалено з бібліотеки');
  await renderPage();
}

async function updateProgress(page) {
  if (!selectedBook) return;
  const book = await getBook(selectedBook.id);
  if (!book) return;
  book.currentPage = parseInt(page) || 0;
  await saveBook(book);
  if (book.pageCount) {
    const pct = Math.round(book.currentPage / book.pageCount * 100);
    const fill = document.getElementById('modalProgressFill');
    if (fill) fill.style.width = pct + '%';
  }
}

function setRating(r) {
  selectedRating = r;
  document.querySelectorAll('.rating-star').forEach((s, i) => {
    s.classList.toggle('active', i < r);
  });
}

function openPreview() {
  if (selectedBook?.previewLink) {
    window.open(selectedBook.previewLink, '_blank');
  }
}

// ===== UTILITIES =====
function toggleView() {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  renderPage();
}

function setupSearch() {
  // глобальний обробник свайпу вниз для закриття модалки
  const overlay = document.getElementById('modalOverlay');
  let startY = 0;
  overlay.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80) closeModal();
  }, { passive: true });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function langName(code) {
  const map = { uk: '🇺🇦 Укр', ru: '🇷🇺 Рус', en: '🇬🇧 Англ', de: '🇩🇪 Нім',
    fr: '🇫🇷 Фр', pl: '🇵🇱 Пол' };
  return map[code] || code;
}
