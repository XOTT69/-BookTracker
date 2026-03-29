const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
// Google Books не потребує ключа для базового пошуку (до 1000 запитів/день)

async function searchGoogleBooks(query, lang = '') {
  try {
    const langFilter = lang ? `&langRestrict=${lang}` : '';
    const res = await fetch(
      `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=20&printType=books${langFilter}`
    );
    const data = await res.json();
    if (!data.items) return [];
    return data.items.map(item => ({
      id: 'gb_' + item.id,
      source: 'google',
      title: item.volumeInfo.title || 'Без назви',
      authors: item.volumeInfo.authors || ['Невідомий автор'],
      description: item.volumeInfo.description || '',
      cover: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
      publishedDate: item.volumeInfo.publishedDate || '',
      pageCount: item.volumeInfo.pageCount || 0,
      categories: item.volumeInfo.categories || [],
      language: item.volumeInfo.language || '',
      previewLink: item.volumeInfo.previewLink || '',
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || '',
      rating: item.volumeInfo.averageRating || 0,
      ratingsCount: item.volumeInfo.ratingsCount || 0
    }));
  } catch (e) {
    console.error('Google Books error:', e);
    return [];
  }
}

async function searchOpenLibrary(query) {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,cover_i,first_publish_year,subject,language,number_of_pages_median`
    );
    const data = await res.json();
    if (!data.docs) return [];
    return data.docs.map(doc => ({
      id: 'ol_' + doc.key?.replace('/works/', ''),
      source: 'openlibrary',
      title: doc.title || 'Без назви',
      authors: doc.author_name || ['Невідомий автор'],
      description: '',
      cover: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      publishedDate: doc.first_publish_year?.toString() || '',
      pageCount: doc.number_of_pages_median || 0,
      categories: doc.subject?.slice(0, 5) || [],
      language: doc.language?.[0] || '',
      previewLink: `https://openlibrary.org${doc.key}`,
      isbn: '',
      rating: 0,
      ratingsCount: 0
    }));
  } catch (e) {
    console.error('Open Library error:', e);
    return [];
  }
}

// Фільтр: прибираємо поезію, СССР, пропаганду
const BLACKLIST_CATEGORIES = [
  'poetry', 'поезія', 'вірші', 'poems', 'soviet', 'ussr', 'propaganda',
  'communist', 'socialist realism', 'соцреалізм', 'пролетар'
];
const BLACKLIST_TITLE_KEYWORDS = [
  'ленін', 'сталін', 'маркс', 'энгельс', 'ленин', 'сталин',
  'кпрс', 'кпсс', 'советский', 'радянський збірник', 'октябрьская'
];

function filterBooks(books) {
  return books.filter(book => {
    const titleLower = book.title.toLowerCase();
    const catsLower = book.categories.map(c => c.toLowerCase()).join(' ');

    const badCategory = BLACKLIST_CATEGORIES.some(kw => catsLower.includes(kw));
    const badTitle = BLACKLIST_TITLE_KEYWORDS.some(kw => titleLower.includes(kw));
    return !badCategory && !badTitle;
  });
}

async function searchBooks(query) {
  const [google, openlib] = await Promise.all([
    searchGoogleBooks(query),
    searchOpenLibrary(query)
  ]);

  // Дедупліцируємо за назвою+автором
  const seen = new Set();
  const combined = [...google, ...openlib].filter(book => {
    const key = `${book.title.toLowerCase()}_${book.authors[0]?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return filterBooks(combined);
}

async function getBookDetails(bookId) {
  if (bookId.startsWith('gb_')) {
    const id = bookId.replace('gb_', '');
    const res = await fetch(`${GOOGLE_BOOKS_API}/${id}`);
    return await res.json();
  }
  if (bookId.startsWith('ol_')) {
    const id = bookId.replace('ol_', '');
    const res = await fetch(`https://openlibrary.org/works/${id}.json`);
    return await res.json();
  }
}
