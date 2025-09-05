# Userscript Library
> This repository houses all of my userscripts including works-in-progress. Finished userscripts will be published directly to Greasyfork.

## AO3 Userscript Menu
The **AO3: Userscript Menu** provides a shared dropdown menu for userscripts. Compatible scripts will appear in a consolidated menu instead of creating individual buttons/menus.

### 💗 For Users
Simply install the AO3: Userscript Menu script as usual and use it with compatible scripts.

### 💡 For Developers
<details> Follow these steps to make your userscript compatible:

#### 1. Check for the Menu API
Before registering your menu item, ensure the `AO3UserScriptMenu` global object exists:

```javascript
function registerWithMenu() {
    if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === 'function') {
        window.AO3UserScriptMenu.register({
            label: 'Your Script Name',
            onClick: function() {
                // Your menu click handler here
            }
        });
    } else {
        console.error('AO3UserScriptMenu API not found');
    }
}
```

#### 2. Inject Your Registration Code
Since userscripts run in isolated contexts, inject your registration code into the page context:

```javascript
function injectMenuRegistration() {
    const script = document.createElement('script');
    script.textContent = `(${registerWithMenu.toString()})();`;
    document.documentElement.appendChild(script);
    script.remove();
}

// Run after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenuRegistration);
} else {
    injectMenuRegistration();
}
```

#### 3. Handle Menu Clicks
Use a custom event to trigger your script's functionality:

```javascript
// In your script's context:
window.addEventListener('your-script-menu-click', function() {
    // Open your dialog/trigger functionality
});

// In the injected registration code:
onClick: function() {
    window.dispatchEvent(new CustomEvent('your-script-menu-click'));
}
```

#### 4. Full Integration Example

```javascript
// ==UserScript==
// @name        Your Script
// @namespace   your-namespace
// @version     1.0
// @description Your description
// @match       *://archiveofourown.org/*
// @grant       none
// ==/UserScript==

function registerWithMenu() {
    if (window.AO3UserScriptMenu) {
        window.AO3UserScriptMenu.register({
            label: 'Your Script',
            onClick: function() {
                window.dispatchEvent(new CustomEvent('your-script-open'));
            }
        });
    }
}

function injectMenuRegistration() {
    const script = document.createElement('script');
    script.textContent = `(${registerWithMenu.toString()})();`;
    document.documentElement.appendChild(script);
    script.remove();
}

window.addEventListener('your-script-open', function() {
    alert('Menu clicked!');
});

injectMenuRegistration();
```

#### 5. Key Points
- **Requirement**: Users must have the **AO3: Userscript Menu** script installed
- **No Conflicts**: The menu API won't break if your script runs alone
- **Simplicity**: Keep menu item registration minimal
- **Injection**: Always inject registration code into the page context

Your script will now integrate seamlessly with the shared AO3 Userscript Menu!
</details>

