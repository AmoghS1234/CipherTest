// Background service worker for CipherMesh Chrome Extension
// Chrome Manifest V3 version

let nativePort = null;
let pendingRequests = new Map();
let requestId = 0;

// Connect to native messaging host
function connectNative() {
    try {
        nativePort = chrome.runtime.connectNative("com.ciphermesh.native");
        
        nativePort.onMessage.addListener((message) => {
            console.log("Received from native:", message);
            handleNativeMessage(message);
        });
        
        nativePort.onDisconnect.addListener(() => {
            console.log("Disconnected from native app");
            nativePort = null;
            
            // Notify content scripts that connection is lost
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: "CONNECTION_STATUS",
                        connected: false
                    }).catch(() => {});
                });
            });
        });
        
        console.log("Connected to native messaging host");
        return true;
    } catch (error) {
        console.error("Failed to connect to native app:", error);
        return false;
    }
}

// Send message to native host
function sendToNative(message) {
    return new Promise((resolve, reject) => {
        if (!nativePort) {
            if (!connectNative()) {
                reject(new Error("Failed to connect to CipherMesh desktop app"));
                return;
            }
        }
        
        const id = requestId++;
        message.requestId = id;
        
        pendingRequests.set(id, { resolve, reject });
        
        try {
            nativePort.postMessage(message);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error("Request timeout"));
                }
            }, 30000);
        } catch (error) {
            pendingRequests.delete(id);
            reject(error);
        }
    });
}

// Handle messages from native host
function handleNativeMessage(message) {
    const { requestId, type, success, data, error } = message;
    
    if (pendingRequests.has(requestId)) {
        const { resolve, reject } = pendingRequests.get(requestId);
        pendingRequests.delete(requestId);
        
        if (success) {
            resolve(data);
        } else {
            reject(new Error(error || "Unknown error"));
        }
    }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message from content script:", message);
    
    switch (message.type) {
        case "GET_CREDENTIALS":
            sendToNative({
                type: "GET_CREDENTIALS",
                url: message.url,
                username: message.username
            }).then(data => {
                sendResponse({ success: true, data });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Keep channel open for async response
            
        case "SAVE_CREDENTIALS":
            sendToNative({
                type: "SAVE_CREDENTIALS",
                url: message.url,
                username: message.username,
                password: message.password,
                title: message.title
            }).then(data => {
                sendResponse({ success: true, data });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case "CHECK_CONNECTION":
            sendToNative({
                type: "PING"
            }).then(() => {
                sendResponse({ connected: true });
            }).catch(() => {
                sendResponse({ connected: false });
            });
            return true;
            
        case "VERIFY_MASTER_PASSWORD":
            sendToNative({
                type: "VERIFY_MASTER_PASSWORD",
                password: message.password
            }).then(data => {
                sendResponse({ success: true, verified: data.verified });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case "LIST_GROUPS":
            sendToNative({
                type: "LIST_GROUPS"
            }).then(data => {
                sendResponse({ success: true, groups: data.groups });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
    }
    
    return false;
});

// Initialize connection on startup
connectNative();

console.log("CipherMesh background service worker loaded");
