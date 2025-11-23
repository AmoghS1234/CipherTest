# CipherMesh Browser Extension - Development Guide

## Reloading Extensions During Development

When you make changes to the extension code, you need to reload it in your browser for the changes to take effect.

### Firefox

**Method 1: Using about:debugging (Recommended)**
1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Find "CipherMesh Password Manager" in the list
4. Click the **"Reload"** button next to the extension

**Method 2: Remove and Re-add**
1. Go to `about:debugging` → "This Firefox"
2. Click "Remove" next to the extension
3. Click "Load Temporary Add-on..."
4. Navigate to `extensions/firefox/manifest.json` and select it

**Method 3: Restart Firefox**
- Close Firefox completely and reopen it
- The extension will reload with your changes

### Chrome/Chromium

**Method 1: Using chrome://extensions (Recommended)**
1. Open Chrome and navigate to `chrome://extensions/`
2. Find "CipherMesh Password Manager" in the list
3. Click the **circular refresh icon** next to the extension

**Method 2: Remove and Re-add**
1. Go to `chrome://extensions/`
2. Click "Remove" on the extension
3. Click "Load unpacked"
4. Navigate to and select the `extensions/chrome/` folder

### After Reloading

**Important:** After reloading the extension in Firefox or Chrome, you MUST also:

1. **Reload the web page** where you want to test the extension
   - Press `Ctrl+R` (or `Cmd+R` on Mac) to refresh the page
   - Or click the reload button in your browser

2. **Why?** Content scripts are only injected when pages load. Reloading the extension doesn't re-inject scripts into already-opened pages.

### Quick Development Workflow

```bash
# 1. Make changes to extension code
vim extensions/firefox/content.js

# 2. Reload extension in browser
#    Firefox: about:debugging → Reload button
#    Chrome: chrome://extensions/ → Refresh icon

# 3. Reload the web page you're testing
#    Press Ctrl+R or F5

# 4. Test your changes
```

### Debugging Tips

**View Console Logs:**
- **Background Script Logs**: 
  - Firefox: `about:debugging` → Inspect button → Console tab
  - Chrome: `chrome://extensions/` → Inspect background page → Console tab

- **Content Script Logs**:
  - Open Developer Tools on the web page (`F12`)
  - Go to Console tab
  - Look for logs from content.js

**Common Issues:**

1. **Icon doesn't appear after making changes**
   - Did you reload the extension? (`about:debugging` → Reload)
   - Did you reload the web page? (Press `Ctrl+R`)
   - Check Console for errors (`F12` → Console)

2. **Changes not reflecting**
   - Browser caches extension files
   - Use "Remove" then "Re-add" instead of just "Reload"
   - Or restart the browser completely

3. **Native messaging not working**
   - Make sure CipherMesh desktop app is running
   - Check that native host was built: `build/extensions/native-host/ciphermesh-native-host`
   - Verify manifest was installed: `~/.mozilla/native-messaging-hosts/com.ciphermesh.native.json`

### Testing Checklist

When testing changes:

- [ ] Build project: `cd build && cmake --build . -j$(nproc)`
- [ ] Start CipherMesh desktop app
- [ ] Unlock vault in desktop app
- [ ] Reload extension in browser
- [ ] Reload web page where testing
- [ ] Check browser console for errors
- [ ] Check background script console for errors
- [ ] Test autofill functionality
- [ ] Test password saving functionality

### File Structure

```
extensions/
├── firefox/
│   ├── manifest.json      # Firefox extension manifest
│   ├── background.js      # Background script (native messaging)
│   ├── content.js         # Content script (password field detection, UI)
│   ├── popup.html        # Extension popup UI
│   └── popup.js          # Popup logic
├── chrome/
│   ├── manifest.json      # Chrome extension manifest (Manifest v3)
│   ├── background.js      # Service worker (native messaging)
│   ├── content.js         # Content script (same as Firefox)
│   ├── popup.html        # Extension popup UI
│   └── popup.js          # Popup logic
└── native-host/
    ├── main.cpp           # Native messaging host
    ├── message_handler.cpp
    └── ipc_client.cpp     # Communicates with desktop app
```

### Key Files to Edit

- **UI/Button appearance**: `content.js` (search for "createCipherMeshButton" or "createModal")
- **Auto-fill logic**: `content.js` (search for "handleAutoFill")
- **Password saving**: `content.js` (search for "handlePasswordCapture")
- **Native messaging**: `background.js` (search for "nativePort" or "sendNativeMessage")
- **Popup**: `popup.html` and `popup.js`

### Performance Tips

- Content scripts run on every page - keep them lightweight
- Use `document_end` instead of `document_idle` for faster injection
- Debounce MutationObserver callbacks to avoid performance issues
- Only process visible password fields

### Security Reminders

- Never log passwords or master passwords to console
- All sensitive operations require master password verification
- Native messaging uses Unix socket - local only
- Passwords never stored in extension storage
- All data encrypted in desktop app vault
