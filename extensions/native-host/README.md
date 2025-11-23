# CipherMesh Native Messaging Host

This is the native messaging host that enables communication between browser extensions and the CipherMesh desktop application.

## Overview

The native messaging host acts as a bridge:
- Browser Extension ↔ Native Host ↔ CipherMesh Desktop App

It receives JSON messages from the browser extension over stdin/stdout (native messaging protocol) and forwards them to the CipherMesh desktop app over a Unix domain socket.

## Building

The native messaging host is now integrated into the main CipherMesh build system.

### Automated Build (Recommended)

Build as part of the main project:

```bash
# From CipherMesh root directory
mkdir build && cd build
cmake ..
cmake --build . -j$(nproc)
```

**Manifests are automatically installed!** The build system:
- Compiles `ciphermesh-native-host` executable
- Generates manifests pointing to the build directory
- Copies manifests to:
  - `~/.mozilla/native-messaging-hosts/` (Firefox)
  - `~/.config/google-chrome/NativeMessagingHosts/` (Chrome)
  - `~/.config/chromium/NativeMessagingHosts/` (Chromium)

### Manual Build (Not Recommended)

If building standalone (outside main project):

```bash
cd extensions/native-host
mkdir build && cd build
cmake ..
make
```

Then manually copy manifests and update paths.

## Installation

### Development Use (Automatic)

No manual installation needed! The build process handles everything.

Just load the browser extension and start using it.

### System-Wide Installation (Optional)

For production deployment:

```bash
cd build  # From CipherMesh root build directory
sudo make install
```

This installs:
- `/usr/local/bin/ciphermesh-native-host` - The executable
- `/usr/local/share/ciphermesh/native-messaging/com.ciphermesh.native.json` - System manifest

Then copy system manifest to browser directories:

**Firefox:**
```bash
mkdir -p ~/.mozilla/native-messaging-hosts/
cp /usr/local/share/ciphermesh/native-messaging/com.ciphermesh.native.json ~/.mozilla/native-messaging-hosts/
```

**Chrome/Chromium:**
```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
cp /usr/local/share/ciphermesh/native-messaging/com.ciphermesh.native.json ~/.config/google-chrome/NativeMessagingHosts/

# For Chromium:
mkdir -p ~/.config/chromium/NativeMessagingHosts/
cp /usr/local/share/ciphermesh/native-messaging/com.ciphermesh.native.json ~/.config/chromium/NativeMessagingHosts/
```

**Note:** For Chrome, update the manifest with your extension ID from `chrome://extensions/`

## How It Works

### Native Messaging Protocol

Browsers communicate with native hosts using a simple protocol:
1. **Length Header**: 4-byte unsigned integer (little-endian) indicating message length
2. **Message Body**: JSON string of the specified length

The native host reads messages from stdin and writes responses to stdout using this format.

### IPC with Desktop App

The native host communicates with the CipherMesh desktop app using a Unix domain socket at `~/.ciphermesh.sock`.

Messages are sent as JSON strings terminated by newline (`\n`).

### Message Types

The native host supports these message types:

- **PING**: Check if desktop app is running
- **GET_CREDENTIALS**: Retrieve credentials for a URL
- **SAVE_CREDENTIALS**: Save new credentials
- **VERIFY_MASTER_PASSWORD**: Verify the user's master password
- **LIST_GROUPS**: Get available vault groups

## Architecture

### Components

1. **main.cpp**: Entry point, handles native messaging I/O
2. **message_handler.cpp**: Processes incoming messages, routes to appropriate handlers
3. **ipc_client.cpp**: Manages socket connection to desktop app

### Message Flow

```
Browser → stdin → main.cpp → MessageHandler → IPCClient → Desktop App
Desktop App → IPCClient → MessageHandler → stdout → Browser
```

## Debugging

The native host logs to stderr. To see logs:

**Firefox:**
```bash
tail -f ~/.mozilla/native-messaging-hosts/ciphermesh.log
```

**Chrome:**
Check the extension's background page console in `chrome://extensions/`.

## Troubleshooting

**"Failed to connect to desktop app"**
- Ensure CipherMesh desktop app is running
- Check that socket exists: `ls -l ~/.ciphermesh.sock`
- Verify socket permissions

**"Native host has exited"**
- Check stderr logs for errors
- Verify executable has correct permissions: `chmod +x /usr/local/bin/ciphermesh-native-host`
- Test manually: `echo '{"type":"PING","requestId":1}' | /usr/local/bin/ciphermesh-native-host`

**Messages not received**
- Verify manifest path is correct
- Check manifest JSON is valid
- For Chrome, ensure extension ID is correct in manifest

## Security Considerations

- The native host only accepts connections from allowed extensions (specified in manifest)
- No authentication is performed - the desktop app should verify master password for sensitive operations
- Socket communication is local only (Unix domain socket)
- Passwords are never logged or stored by the native host

## Development

### Testing

Test the native host manually:

```bash
# Create a test message
echo '00000000{"type":"PING","requestId":1}' | /usr/local/bin/ciphermesh-native-host

# The first 4 bytes should be the message length in little-endian
# For proper testing, use a script to generate the correct length header
```

### Building in Debug Mode

```bash
cmake -DCMAKE_BUILD_TYPE=Debug ..
make
```

This enables debug symbols and additional logging.

## License

Same as CipherMesh desktop application
