// ==UserScript==
// @name         AO3: Userscript Menu
// @namespace    https://github.com/ao3-userscripts
// @version      1
// @description  Unified menu for AO3 userscripts. Install this script to enable a shared menu for all AO3 userscripts that support it.
// @author       BlackBatCat
// @match        *://archiveofourown.org/*
// @match        *://*.archiveofourown.org/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

// Inject AO3UserScriptMenu into the real page context for cross-script access
(function injectMenuLibrary() {
  const src = `
        (function() {
            if (window.AO3UserScriptMenu) return;
            const menuItems = [];
            function createMenu() {
                const nav = document.querySelector('ul.primary') ||
                            document.querySelector('nav.primary') ||
                            document.querySelector('#dashboard ul.actions');
                if (!nav) return;
                let container = document.getElementById('ao3-userscript-menu');
                if (!container) {
                    container = document.createElement('li');
                    container.className = 'dropdown';
                    container.id = 'ao3-userscript-menu';
                    const title = document.createElement('a');
                    title.href = '#';
                    title.textContent = 'Userscripts';
                    container.appendChild(title);
                    const menu = document.createElement('ul');
                    menu.className = 'menu dropdown-menu';
                    container.appendChild(menu);
                    const searchItem = nav.querySelector('li.search');
                    if (searchItem) {
                        nav.insertBefore(container, searchItem);
                    } else {
                        nav.appendChild(container);
                    }
                }
                renderMenu();
            }
            function renderMenu() {
                const menu = document.querySelector('#ao3-userscript-menu ul.menu');
                if (!menu) return;
                menu.innerHTML = '';
                menuItems.forEach(item => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = '#';
                    a.textContent = item.label;
                    a.addEventListener('click', e => {
                        e.preventDefault();
                        item.onClick();
                    });
                    li.appendChild(a);
                    menu.appendChild(li);
                });
                if (menuItems.length > 0) {
                    console.debug('[AO3UserScriptMenu] Rendered menu with', menuItems.length, 'items:', menuItems.map(i => i.label));
                } else {
                    console.debug('[AO3UserScriptMenu] Rendered menu with 0 items');
                }
            }
            window.AO3UserScriptMenu = {
                register: function(item) {
                    if (!item || typeof item.label !== 'string' || typeof item.onClick !== 'function') return;
                    menuItems.push(item);
                    console.debug('[AO3UserScriptMenu] Registered menu item:', item.label, '| Total:', menuItems.length, '| All:', menuItems.map(i => i.label));
                    if (!document.getElementById('ao3-userscript-menu')) {
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', createMenu);
                        } else {
                            createMenu();
                        }
                    } else {
                        renderMenu();
                    }
                }
            };
        })();
    `;
  const script = document.createElement("script");
  script.textContent = src;
  document.documentElement.appendChild(script);
  script.remove();
})();
