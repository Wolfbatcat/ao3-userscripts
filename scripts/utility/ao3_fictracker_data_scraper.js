// ==UserScript==
// @name         AO3 FicTracker - Bookmark Page Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Manually scrape bookmarker's tags and work IDs from AO3 bookmark pages
// @author       Your Name
// @match        https://archiveofourown.org/users/*/bookmarks*
// @match        https://archiveofourown.org/bookmarks*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true;
    const STORAGE_KEY = 'FT_scraper_data';
    const META_KEY = 'FT_scraper_meta';

    // Storage Manager
    class ScraperStorage {
        constructor() {
            this.data = this.load();
            this.meta = this.loadMeta();
        }

        load() {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        }

        loadMeta() {
            const stored = localStorage.getItem(META_KEY);
            return stored ? JSON.parse(stored) : { pagesScraped: 0, lastUpdate: null };
        }

        save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }

        saveMeta() {
            localStorage.setItem(META_KEY, JSON.stringify(this.meta));
        }

        addWorkToTag(tag, workId) {
            if (!this.data[tag]) {
                this.data[tag] = [];
            }
            // De-duplicate
            if (!this.data[tag].includes(workId)) {
                this.data[tag].push(workId);
            }
        }

        mergeData(newData) {
            // newData format: { tag: [workId1, workId2, ...] }
            Object.keys(newData).forEach(tag => {
                newData[tag].forEach(workId => {
                    this.addWorkToTag(tag, workId);
                });
            });
            this.save();
        }

        incrementPageCount() {
            this.meta.pagesScraped++;
            this.meta.lastUpdate = new Date().toISOString();
            this.saveMeta();
        }

        getExportData() {
            // Convert arrays to comma-separated strings
            const exportData = {};
            Object.keys(this.data).forEach(tag => {
                // Use tag name as key (will need to map to storage keys if importing to main script)
                const key = `FT_scraper_${tag.replace(/\s+/g, '_')}`;
                exportData[key] = this.data[tag].join(',');
            });
            return exportData;
        }

        clear() {
            this.data = {};
            this.meta = { pagesScraped: 0, lastUpdate: null };
            this.save();
            this.saveMeta();
        }

        hasData() {
            return Object.keys(this.data).length > 0;
        }

        getTotalWorks() {
            const allWorkIds = new Set();
            Object.values(this.data).forEach(workIds => {
                workIds.forEach(id => allWorkIds.add(id));
            });
            return allWorkIds.size;
        }
    }

    // Page Scraper
    class BookmarkPageScraper {
        scrapePage() {
            const bookmarks = document.querySelectorAll('li.bookmark.blurb');
            const scrapedData = {}; // { tag: [workId1, workId2, ...] }
            let worksProcessed = 0;

            DEBUG && console.log(`[Scraper] Found ${bookmarks.length} bookmarks on page`);

            bookmarks.forEach(bookmark => {
                // Extract work ID from title link
                const titleLink = bookmark.querySelector('h4.heading a:not(.ao3-last-chapter-link)');
                if (!titleLink) return;

                const workId = titleLink.getAttribute('href').split('/').pop();
                if (!workId) return;

                // Extract bookmarker's tags
                const userModule = bookmark.querySelector('div.own.user.module.group');
                if (!userModule) return;

                const tagsList = userModule.querySelector('ul.meta.tags.commas');
                if (!tagsList) return;

                const tagElements = tagsList.querySelectorAll('a.tag');
                if (tagElements.length === 0) return;

                worksProcessed++;

                // Add work ID to each tag
                tagElements.forEach(tagElement => {
                    const tag = tagElement.textContent.trim();
                    if (!scrapedData[tag]) {
                        scrapedData[tag] = [];
                    }
                    scrapedData[tag].push(workId);
                });
            });

            DEBUG && console.log('[Scraper] Scraped data:', scrapedData);

            return {
                data: scrapedData,
                worksProcessed,
                tagsFound: Object.keys(scrapedData).length
            };
        }
    }

    // UI Manager
    class ScraperUI {
        constructor(storage, scraper) {
            this.storage = storage;
            this.scraper = scraper;
            this.init();
        }

        init() {
            this.createFloatingButtons();
            this.updateUI();
        }

        createFloatingButtons() {
            // Container
            const container = document.createElement('div');
            container.id = 'fictracker-scraper-ui';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;

            // Sync button with badge
            const syncBtn = document.createElement('button');
            syncBtn.id = 'scraper-sync-btn';
            syncBtn.innerHTML = `
                <span>📥 Sync Page</span>
                <span id="scraper-badge" style="
                    display: inline-block;
                    margin-left: 8px;
                    background: #d02;
                    color: white;
                    border-radius: 10px;
                    padding: 2px 6px;
                    font-size: 0.85em;
                    font-weight: bold;
                ">${this.storage.meta.pagesScraped}</span>
            `;
            syncBtn.style.cssText = `
                background: #900;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                transition: all 0.2s;
            `;
            syncBtn.addEventListener('click', () => this.handleSync());
            syncBtn.addEventListener('mouseenter', () => {
                syncBtn.style.background = '#b00';
                syncBtn.style.transform = 'translateY(-2px)';
                syncBtn.style.boxShadow = '0 6px 8px rgba(0,0,0,0.4)';
            });
            syncBtn.addEventListener('mouseleave', () => {
                syncBtn.style.background = '#900';
                syncBtn.style.transform = 'translateY(0)';
                syncBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            });

            // Export button
            const exportBtn = document.createElement('button');
            exportBtn.id = 'scraper-export-btn';
            exportBtn.textContent = '💾 Export Data';
            exportBtn.style.cssText = `
                background: #060;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                transition: all 0.2s;
                display: ${this.storage.hasData() ? 'block' : 'none'};
            `;
            exportBtn.addEventListener('click', () => this.handleExport());
            exportBtn.addEventListener('mouseenter', () => {
                exportBtn.style.background = '#080';
                exportBtn.style.transform = 'translateY(-2px)';
                exportBtn.style.boxShadow = '0 6px 8px rgba(0,0,0,0.4)';
            });
            exportBtn.addEventListener('mouseleave', () => {
                exportBtn.style.background = '#060';
                exportBtn.style.transform = 'translateY(0)';
                exportBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            });

            // Clear button
            const clearBtn = document.createElement('button');
            clearBtn.id = 'scraper-clear-btn';
            clearBtn.textContent = '🗑️ Clear Data';
            clearBtn.style.cssText = `
                background: #666;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                transition: all 0.2s;
                display: ${this.storage.hasData() ? 'block' : 'none'};
            `;
            clearBtn.addEventListener('click', () => this.handleClear());
            clearBtn.addEventListener('mouseenter', () => {
                clearBtn.style.background = '#888';
            });
            clearBtn.addEventListener('mouseleave', () => {
                clearBtn.style.background = '#666';
            });

            container.appendChild(syncBtn);
            container.appendChild(exportBtn);
            container.appendChild(clearBtn);
            document.body.appendChild(container);
        }

        handleSync() {
            const result = this.scraper.scrapePage();
            
            if (result.worksProcessed === 0) {
                this.showToast('⚠️ No bookmarks with tags found on this page', 'warning');
                return;
            }

            this.storage.mergeData(result.data);
            this.storage.incrementPageCount();

            // Animate sync button
            const syncBtn = document.getElementById('scraper-sync-btn');
            syncBtn.style.background = '#0a0';
            setTimeout(() => {
                syncBtn.style.background = '#900';
            }, 300);

            this.updateUI();
            
            const totalWorks = this.storage.getTotalWorks();
            this.showToast(
                `✓ Synced ${result.worksProcessed} works with ${result.tagsFound} unique tags<br>` +
                `Total: ${totalWorks} works, ${this.storage.meta.pagesScraped} pages scraped`,
                'success'
            );
        }

        handleExport() {
            if (!this.storage.hasData()) {
                this.showToast('⚠️ No data to export', 'warning');
                return;
            }

            const exportData = this.storage.getExportData();
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `FicTracker_Scraper_Export_${dateStr}.json`;

            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            const totalWorks = this.storage.getTotalWorks();
            const tagCount = Object.keys(this.storage.data).length;
            this.showToast(
                `💾 Exported ${totalWorks} works across ${tagCount} tags<br>` +
                `File: ${filename}`,
                'success'
            );
        }

        handleClear() {
            if (!confirm('Clear all scraped data? This cannot be undone.')) {
                return;
            }

            this.storage.clear();
            this.updateUI();
            this.showToast('🗑️ All data cleared', 'info');
        }

        updateUI() {
            const badge = document.getElementById('scraper-badge');
            if (badge) {
                badge.textContent = this.storage.meta.pagesScraped;
            }

            const exportBtn = document.getElementById('scraper-export-btn');
            const clearBtn = document.getElementById('scraper-clear-btn');
            if (this.storage.hasData()) {
                if (exportBtn) exportBtn.style.display = 'block';
                if (clearBtn) clearBtn.style.display = 'block';
            } else {
                if (exportBtn) exportBtn.style.display = 'none';
                if (clearBtn) clearBtn.style.display = 'none';
            }
        }

        showToast(message, type = 'info') {
            const colors = {
                success: '#0a0',
                warning: '#f90',
                error: '#d00',
                info: '#09c'
            };

            const toast = document.createElement('div');
            toast.innerHTML = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type]};
                color: white;
                padding: 16px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                z-index: 10000;
                font-size: 14px;
                line-height: 1.5;
                max-width: 400px;
                animation: slideIn 0.3s ease-out;
            `;

            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.transition = 'opacity 0.3s';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }
    }

    // Initialize
    function init() {
        // Check if we're on a bookmarks page
        if (!window.location.pathname.includes('/bookmarks')) {
            DEBUG && console.log('[Scraper] Not on bookmarks page, exiting');
            return;
        }

        DEBUG && console.log('[Scraper] Initializing bookmark page scraper...');

        const storage = new ScraperStorage();
        const scraper = new BookmarkPageScraper();
        const ui = new ScraperUI(storage, scraper);

        DEBUG && console.log('[Scraper] ✓ Initialization complete');
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
