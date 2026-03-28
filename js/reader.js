// ============================================
// Book Reader Module
// ============================================

import db from './db.js';
import ui from './ui.js';

class BookReader {
    constructor() {
        this.currentBook = null;
        this.currentPage = 0;
        this.totalPages = 0;
        this.content = [];
        this.settings = {
            fontSize: 18,
            fontFamily: 'Georgia',
            lineHeight: 1.8,
            theme: 'light', // light, dark, sepia
            margin: 20
        };
        this.isOpen = false;
        this.startTime = null;
        this.pagesReadInSession = 0;
    }

    // ============================================
    // Initialize Reader
    // ============================================

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
    }

    async loadSettings() {
        const savedSettings = await db.getSetting('readerSettings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...savedSettings };
        }
    }

    async saveSettings() {
        await db.setSetting('readerSettings', this.settings);
    }

    setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            
            switch(e.key) {
                case 'ArrowRight':
                case ' ':
                    this.nextPage();
                    break;
                case 'ArrowLeft':
                    this.prevPage();
                    break;
                case 'Escape':
                    this.close();
                    break;
            }
        });

        // Touch/swipe navigation
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', (e) => {
            if (!this.isOpen) return;
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            if (!this.isOpen) return;
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    }

    handleSwipe(startX, endX) {
        const threshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                this.nextPage();
            } else {
                this.prevPage();
            }
        }
    }

    // ============================================
    // Open/Close Reader
    // ============================================

    async open(book) {
        this.currentBook = book;
        this.currentPage = book.currentPage || 0;
        this.totalPages = book.totalPages || 0;
        this.startTime = Date.now();
        this.pagesReadInSession = 0;

        // Parse book content
        if (book.fileData) {
            await this.parseBookFile(book);
        } else {
            // Demo content for books without files
            this.content = this.generateDemoContent(book);
            this.totalPages = this.content.length;
        }

        this.renderReader();
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
    }

    async close() {
        if (!this.isOpen) return;

        // Save progress
        if (this.currentBook) {
            await db.updateBookProgress(this.currentBook.id, this.currentPage);

            // Save reading session
            const duration = Math.round((Date.now() - this.startTime) / 60000);
            if (duration > 0 || this.pagesReadInSession > 0) {
                await db.addSession({
                    bookId: this.currentBook.id,
                    pagesRead: this.pagesReadInSession,
                    duration: duration,
                    startPage: this.currentBook.currentPage || 0,
                    endPage: this.currentPage
                });
            }
        }

        this.isOpen = false;
        document.body.style.overflow = '';
        
        const readerEl = document.getElementById('book-reader');
        if (readerEl) {
            readerEl.classList.remove('open');
            setTimeout(() => readerEl.remove(), 300);
        }

        // Dispatch event for app to refresh
        window.dispatchEvent(new CustomEvent('reader-closed'));
    }

    // ============================================
    // Parse Book Files
    // ============================================

    async parseBookFile(book) {
        try {
            if (book.fileType === 'epub') {
                await this.parseEpub(book.fileData);
            } else if (book.fileType === 'txt') {
                this.parseTxt(book.fileData);
            } else {
                this.content = this.generateDemoContent(book);
            }
        } catch (error) {
            console.error('Error parsing book:', error);
            ui.showToast('Помилка при відкритті книги', 'error');
            this.content = this.generateDemoContent(book);
        }
    }

    async parseEpub(data) {
        // Simple EPUB parser (for demo - in production use epub.js library)
        // This is a simplified version
        try {
            const JSZip = window.JSZip;
            if (!JSZip) {
                throw new Error('JSZip not loaded');
            }

            const zip = await JSZip.loadAsync(data);
            const content = [];

            // Find content files
            const contentFiles = Object.keys(zip.files)
                .filter(name => name.endsWith('.html') || name.endsWith('.xhtml'))
                .sort();

            for (const fileName of contentFiles) {
                const fileContent = await zip.file(fileName).async('string');
                // Extract text from HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(fileContent, 'text/html');
                const text = doc.body.textContent || '';
                
                // Split into pages (roughly 2000 chars per page)
                const pageSize = 2000;
                for (let i = 0; i < text.length; i += pageSize) {
                    content.push(text.slice(i, i + pageSize).trim());
                }
            }

            this.content = content.filter(p => p.length > 0);
            this.totalPages = this.content.length;
        } catch (error) {
            console.error('EPUB parsing error:', error);
            throw error;
        }
    }

    parseTxt(data) {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        const pageSize = 2000;
        this.content = [];

        for (let i = 0; i < text.length; i += pageSize) {
            this.content.push(text.slice(i, i + pageSize).trim());
        }

        this.totalPages = this.content.length;
    }

    generateDemoContent(book) {
        const pages = [];
        const totalDemoPages = book.totalPages || 100;

        for (let i = 0; i < totalDemoPages; i++) {
            pages.push(`
                <h2>${book.title}</h2>
                <p class="author">Автор: ${book.author}</p>
                <hr>
                <p>Це демонстраційна сторінка ${i + 1} з ${totalDemoPages}.</p>
                <p>Щоб читати справжній контент, завантажте файл книги у форматі EPUB або TXT.</p>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
            `);
        }

        return pages;
    }

    // ============================================
    // Render Reader UI
    // ============================================

    renderReader() {
        const existing = document.getElementById('book-reader');
        if (existing) existing.remove();

        const reader = document.createElement('div');
        reader.id = 'book-reader';
        reader.className = `book-reader theme-${this.settings.theme}`;
        
        reader.innerHTML = `
            <div class="reader-header">
                <button class="reader-btn back-btn" id="reader-close">
                    <span>←</span>
                    <span>Назад</span>
                </button>
                <div class="reader-title">
                    <h3>${this.currentBook.title}</h3>
                    <span>${this.currentPage + 1} / ${this.totalPages}</span>
                </div>
                <button class="reader-btn" id="reader-settings">⚙️</button>
            </div>

            <div class="reader-content" id="reader-content" style="
                font-size: ${this.settings.fontSize}px;
                font-family: ${this.settings.fontFamily};
                line-height: ${this.settings.lineHeight};
                padding: ${this.settings.margin}px;
            ">
                ${this.content[this.currentPage] || 'Немає контенту'}
            </div>

            <div class="reader-footer">
                <button class="reader-nav-btn" id="reader-prev" ${this.currentPage === 0 ? 'disabled' : ''}>
                    ← Назад
                </button>
                <div class="reader-progress">
                    <input type="range" 
                           id="reader-slider" 
                           min="0" 
                           max="${this.totalPages - 1}" 
                           value="${this.currentPage}">
                    <span>${Math.round((this.currentPage / this.totalPages) * 100)}%</span>
                </div>
                <button class="reader-nav-btn" id="reader-next" ${this.currentPage >= this.totalPages - 1 ? 'disabled' : ''}>
                    Далі →
                </button>
            </div>

            <div class="reader-settings-panel hidden" id="reader-settings-panel">
                <h4>Налаштування читалки</h4>
                
                <div class="setting-group">
                    <label>Розмір шрифту</label>
                    <div class="setting-control">
                        <button class="setting-btn" data-action="fontSize" data-value="-2">A-</button>
                        <span id="fontSize-value">${this.settings.fontSize}px</span>
                        <button class="setting-btn" data-action="fontSize" data-value="2">A+</button>
                    </div>
                </div>

                <div class="setting-group">
                    <label>Шрифт</label>
                    <select id="font-select">
                        <option value="Georgia" ${this.settings.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                        <option value="Arial" ${this.settings.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                        <option value="Times New Roman" ${this.settings.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                        <option value="Verdana" ${this.settings.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label>Міжрядковий інтервал</label>
                    <div class="setting-control">
                        <button class="setting-btn" data-action="lineHeight" data-value="-0.2">-</button>
                        <span id="lineHeight-value">${this.settings.lineHeight}</span>
                        <button class="setting-btn" data-action="lineHeight" data-value="0.2">+</button>
                    </div>
                </div>

                <div class="setting-group">
                    <label>Тема</label>
                    <div class="theme-buttons">
                        <button class="theme-btn light ${this.settings.theme === 'light' ? 'active' : ''}" data-theme="light">
                            ☀️ Світла
                        </button>
                        <button class="theme-btn sepia ${this.settings.theme === 'sepia' ? 'active' : ''}" data-theme="sepia">
                            📜 Сепія
                        </button>
                        <button class="theme-btn dark ${this.settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">
                            🌙 Темна
                        </button>
                    </div>
                </div>

                <div class="setting-group">
                    <label>Перейти до сторінки</label>
                    <div class="goto-page">
                        <input type="number" id="goto-page-input" min="1" max="${this.totalPages}" value="${this.currentPage + 1}">
                        <button class="primary-btn small" id="goto-page-btn">Перейти</button>
                    </div>
                </div>

                <button class="secondary-btn" id="add-bookmark">📑 Додати закладку</button>
                <button class="secondary-btn" id="add-note">📝 Додати нотатку</button>
            </div>
        `;

        document.body.appendChild(reader);
        this.bindReaderEvents(reader);

        // Animate open
        requestAnimationFrame(() => reader.classList.add('open'));
    }

    bindReaderEvents(reader) {
        // Close button
        reader.querySelector('#reader-close').addEventListener('click', () => this.close());

        // Navigation
        reader.querySelector('#reader-prev').addEventListener('click', () => this.prevPage());
        reader.querySelector('#reader-next').addEventListener('click', () => this.nextPage());

        // Slider
        const slider = reader.querySelector('#reader-slider');
        slider.addEventListener('input', (e) => {
            this.goToPage(parseInt(e.target.value));
        });

        // Settings toggle
        reader.querySelector('#reader-settings').addEventListener('click', () => {
            reader.querySelector('#reader-settings-panel').classList.toggle('hidden');
        });

        // Font size
        reader.querySelectorAll('[data-action="fontSize"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const change = parseInt(btn.dataset.value);
                this.settings.fontSize = Math.max(12, Math.min(32, this.settings.fontSize + change));
                this.applySettings();
            });
        });

        // Line height
        reader.querySelectorAll('[data-action="lineHeight"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const change = parseFloat(btn.dataset.value);
                this.settings.lineHeight = Math.max(1, Math.min(3, this.settings.lineHeight + change));
                this.applySettings();
            });
        });

        // Font family
        reader.querySelector('#font-select').addEventListener('change', (e) => {
            this.settings.fontFamily = e.target.value;
            this.applySettings();
        });

        // Theme
        reader.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                reader.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.theme = btn.dataset.theme;
                reader.className = `book-reader open theme-${this.settings.theme}`;
                this.saveSettings();
            });
        });

        // Go to page
        reader.querySelector('#goto-page-btn').addEventListener('click', () => {
            const page = parseInt(reader.querySelector('#goto-page-input').value) - 1;
            if (page >= 0 && page < this.totalPages) {
                this.goToPage(page);
            }
        });

        // Add bookmark
        reader.querySelector('#add-bookmark').addEventListener('click', () => this.addBookmark());

        // Add note
        reader.querySelector('#add-note').addEventListener('click', () => this.addNote());

        // Click on content to toggle header/footer
        reader.querySelector('#reader-content').addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return;
            reader.classList.toggle('fullscreen');
        });
    }

    applySettings() {
        const content = document.getElementById('reader-content');
        if (content) {
            content.style.fontSize = `${this.settings.fontSize}px`;
            content.style.fontFamily = this.settings.fontFamily;
            content.style.lineHeight = this.settings.lineHeight;
        }

        // Update display values
        const fontSizeValue = document.getElementById('fontSize-value');
        const lineHeightValue = document.getElementById('lineHeight-value');
        if (fontSizeValue) fontSizeValue.textContent = `${this.settings.fontSize}px`;
        if (lineHeightValue) lineHeightValue.textContent = this.settings.lineHeight.toFixed(1);

        this.saveSettings();
    }

    // ============================================
    // Navigation
    // ============================================

    nextPage() {
        if (this.currentPage < this.totalPages - 1) {
            this.goToPage(this.currentPage + 1);
        }
    }

    prevPage() {
        if (this.currentPage > 0) {
            this.goToPage(this.currentPage - 1);
        }
    }

    goToPage(page) {
        const oldPage = this.currentPage;
        this.currentPage = Math.max(0, Math.min(this.totalPages - 1, page));
        
        if (this.currentPage > oldPage) {
            this.pagesReadInSession += (this.currentPage - oldPage);
        }

        this.updateReaderUI();
    }

    updateReaderUI() {
        const content = document.getElementById('reader-content');
        const slider = document.getElementById('reader-slider');
        const prevBtn = document.getElementById('reader-prev');
        const nextBtn = document.getElementById('reader-next');
        const title = document.querySelector('.reader-title span');
        const progress = document.querySelector('.reader-progress span');
        const gotoInput = document.getElementById('goto-page-input');

        if (content) {
            content.innerHTML = this.content[this.currentPage] || 'Немає контенту';
            content.scrollTop = 0;
        }
        if (slider) slider.value = this.currentPage;
        if (prevBtn) prevBtn.disabled = this.currentPage === 0;
        if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages - 1;
        if (title) title.textContent = `${this.currentPage + 1} / ${this.totalPages}`;
        if (progress) progress.textContent = `${Math.round((this.currentPage / this.totalPages) * 100)}%`;
        if (gotoInput) gotoInput.value = this.currentPage + 1;
    }

    // ============================================
    // Bookmarks & Notes
    // ============================================

    async addBookmark() {
        await db.addNote({
            bookId: this.currentBook.id,
            page: this.currentPage,
            content: `Закладка на сторінці ${this.currentPage + 1}`,
            highlight: '',
            color: '#667eea'
        });
        ui.showToast('Закладку додано', 'success');
    }

    async addNote() {
        ui.showModal({
            title: 'Додати нотатку',
            content: `
                <div class="form-group">
                    <label>Сторінка: ${this.currentPage + 1}</label>
                </div>
                <div class="form-group">
                    <label>Нотатка</label>
                    <textarea id="note-content" class="form-textarea" rows="4" placeholder="Введіть вашу нотатку..."></textarea>
                </div>
                <div class="form-group">
                    <label>Виділений текст (опціонально)</label>
                    <textarea id="note-highlight" class="form-textarea" rows="2" placeholder="Скопіюйте текст з книги..."></textarea>
                </div>
            `,
            buttons: [
                {
                    text: 'Скасувати',
                    class: 'secondary-btn',
                    action: 'cancel',
                    handler: (close) => close()
                },
                {
                    text: 'Зберегти',
                    class: 'primary-btn',
                    action: 'save',
                    handler: async (close) => {
                        const content = document.getElementById('note-content').value.trim();
                        const highlight = document.getElementById('note-highlight').value.trim();
                        
                        if (content) {
                            await db.addNote({
                                bookId: this.currentBook.id,
                                page: this.currentPage,
                                content,
                                highlight,
                                color: '#ffeb3b'
                            });
                            ui.showToast('Нотатку збережено', 'success');
                        }
                        close();
                    }
                }
            ]
        });
    }
}

// Export singleton
const reader = new BookReader();
export default reader;
