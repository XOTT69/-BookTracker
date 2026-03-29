const DB_NAME = 'bookshelf_db';
const DB_VERSION = 2;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('books')) {
        const store = d.createObjectStore('books', { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('addedAt', 'addedAt');
      }
      if (!d.objectStoreNames.contains('reading_sessions')) {
        const s = d.createObjectStore('reading_sessions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('bookId', 'bookId');
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = indexName ? s.index(indexName).getAll(value) : s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllBooks() { return dbGetAll('books'); }
async function getBooksByStatus(status) { return dbGetAll('books', 'status', status); }
async function saveBook(book) { return dbPut('books', book); }
async function deleteBook(id) { return dbDelete('books', id); }
async function getBook(id) { return dbGet('books', id); }

async function saveReadingSession(session) {
  return dbPut('reading_sessions', { ...session, id: Date.now() });
}
async function getReadingSessions(bookId) {
  return dbGetAll('reading_sessions', 'bookId', bookId);
}

async function getSetting(key) {
  const r = await dbGet('settings', key);
  return r ? r.value : null;
}
async function setSetting(key, value) {
  return dbPut('settings', { key, value });
}
