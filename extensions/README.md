# CipherMesh Browser Extensions

Browser extensions for Firefox and Chrome that enable auto-fill and password capture from web pages.

## Features

- **Auto-Fill**: Click the 🔐 button next to password fields to auto-fill credentials from your CipherMesh vault
- **Password Capture**: Automatically detect new logins and prompt to save to your vault
- **Multi-Account Support**: If multiple accounts exist for a site, choose which one to use
- **Secure**: Requires master password verification before any operation
- **Group Selection**: Choose which group to save passwords to

## Installation

### Prerequisites

1. CipherMesh desktop application must be installed and running
2. Native messaging host must be installed (see below)

### Firefox Installation

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" → "Load Temporary Add-on"
3. Select the `manifest.json` file from the `firefox` directory
4. The extension will be loaded (note: temporary add-ons are removed when Firefox closes)

For permanent installation, the extension needs to be signed by Mozilla or installed as a Developer Edition.

### Chrome Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome` directory
5. The extension will be loaded

### Native Messaging Host Setup

The native messaging host is required for the extension to communicate with the CipherMesh desktop app.

#### Linux

1. Build the native host:
   ```bash
   cd extensions/native-host
   mkdir build && cd build
   cmake ..
   make
   ```

2. Install the native messaging manifests:

   **Firefox:**
   ```bash
   mkdir -p ~/.mozilla/native-messaging-hosts/
   cp com.ciphermesh.native.json ~/.mozilla/native-messaging-hosts/
   ```

   **Chrome/Chromium:**
   ```bash
   mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
   cp com.ciphermesh.native.json ~/.config/google-chrome/NativeMessagingHosts/
   # For Chromium:
   mkdir -p ~/.config/chromium/NativeMessagingHosts/
   cp com.ciphermesh.native.json ~/.config/chromium/NativeMessagingHosts/
   ```

3. Update the manifest file to point to the correct executable path

## Usage

### Auto-Fill Passwords

1. Navigate to a login page
2. Click the 🔐 button next to the password field
3. Enter your CipherMesh master password
4. If multiple accounts exist, select the one you want to use
5. Credentials will be auto-filled

### Save New Passwords

1. Log in to a website
2. After submitting the form, you'll be prompted to save the password
3. Enter your master password
4. Select the group to save to
5. Password is saved to your CipherMesh vault

## Architecture

### Components

1. **Content Script** (`content.js`): Runs on web pages, detects password fields, injects UI
2. **Background Script** (`background.js`): Handles native messaging with desktop app
3. **Popup** (`popup.html/js`): Extension popup showing connection status

### Message Flow

```
Web Page → Content Script → Background Script → Native Host → Desktop App
```

### API Messages

The extension communicates with the desktop app using these message types:

- `PING`: Check connection status
- `GET_CREDENTIALS`: Retrieve credentials for a URL
- `SAVE_CREDENTIALS`: Save new credentials
- `VERIFY_MASTER_PASSWORD`: Verify user's master password
- `LIST_GROUPS`: Get available vault groups

## Development

### Building

No build step is required for the extensions themselves - they're plain JavaScript.

For the native host, see `native-host/README.md`.

### Testing

1. Load the extension in developer mode
2. Open browser developer console
3. Check for CipherMesh logs in background script console
4. Test on various login pages

### Debugging

- Firefox: `about:debugging` → inspect extension
- Chrome: `chrome://extensions/` → click "Details" → "Inspect views: background page"

## Security Notes

- Master password is never stored by the extension
- Passwords are only retrieved after master password verification
- Communication with native app is over secure local messaging
- Extension requires explicit permissions for each operation

## Limitations

- Native messaging host must be manually installed
- Desktop app must be running for extension to work
- Some websites with complex login forms may not be detected
- Dynamic/AJAX forms may require page refresh

## Troubleshooting

**Extension shows "Not connected to app":**
- Ensure CipherMesh desktop app is running
- Check that native messaging host is properly installed
- Verify manifest paths are correct
- Check browser console for errors

**Auto-fill button doesn't appear:**
- Refresh the page
- Check if password field is in a form element
- Some sites may have custom password fields that aren't detected

**Can't save passwords:**
- Verify master password is correct
- Ensure desktop app is unlocked
- Check that a group is selected

## License

Same as CipherMesh desktop application
