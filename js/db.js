// ============================================
// IndexedDB Database Manager
// ============================================

const DB_NAME = 'BookTrackerDB';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Books store
                if (!db.objectStoreNames.contains('books')) {
                    const booksStore = db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
                    booksStore.createIndex('status', 'status', { unique: false });
                    booksStore.createIndex('title', 'title', { unique: false });
                    booksStore.createIndex('author', 'author', { unique: false });
                    booksStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                    booksStore.createIndex('dateFinished', 'dateFinished', { unique: false });
                    booksStore.createIndex('rating', 'rating', { unique: false });
                }

                // Reading sessions store
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                    sessionsStore.createIndex('bookId', 'bookId', { unique: false });
                    sessionsStore.createIndex('date', 'date', { unique: false });
                }

                // Notes store
                if (!db.objectStoreNames.contains('notes')) {
                    const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
                    notesStore.createIndex('bookId', 'bookId', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Goals store
                if (!db.objectStoreNames.contains('goals')) {
                    const goalsStore = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
                    goalsStore.createIndex('year', 'year', { unique: false });
                }
            };
        });
    }

    // ============================================
    // Generic CRUD Operations
    // ============================================

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add({ ...data, dateAdded: new Date().toISOString() });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // Books Operations
    // ============================================

    async addBook(book) {
        const bookData = {
            title: book.title,
            author: book.author,
            cover: book.cover || null,
            status: book.status || 'want', // want, reading, finished, dropped
            totalPages: book.totalPages || 0,
            currentPage: book.currentPage || 0,
            rating: book.rating || 0,
            review: book.review || '',
            genre: book.genre || [],
            isbn: book.isbn || '',
            publisher: book.publisher || '',
            publishYear: book.publishYear || null,
            language: book.language || 'uk',
            description: book.description || '',
            dateAdded: new Date().toISOString(),
            dateStarted: book.status === 'reading' ? new Date().toISOString() : null,
            dateFinished: book.status === 'finished' ? new Date().toISOString() : null,
            favorite: book.favorite || false,
            tags: book.tags || [],
            fileData: book.fileData || null, // For EPUB/PDF content
            fileType: book.fileType || null
        };
        return this.add('books', bookData);
    }

    async getBook(id) {
        return this.get('books', id);
    }

    async getAllBooks() {
        return this.getAll('books');
    }

    async getBooksByStatus(status) {
        return this.getByIndex('books', 'status', status);
    }

    async updateBook(book) {
        return this.update('books', book);
    }

    async deleteBook(id) {
        // Also delete related sessions and notes
        const sessions = await this.getSessionsByBook(id);
        const notes = await this.getNotesByBook(id);
        
        for (const session of sessions) {
            await this.delete('sessions', session.id);
        }
        for (const note of notes) {
            await this.delete('notes', note.id);
        }
        
        return this.delete('books', id);
    }

    async updateBookProgress(bookId, currentPage) {
        const book = await this.getBook(bookId);
        if (book) {
            book.currentPage = currentPage;
            if (currentPage >= book.totalPages && book.totalPages > 0) {
                book.status = 'finished';
                book.dateFinished = new Date().toISOString();
            }
            return this.update('books', book);
        }
    }

    async updateBookStatus(bookId, status) {
        const book = await this.getBook(bookId);
        if (book) {
            book.status = status;
            if (status === 'reading' && !book.dateStarted) {
                book.dateStarted = new Date().toISOString();
            }
            if (status === 'finished') {
                book.dateFinished = new Date().toISOString();
            }
            return this.update('books', book);
        }
    }

    // ============================================
    // Reading Sessions
    // ============================================

    async addSession(session) {
        return this.add('sessions', {
            bookId: session.bookId,
            date: new Date().toISOString(),
            pagesRead: session.pagesRead || 0,
            duration: session.duration || 0, // in minutes
            startPage: session.startPage || 0,
            endPage: session.endPage || 0
        });
    }

    async getSessionsByBook(bookId) {
        return this.getByIndex('sessions', 'bookId', bookId);
    }

    async getAllSessions() {
        return this.getAll('sessions');
    }

    // ============================================
    // Notes & Highlights
    // ============================================

    async addNote(note) {
        return this.add('notes', {
            bookId: note.bookId,
            page: note.page || 0,
            chapter: note.chapter || '',
            content: note.content,
            highlight: note.highlight || '',
            color: note.color || '#ffeb3b',
            date: new Date().toISOString()
        });
    }

    async getNotesByBook(bookId) {
        return this.getByIndex('notes', 'bookId', bookId);
    }

    async updateNote(note) {
        return this.update('notes', note);
    }

    async deleteNote(id) {
        return this.delete('notes', id);
    }

    // ============================================
    // Settings
    // ============================================

    async getSetting(key) {
        const result = await this.get('settings', key);
        return result ? result.value : null;
    }

    async setSetting(key, value) {
        return this.update('settings', { key, value });
    }

    async getAllSettings() {
        const settings = await this.getAll('settings');
        const result = {};
        settings.forEach(s => result[s.key] = s.value);
        return result;
    }

    // ============================================
    // Goals
    // ============================================

    async setYearlyGoal(year, target) {
        const existing = await this.getByIndex('goals', 'year', year);
        if (existing.length > 0) {
            existing[0].target = target;
            return this.update('goals', existing[0]);
        }
        return this.add('goals', { year, target, created: new Date().toISOString() });
    }

    async getYearlyGoal(year) {
        const goals = await this.getByIndex('goals', 'year', year);
        return goals.length > 0 ? goals[0] : null;
    }

    // ============================================
    // Statistics
    // ============================================

    async getStats() {
        const books = await this.getAllBooks();
        const sessions = await this.getAllSessions();
        const currentYear = new Date().getFullYear();
        const goal = await this.getYearlyGoal(currentYear);

        const stats = {
            totalBooks: books.length,
            reading: books.filter(b => b.status === 'reading').length,
            finished: books.filter(b => b.status === 'finished').length,
            wantToRead: books.filter(b => b.status === 'want').length,
            dropped: books.filter(b => b.status === 'dropped').length,
            totalPages: books.reduce((sum, b) => sum + (b.currentPage || 0), 0),
            finishedThisYear: books.filter(b => 
                b.status === 'finished' && 
                b.dateFinished && 
                new Date(b.dateFinished).getFullYear() === currentYear
            ).length,
            yearlyGoal: goal ? goal.target : 12,
            averageRating: 0,
            totalReadingTime: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            favoriteGenres: {},
            monthlyStats: {}
        };

        // Calculate average rating
        const ratedBooks = books.filter(b => b.rating > 0);
        if (ratedBooks.length > 0) {
            stats.averageRating = ratedBooks.reduce((sum, b) => sum + b.rating, 0) / ratedBooks.length;
        }

        // Genre stats
        books.forEach(book => {
            if (book.genre && Array.isArray(book.genre)) {
                book.genre.forEach(g => {
                    stats.favoriteGenres[g] = (stats.favoriteGenres[g] || 0) + 1;
                });
            }
        });

        // Monthly reading stats
        for (let month = 0; month < 12; month++) {
            const monthBooks = books.filter(b => {
                if (b.dateFinished) {
                    const date = new Date(b.dateFinished);
                    return date.getFullYear() === currentYear && date.getMonth() === month;
                }
                return false;
            });
            stats.monthlyStats[month] = monthBooks.length;
        }

        return stats;
    }

    // ============================================
    // Search
    // ============================================

    async searchBooks(query) {
        const books = await this.getAllBooks();
        const lowerQuery = query.toLowerCase();
        
        return books.filter(book => 
            book.title.toLowerCase().includes(lowerQuery) ||
            book.author.toLowerCase().includes(lowerQuery) ||
            (book.tags && book.tags.some(t => t.toLowerCase().includes(lowerQuery))) ||
            (book.genre && book.genre.some(g => g.toLowerCase().includes(lowerQuery)))
        );
    }

    // ============================================
    // Export/Import
    // ============================================

    async exportData() {
        const data = {
            books: await this.getAllBooks(),
            sessions: await this.getAllSessions(),
            notes: await this.getAll('notes'),
            settings: await this.getAllSettings(),
            goals: await this.getAll('goals'),
            exportDate: new Date().toISOString(),
            version: DB_VERSION
        };
        return JSON.stringify(data, null, 2);
    }

    async importData(jsonString) {
        const data = JSON.parse(jsonString);
        
        // Clear existing data
        const stores = ['books', 'sessions', 'notes', 'settings', 'goals'];
        for (const storeName of stores) {
            const items = await this.getAll(storeName);
            for (const item of items) {
                await this.delete(storeName, item.id || item.key);
            }
        }

        // Import new data
        for (const book of data.books || []) {
            delete book.id;
            await this.add('books', book);
        }
        for (const session of data.sessions || []) {
            delete session.id;
            await this.add('sessions', session);
        }
        for (const note of data.notes || []) {
            delete note.id;
            await this.add('notes', note);
        }
        for (const [key, value] of Object.entries(data.settings || {})) {
            await this.setSetting(key, value);
        }
        for (const goal of data.goals || []) {
            delete goal.id;
            await this.add('goals', goal);
        }
    }
}

// Export singleton instance
const db = new Database();
export default db;
