// ============================================
// UI Components & Utilities
// ============================================

class UI {
    constructor() {
        this.toastQueue = [];
        this.isShowingToast = false;
    }

    // ============================================
    // Toast Notifications
    // ============================================

    showToast(message, type = 'info', duration = 3000) {
        this.toastQueue.push({ message, type, duration });
        if (!this.isShowingToast) {
            this.processToastQueue();
        }
    }

    processToastQueue() {
        if (this.toastQueue.length === 0) {
            this.isShowingToast = false;
            return;
        }

        this.isShowingToast = true;
        const { message, type, duration } = this.toastQueue.shift();

        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
                this.processToastQueue();
            }, 300);
        }, duration);
    }

    // ============================================
    // Modal
    // ============================================

    showModal(options) {
        const { title, content, buttons = [], size = 'medium', closable = true } = options;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal-${size}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    ${closable ? '<button class="modal-close icon-btn">✕</button>' : ''}
                </div>
                <div class="modal-body">${content}</div>
                ${buttons.length > 0 ? `
                    <div class="modal-footer">
                        ${buttons.map(btn => `
                            <button class="${btn.class || 'secondary-btn'}" data-action="${btn.action}">
                                ${btn.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Animation
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        // Event handlers
        const closeModal = () => {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = '';
            }, 300);
        };

        if (closable) {
            overlay.querySelector('.modal-close')?.addEventListener('click', closeModal);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }

        // Button handlers
        buttons.forEach(btn => {
            const buttonEl = overlay.querySelector(`[data-action="${btn.action}"]`);
            if (buttonEl && btn.handler) {
                buttonEl.addEventListener('click', () => {
                    btn.handler(closeModal);
                });
            }
        });

        return { close: closeModal, element: overlay };
    }

    // ============================================
    // Confirm Dialog
    // ============================================

    confirm(message, title = 'Підтвердження') {
        return new Promise((resolve) => {
            this.showModal({
                title,
                content: `<p>${message}</p>`,
                buttons: [
                    {
                        text: 'Скасувати',
                        class: 'secondary-btn',
                        action: 'cancel',
                        handler: (close) => {
                            close();
                            resolve(false);
                        }
                    },
                    {
                        text: 'Підтвердити',
                        class: 'primary-btn',
                        action: 'confirm',
                        handler: (close) => {
                            close();
                            resolve(true);
                        }
                    }
                ]
            });
        });
    }

    // ============================================
    // Loading Overlay
    // ============================================

    showLoading(message = 'Завантаження...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p class="loading-message">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.querySelector('.loading-message').textContent = message;
            overlay.classList.remove('hidden');
        }
        
        requestAnimationFrame(() => overlay.classList.add('show'));
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    }

    // ============================================
    // Book Card
    // ============================================

    createBookCard(book, viewType = 'grid') {
        const progress = book.totalPages > 0 
            ? Math.round((book.currentPage / book.totalPages) * 100) 
            : 0;

        const statusLabels = {
            reading: 'Читаю',
            finished: 'Прочитано',
            want: 'Хочу прочитати',
            dropped: 'Покинуто'
        };

        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.bookId = book.id;

        if (viewType === 'grid') {
            card.innerHTML = `
                <div class="book-cover">
                    ${book.cover 
                        ? `<img src="${book.cover}" alt="${book.title}" loading="lazy">` 
                        : '📚'}
                </div>
                <span class="book-badge ${book.status}">${statusLabels[book.status]}</span>
                <div class="book-info">
                    <h4 class="book-title" title="${book.title}">${book.title}</h4>
                    <p class="book-author">${book.author}</p>
                    ${book.status === 'reading' && book.totalPages > 0 ? `
                        <div class="book-progress">
                            <div class="book-progress-fill" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}
                </div>
                ${book.rating > 0 ? `
                    <div class="book-rating">
                        ${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}
                    </div>
                ` : ''}
            `;
        } else {
            card.innerHTML = `
                <div class="book-cover">
                    ${book.cover 
                        ? `<img src="${book.cover}" alt="${book.title}" loading="lazy">` 
                        : '📚'}
                </div>
                <div class="book-info">
                    <h4 class="book-title">${book.title}</h4>
                    <p class="book-author">${book.author}</p>
                    <div class="book-meta">
                        <span class="book-badge ${book.status}">${statusLabels[book.status]}</span>
                        ${book.rating > 0 ? `
                            <span class="book-rating-small">
                                ${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}
                            </span>
                        ` : ''}
                    </div>
                    ${book.status === 'reading' && book.totalPages > 0 ? `
                        <div class="book-progress">
                            <div class="book-progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <span class="book-progress-text">${book.currentPage} / ${book.totalPages} стор. (${progress}%)</span>
                    ` : ''}
                </div>
            `;
        }

        return card;
    }

    // ============================================
    // Empty State
    // ============================================

    createEmptyState(icon, title, description, action = null) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
            <div class="empty-icon">${icon}</div>
            <h3 class="empty-title">${title}</h3>
            <p class="empty-description">${description}</p>
            ${action ? `<button class="primary-btn empty-action">${action.text}</button>` : ''}
        `;

        if (action && action.handler) {
            empty.querySelector('.empty-action')?.addEventListener('click', action.handler);
        }

        return empty;
    }

    // ============================================
    // Rating Picker
    // ============================================

    createRatingPicker(currentRating = 0, onChange = null) {
        const picker = document.createElement('div');
        picker.className = 'rating-picker';
        
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('button');
            star.className = `rating-star ${i <= currentRating ? 'active' : ''}`;
            star.dataset.rating = i;
            star.innerHTML = i <= currentRating ? '★' : '☆';
            star.addEventListener('click', () => {
                const newRating = parseInt(star.dataset.rating);
                picker.querySelectorAll('.rating-star').forEach((s, index) => {
                    s.classList.toggle('active', index < newRating);
                    s.innerHTML = index < newRating ? '★' : '☆';
                });
                if (onChange) onChange(newRating);
            });
            picker.appendChild(star);
        }

        return picker;
    }

    // ============================================
    // Progress Bar
    // ============================================

    createProgressBar(current, total, showText = true) {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        const bar = document.createElement('div');
        bar.className = 'progress-container';
        bar.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            ${showText ? `<span class="progress-text">${current} / ${total} (${percentage}%)</span>` : ''}
        `;
        return bar;
    }

    // ============================================
    // Tabs
    // ============================================

    createTabs(tabs, activeTab = 0, onChange = null) {
        const container = document.createElement('div');
        container.className = 'tabs-container';
        
        const tabsNav = document.createElement('div');
        tabsNav.className = 'tabs-nav';
        
        tabs.forEach((tab, index) => {
            const tabBtn = document.createElement('button');
            tabBtn.className = `tab-btn ${index === activeTab ? 'active' : ''}`;
            tabBtn.textContent = tab.label;
            tabBtn.addEventListener('click', () => {
                tabsNav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                if (onChange) onChange(index, tab);
            });
            tabsNav.appendChild(tabBtn);
        });

        container.appendChild(tabsNav);
        return container;
    }

    // ============================================
    // Form Helpers
    // ============================================

    createFormGroup(label, input, hint = '') {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `
            <label class="form-label">${label}</label>
            ${hint ? `<span class="form-hint">${hint}</span>` : ''}
        `;
        
        if (typeof input === 'string') {
            group.insertAdjacentHTML('beforeend', input);
        } else {
            group.appendChild(input);
        }
        
        return group;
    }

    createSelect(options, selected = '', name = '') {
        const select = document.createElement('select');
        select.className = 'form-select';
        if (name) select.name = name;
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            option.selected = opt.value === selected;
            select.appendChild(option);
        });
        
        return select;
    }

    createInput(type, name, value = '', placeholder = '') {
        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.value = value;
        input.placeholder = placeholder;
        input.className = 'form-input';
        return input;
    }

    createTextarea(name, value = '', placeholder = '', rows = 4) {
        const textarea = document.createElement('textarea');
        textarea.name = name;
        textarea.value = value;
        textarea.placeholder = placeholder;
        textarea.rows = rows;
        textarea.className = 'form-textarea';
        return textarea;
    }

    // ============================================
    // Genre/Tag Picker
    // ============================================

    createTagPicker(availableTags, selectedTags = [], onChange = null) {
        const picker = document.createElement('div');
        picker.className = 'tag-picker';
        
        availableTags.forEach(tag => {
            const tagEl = document.createElement('button');
            tagEl.className = `tag ${selectedTags.includes(tag) ? 'selected' : ''}`;
            tagEl.textContent = tag;
            tagEl.addEventListener('click', () => {
                tagEl.classList.toggle('selected');
                const newSelected = Array.from(picker.querySelectorAll('.tag.selected'))
                    .map(t => t.textContent);
                if (onChange) onChange(newSelected);
            });
            picker.appendChild(tagEl);
        });
        
        return picker;
    }

    // ============================================
    // Activity Item
    // ============================================

    createActivityItem(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const icons = {
            finished: '🏆',
            started: '📖',
            progress: '📝',
            note: '💭',
            rating: '⭐'
        };

        const date = new Date(activity.date);
        const formattedDate = date.toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        item.innerHTML = `
            <div class="activity-icon">${icons[activity.type] || '📚'}</div>
            <div class="activity-text">
                <p class="activity-title">${activity.text}</p>
                <span class="activity-date">${formattedDate}</span>
            </div>
        `;

        return item;
    }

    // ============================================
    // Format Helpers
    // ============================================

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    formatDuration(minutes) {
        if (minutes < 60) return `${minutes} хв`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} год ${mins} хв` : `${hours} год`;
    }

    formatNumber(num) {
        return new Intl.NumberFormat('uk-UA').format(num);
    }
}

// Export singleton
const ui = new UI();
export default ui;
