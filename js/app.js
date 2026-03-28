// ============================================
// Main Application
// ============================================

import db from './db.js';
import ui from './ui.js';
import reader from './reader.js';

class BookTrackerApp {
    constructor() {
        this.currentPage = 'home';
        this.books = [];
        this.stats = {};
        this.viewMode = 'grid';
        this.currentFilter = 'all';
        this.sortBy = 'dateAdded';
        this.searchQuery = '';
    }

    // ============================================
    // Initialize App
    // ============================================

    async init() {
        try {
            // Initialize database
            await db.init();
            
            // Initialize reader
            await reader.init();
            
            // Load data
            await this.loadData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load theme
            this.loadTheme();
            
            // Render initial page
            this.renderPage('home');
            
            // Hide splash screen
            setTimeout(() => {
                document.getElementById('splash-screen').classList.add('fade-out');
                setTimeout(() => {
                    document.getElementById('splash-screen').remove();
                }, 500);
            }, 1000);

            // Register service worker
            this.registerServiceWorker();

        } catch (error) {
            console.error('App initialization failed:', error);
            ui.showToast('Помилка ініціалізації додатку', 'error');
        }
    }

    async loadData() {
        this.books = await db.getAllBooks();
        this.stats = await db.getStats();
    }

    // ============================================
    // Event Listeners
    // ============================================

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Search
        const searchInput = document.getElementById('search-input');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value.trim();
                if (this.currentPage === 'library') {
                    this.renderLibrary();
                }
            }, 300);
        });

        // Add book button
        document.getElementById('add-book-btn')?.addEventListener('click', () => {
            this.
