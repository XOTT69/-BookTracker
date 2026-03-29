// State
let myLibrary = [];
let currentBook = null;
let currentEpubFile = null;
let bookRendition = null;
let bookObj = null;
let recommendationsLoaded = false;

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Load library from IndexedDB
    const saved = await localforage.getItem('myLibrary');
    if (saved) myLibrary = saved;
    renderLibrary('reading');

    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            document.getElementById('header-title').innerText = e.target.innerText.split(' ')[1];

            // Load recommendations when opening the tab
            if (targetId === 'tab-recommendations') {
                loadRecommendations();
            }
        });
    });

    // Library Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderLibrary(e.target.getAttribute('data-status'));
        });
    });

    // Search action
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Modal close
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    window.onclick = (e) => { if (e.target == document.getElementById('book-modal')) closeModal(); };

    // Book Actions
    document.getElementById('save-book-btn').addEventListener('click', saveCurrentBook);
    document.getElementById('delete-book-btn').addEventListener('click', deleteCurrentBook);
    document.getElementById('read-book-btn').addEventListener('click', openReader);
    
    // EPUB Upload
    document.getElementById('epub-upload').addEventListener('change', handleEpubUpload);

    // Reader Controls
    document.getElementById('close-reader').addEventListener('click', () => {
        document.getElementById('tab-reader').style.display = 'none';
        if (bookObj) bookObj.destroy();
    });
    document.getElementById('prev-page').addEventListener('click', () => bookRendition && bookRendition.prev());
    document.getElementById('next-page').addEventListener('click', () => bookRendition && bookRendition.next());
});

// --- Search API ---
async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p>Шукаю...</p>';

    try {
        const [googleRes, openLibRes] = await Promise.all([
            fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`).catch(() => null),
            fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`).catch(() => null)
        ]);

        let results = [];

        if (googleRes && googleRes.ok) {
            const googleData = await googleRes.json();
            results = results.concat(parseGoogleData(googleData));
        }

        if (openLibRes && openLibRes.ok) {
            const openData = await openLibRes.json();
            if (openData.docs) {
                results = results.concat(openData.docs.map(item => ({
                    id: 'ol_' + item.key.split('/').pop(),
                    title: item.title,
                    author: item.author_name ? item.author_name.join(', ') : 'Невідомий автор',
                    cover: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : 'https://via.placeholder.com/120x180?text=Немає+обкладинки'
                })));
            }
        }

        renderGrid(results, resultsDiv);
    } catch (e) {
        resultsDiv.innerHTML = '<p>Помилка пошуку.</p>';
    }
}

function parseGoogleData(data) {
    if (!data || !data.items) return [];
    return data.items.map(item => ({
        id: 'gb_' + item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Невідомий автор',
        cover: item.volumeInfo.imageLinks ? item.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:') : 'https://via.placeholder.com/120x180?text=Немає+обкладинки'
    }));
}

// --- Recommendations API ---
async function loadRecommendations() {
    if (recommendationsLoaded) return;

    const recPersonal = document.getElementById('rec-personal');
    const recMagic = document.getElementById('rec-magic');
    const recGenre = document.getElementById('rec-genre');
    const dynamicGenreTitle = document.getElementById('dynamic-genre-title');
    const hintText = document.getElementById('personal-hint');

    recPersonal.innerHTML = '<p style="padding-left:10px;">Аналізуємо ваші смаки...</p>';
    recMagic.innerHTML = '<p style="padding-left:10px;">Шукаємо магію...</p>';
    recGenre.innerHTML = '<p style="padding-left:10px;">Підбираємо жанр...</p>';

    const readBooks = myLibrary.filter(b => b.status === 'read');
    let personalQuery = 'бестселери українською';

    if (readBooks.length > 0) {
        hintText.innerText = 'Схоже на те, що ви вже прочитали';
        const randomBook = readBooks[Math.floor(Math.random() * readBooks.length)];
        const author = randomBook.author.split(',')[0]; 
        if (author && !author.includes('Невідомий')) {
            personalQuery = `inauthor:"${author}"`;
        } else {
            personalQuery = randomBook.title.split(' ').slice(0, 2).join(' '); 
        }
    }

    const magicQuery = '"магічна академія" OR "академия магии" OR "magical academy" OR "школа магії"';

    const genres = [
        { name: '🔥 Темне фентезі', query: 'subject:"dark fantasy" OR "темне фентезі"' },
        { name: '🚀 Наукова фантастика', query: 'subject:"science fiction" OR "космос"' },
        { name: '🕵️ Детективи та трилери', query: 'subject:"detective" OR "трилер"' },
        { name: '⚔️ ЛітрПГ / Ігрові світи', query: '"LitRPG" OR "ЛитРПГ"' },
        { name: '💻 Кіберпанк', query: 'subject:"cyberpunk" OR "кіберпанк"' }
    ];
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    dynamicGenreTitle.innerText = randomGenre.name;

    try {
        const [resPersonal, resMagic, resGenre] = await Promise.all([
            fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(personalQuery)}&maxResults=10`),
            fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(magicQuery)}&maxResults=20`),
            fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(randomGenre.query)}&maxResults=15`)
        ]);

        const dataPersonal = await resPersonal.json();
        const dataMagic = await resMagic.json();
        const dataGenre = await resGenre.json();

        renderRow(parseGoogleData(dataPersonal), recPersonal);
        renderRow(parseGoogleData(dataMagic), recMagic);
        renderRow(parseGoogleData(dataGenre), recGenre);

        recommendationsLoaded = true;
    } catch (e) {
        const errHtml = '<p style="padding-left:10px;">Помилка завантаження.</p>';
        recPersonal.innerHTML = errHtml;
        recMagic.innerHTML = errHtml;
        recGenre.innerHTML = errHtml;
    }
}

// --- Renderers ---
function renderGrid(books, container) {
    container.innerHTML = '';
    if (books.length === 0) {
        container.innerHTML = '<p>Нічого не знайдено.</p>';
        return;
    }
    books.forEach(book => {
        const div = createBookCard(book);
        container.appendChild(div);
    });
}

function renderRow(books, container) {
    container.innerHTML = '';
    if (books.length === 0) {
        container.innerHTML = '<p class="hint-text">На жаль, нічого не знайдено.</p>';
        return;
    }
    
    const uniqueBooks = [];
    const ids = new Set();
    books.forEach(book => {
        if (!ids.has(book.id)) {
            ids.add(book.id);
            uniqueBooks.push(book);
        }
    });

    uniqueBooks.forEach(book => {
        const div = createBookCard(book);
        container.appendChild(div);
    });
}

function createBookCard(book) {
    const div = document.createElement('div');
    div.className = 'book-card';
    div.innerHTML = `
        <img src="${book.cover}" alt="cover" loading="lazy">
        <h3>${book.title}</h3>
        <p>${book.author}</p>
    `;
    div.onclick = () => openModal(book);
    return div;
}

function renderLibrary(status) {
    const filtered = myLibrary.filter(b => b.status === status);
    renderGrid(filtered, document.getElementById('library-list'));
}

// --- Modal & Storage Logic ---
async function openModal(book) {
    currentBook = { ...book };
    document.getElementById('modal-title').innerText = book.title;
    document.getElementById('modal-author').innerText = book.author;
    document.getElementById('modal-cover').src = book.cover;
    
    const existing = myLibrary.find(b => b.id === book.id);
    if (existing) {
        currentBook = existing;
        document.getElementById('modal-status').value = existing.status;
        document.getElementById('delete-book-btn').style.display = 'block';
        document.getElementById('save-book-btn').innerText = 'Оновити';
    } else {
        document.getElementById('modal-status').value = 'want';
        document.getElementById('delete-book-btn').style.display = 'none';
        document.getElementById('save-book-btn').innerText = 'Додати в бібліотеку';
    }

    const hasEpub = await localforage.getItem(`epub_${book.id}`);
    if (hasEpub) {
        document.getElementById('read-book-btn').style.display = 'block';
        currentEpubFile = hasEpub;
    } else {
        document.getElementById('read-book-btn').style.display = 'none';
        currentEpubFile = null;
    }

    document.getElementById('book-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('book-modal').style.display = 'none';
}

async function saveCurrentBook() {
    currentBook.status = document.getElementById('modal-status').value;
    const index = myLibrary.findIndex(b => b.id === currentBook.id);
    if (index >= 0) {
        myLibrary[index] = currentBook;
    } else {
        myLibrary.push(currentBook);
    }
    await localforage.setItem('myLibrary', myLibrary);
    
    // Refresh library view if currently active
    if (document.getElementById('tab-library').classList.contains('active')) {
        renderLibrary(document.querySelector('.filter-btn.active').getAttribute('data-status'));
    }
    closeModal();
}

async function deleteCurrentBook() {
    myLibrary = myLibrary.filter(b => b.id !== currentBook.id);
    await localforage.setItem('myLibrary', myLibrary);
    await localforage.removeItem(`epub_${currentBook.id}`);
    
    if (document.getElementById('tab-library').classList.contains('active')) {
        renderLibrary(document.querySelector('.filter-btn.active').getAttribute('data-status'));
    }
    closeModal();
}

// --- EPUB Logic ---
async function handleEpubUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    await localforage.setItem(`epub_${currentBook.id}`, file);
    currentEpubFile = file;
    
    alert('Книгу успішно завантажено! Тепер можна читати офлайн.');
    document.getElementById('read-book-btn').style.display = 'block';
    
    // Auto-save book to library if it's new
    if (!myLibrary.find(b => b.id === currentBook.id)) {
        saveCurrentBook(); 
    }
}

function openReader() {
    if (!currentEpubFile) return;
    closeModal();
    document.getElementById('tab-reader').style.display = 'block';
    
    bookObj = ePub(currentEpubFile);
    const viewer = document.getElementById('viewer');
    viewer.innerHTML = ''; 
    
    bookRendition = bookObj.renderTo("viewer", {
        width: "100%",
        height: "100%",
        spread: "none"
    });

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
        bookRendition.themes.default({
            body: { background: '#000000 !important', color: '#ffffff !important' }
        });
    }

    bookRendition.display();
}
