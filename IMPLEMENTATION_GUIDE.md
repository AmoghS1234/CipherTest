# CipherMesh Browser Extension Implementation Guide

## Overview

CipherMesh now includes browser extension support for Firefox and Chrome, enabling auto-fill and password capture directly from web pages. This guide covers the complete implementation.

## Architecture

```
┌─────────────────┐
│   Web Browser   │
│   (Firefox/     │
│    Chrome)      │
└────────┬────────┘
         │
         │ Native Messaging Protocol
         │ (stdin/stdout + JSON)
         │
┌────────▼────────────────┐
│  Native Messaging Host  │
│  (ciphermesh-native-    │
│   host executable)      │
└────────┬────────────────┘
         │
         │ Unix Socket + JSON
         │ (~/.ciphermesh.sock)
         │
┌────────▼────────────────┐
│  CipherMesh Desktop App │
│  (IPC Server)           │
│  + SQLite Vault         │
└─────────────────────────┘
```

## Components

### 1. Browser Extensions (`extensions/firefox/` and `extensions/chrome/`)

**Files**:
- `manifest.json`: Extension metadata and permissions
- `background.js`: Native messaging communication
- `content.js`: Web page interaction (form detection, auto-fill)
- `popup.html/js`: Extension UI

**Features**:
- Detects password fields on web pages
- Adds 🔐 auto-fill button next to password fields
- Prompts to save credentials on form submission
- Multi-account selection for sites with multiple logins
- Master password verification before any operation
- Group selection when saving

### 2. Native Messaging Host (`extensions/native-host/`)

**Files**:
- `main.cpp`: Entry point, handles stdin/stdout messaging
- `message_handler.cpp`: Routes and processes messages
- `ipc_client.cpp`: Unix socket client for desktop app communication

**Purpose**:
- Bridge between browser and desktop app
- Converts native messaging protocol to Unix socket IPC
- Handles message routing and error handling

### 3. Desktop App IPC Server (`src/ipc/`)

**Files**:
- `ipc_server.hpp/cpp`: Qt-based local socket server

**Features**:
- Listens on `~/.ciphermesh.sock`
- Processes JSON messages from native host
- Interacts with Vault API
- Returns encrypted/decrypted data

## Message Protocol

### Native Messaging (Browser ↔ Native Host)

Format: 4-byte length header (little-endian) + JSON message

Example:
```
[4 bytes: 50]{"type":"GET_CREDENTIALS","url":"github.com","requestId":1}
```

### IPC Socket (Native Host ↔ Desktop App)

Format: JSON string terminated by newline (`\n`)

Example:
```json
{"type":"GET_CREDENTIALS","url":"github.com"}
```

## Supported Messages

### PING
Health check to verify desktop app is running.

**Request**:
```json
{
  "type": "PING"
}
```

**Response**:
```json
{
  "success": true,
  "status": "ok"
}
```

### GET_CREDENTIALS
Retrieve credentials for a URL.

**Request**:
```json
{
  "type": "GET_CREDENTIALS",
  "url": "github.com",
  "username": "optional-filter"
}
```

**Response**:
```json
{
  "success": true,
  "entries": [
    {
      "id": 1,
      "title": "GitHub Account",
      "username": "user@example.com",
      "password": "decrypted-password",
      "notes": "..."
    }
  ]
}
```

### SAVE_CREDENTIALS
Save new credentials to vault.

**Request**:
```json
{
  "type": "SAVE_CREDENTIALS",
  "url": "github.com",
  "username": "user@example.com",
  "password": "secret",
  "title": "GitHub Account",
  "group": "Work"
}
```

**Response**:
```json
{
  "success": true,
  "saved": true
}
```

### VERIFY_MASTER_PASSWORD
Verify user's master password.

**Request**:
```json
{
  "type": "VERIFY_MASTER_PASSWORD",
  "password": "master-password"
}
```

**Response**:
```json
{
  "success": true,
  "verified": true
}
```

### LIST_GROUPS
Get available vault groups.

**Request**:
```json
{
  "type": "LIST_GROUPS"
}
```

**Response**:
```json
{
  "success": true,
  "groups": ["Default", "Work", "Personal"]
}
```

## Installation & Setup

### Quick Start (Automated Build & Setup)

The entire setup is now automated with a single build command:

```bash
# Install dependencies
sudo apt-get install -y libsodium-dev qt6-base-dev qt6-svg-dev qt6-websockets-dev

# Build everything - manifests are automatically installed!
cd /path/to/CipherTest
mkdir build && cd build
cmake ..
cmake --build . -j$(nproc)
```

**That's it!** This single command:
- ✅ Compiles CipherMesh-Desktop with IPC server
- ✅ Builds native messaging host
- ✅ Generates development manifests
- ✅ Automatically copies manifests to all browser directories
- ✅ Configures paths to point to build directory executables

### What Gets Installed Automatically

Manifests are copied to:
- `~/.mozilla/native-messaging-hosts/com.ciphermesh.native.json` (Firefox)
- `~/.config/google-chrome/NativeMessagingHosts/com.ciphermesh.native.json` (Chrome)
- `~/.config/chromium/NativeMessagingHosts/com.ciphermesh.native.json` (Chromium)

Development manifests point to: `build/extensions/native-host/ciphermesh-native-host`

### Load Browser Extensions

**Firefox**:
1. Open `about:debugging`
2. Click "This Firefox" → "Load Temporary Add-on"
3. Select `extensions/firefox/manifest.json`

**Chrome**:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extensions/chrome/` directory
5. (Optional) Copy extension ID and update `allowed_origins` in manifest

### Optional: System-Wide Installation

For production deployment (not needed for development):

```bash
cd build
sudo make install
```

This installs to `/usr/local/bin/` and creates system manifests. You'll need to manually copy the system manifest to browser directories after this.

## Usage

### Auto-Fill Passwords

1. Open CipherMesh desktop app and unlock vault
2. Navigate to a login page
3. Click the 🔐 button next to the password field
4. Enter your master password when prompted
5. If multiple accounts exist, select the one to use
6. Credentials are auto-filled

### Save Passwords

1. Log in to a website (with CipherMesh running)
2. After form submission, extension asks to save
3. Click "Yes" when prompted
4. Enter master password
5. Select group to save to
6. Password is saved to vault

## Security Considerations

### What's Secure:

- Master password required for all operations
- Passwords only transmitted over local Unix socket
- No passwords stored by extension or native host
- Vault must be unlocked in desktop app
- Duplicate detection prevents overwrites

### What to Be Aware of:

- Native messaging requires extension to be explicitly allowed
- Socket file `~/.ciphermesh.sock` should have proper permissions (handled automatically)
- Extension has access to all web pages (required for form detection)
- Master password is sent to desktop app for verification (over local socket)

### Best Practices:

1. Always lock vault when not in use
2. Don't share extension ID or manifest
3. Verify connection status in extension popup
4. Review saved credentials periodically
5. Use strong, unique master password

## Troubleshooting

### Extension Shows "Not connected"

**Check**:
1. Is CipherMesh desktop app running?
2. Is vault unlocked?
3. Does native messaging manifest exist?
   ```bash
   ls ~/.mozilla/native-messaging-hosts/com.ciphermesh.native.json
   ```
4. Is native host executable installed?
   ```bash
   which ciphermesh-native-host
   ```
5. Check socket file:
   ```bash
   ls -l ~/.ciphermesh.sock
   ```

**Debug**:
- Check browser console for errors
- Run native host manually:
  ```bash
  echo '{"type":"PING"}' | ciphermesh-native-host
  ```
- Check IPC server logs in desktop app

### Auto-Fill Button Doesn't Appear

**Possible causes**:
- Page loaded before extension
- Password field not in a `<form>` element
- JavaScript-rendered forms may need page refresh

**Solution**:
- Refresh the page
- Check browser console for errors

### Can't Save Passwords

**Check**:
- Master password is correct
- Vault is unlocked
- Group exists (or "Default" is available)
- Entry doesn't already exist for that username+URL

## Development

### Testing Extensions Locally

1. Make changes to extension files
2. Reload extension:
   - Firefox: `about:debugging` → Reload
   - Chrome: `chrome://extensions/` → Reload icon

### Testing Native Host

```bash
# Create test message (with proper length header)
python3 -c "
import struct, json
msg = json.dumps({'type':'PING','requestId':1})
print(struct.pack('<I', len(msg)).decode('latin1') + msg, end='')
" | ciphermesh-native-host
```

### Testing IPC Server

```bash
# Connect to socket and send message
echo '{"type":"PING"}' | nc -U ~/.ciphermesh.sock
```

### Adding New Message Types

1. Add handler to `message_handler.cpp` (native host)
2. Add handler to `ipc_server.cpp` (desktop app)
3. Update `background.js` to send message
4. Update `content.js` if needed for UI

## Limitations

1. **Browser-only**: Only works with web browsers, not native apps
2. **Manual Install**: Extensions require manual installation (not in official stores)
3. **Desktop App Required**: Desktop app must be running
4. **Platform**: Currently Linux only (Unix sockets)
5. **Form Detection**: Complex/dynamic forms may not be detected

## Future Enhancements

- [ ] Windows support (Named Pipes instead of Unix sockets)
- [ ] macOS support
- [ ] Better form detection for dynamic pages
- [ ] Automatic password strength checking
- [ ] Password generation from extension
- [ ] Settings UI in extension popup
- [ ] Multiple vault support
- [ ] Biometric authentication support

## References

- [Firefox Native Messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)
- [Chrome Native Messaging](https://developer.chrome.com/docs/apps/nativeMessaging/)
- [Qt Local Socket Documentation](https://doc.qt.io/qt-6/qlocalsocket.html)

## License

Same as CipherMesh desktop application.

## Support

For issues or questions:
1. Check this guide
2. Review extension console logs
3. Check desktop app output
4. File an issue on GitHub
