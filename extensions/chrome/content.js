// Content script for CipherMesh Firefox Extension
// Detects password fields and injects auto-fill UI

(function() {
    'use strict';
    
    const CIPHERMESH_MARKER = 'data-ciphermesh-processed';
    let isConnected = false;
    
    // Check connection status
    chrome.runtime.sendMessage({ type: "CHECK_CONNECTION" }).then(response => {
        isConnected = response.connected;
        if (isConnected) {
            scanForPasswordFields();
        }
    }).catch(() => {
        isConnected = false;
    });
    
    // Listen for connection status updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "CONNECTION_STATUS") {
            isConnected = message.connected;
            if (isConnected) {
                scanForPasswordFields();
            }
        }
    });
    
    // Detect password fields on the page
    function scanForPasswordFields() {
        const passwordFields = document.querySelectorAll('input[type="password"]');
        
        passwordFields.forEach(field => {
            if (!field.hasAttribute(CIPHERMESH_MARKER)) {
                field.setAttribute(CIPHERMESH_MARKER, 'true');
                processPasswordField(field);
            }
        });
    }
    
    // Process individual password field
    function processPasswordField(passwordField) {
        const form = passwordField.closest('form');
        if (!form) return;
        
        // Find username field (email or text input before password)
        const usernameField = findUsernameField(form, passwordField);
        
        // Add auto-fill button
        addAutoFillButton(passwordField, usernameField);
        
        // Listen for form submission to capture credentials
        form.addEventListener('submit', (e) => {
            handleFormSubmit(form, usernameField, passwordField);
        });
    }
    
    // Find username field in form
    function findUsernameField(form, passwordField) {
        const inputs = Array.from(form.querySelectorAll('input[type="text"], input[type="email"], input'));
        
        // Find input before password field
        const passwordIndex = inputs.indexOf(passwordField);
        for (let i = passwordIndex - 1; i >= 0; i--) {
            const input = inputs[i];
            const type = input.type.toLowerCase();
            if (type === 'text' || type === 'email' || 
                input.name.match(/user|email|login/i) ||
                input.id.match(/user|email|login/i)) {
                return input;
            }
        }
        
        // Fallback: any text/email input
        return inputs.find(input => {
            const type = input.type.toLowerCase();
            return type === 'text' || type === 'email';
        });
    }
    
    // Add auto-fill button next to password field
    function addAutoFillButton(passwordField, usernameField) {
        // Check if already has button
        if (passwordField.parentElement.querySelector('.ciphermesh-autofill-btn')) {
            return;
        }
        
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ciphermesh-autofill-btn';
        button.innerHTML = '🔐';
        button.title = 'Auto-fill with CipherMesh';
        button.style.cssText = `
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            background: #569cd6;
            border: none;
            border-radius: 3px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 14px;
            z-index: 10000;
            transition: background 0.2s;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.background = '#4a8bc2';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = '#569cd6';
        });
        
        button.addEventListener('click', async () => {
            await handleAutoFill(passwordField, usernameField);
        });
        
        // Make parent relative if not already positioned
        const parent = passwordField.parentElement;
        const position = window.getComputedStyle(parent).position;
        if (position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(button);
    }
    
    // Handle auto-fill button click
    async function handleAutoFill(passwordField, usernameField) {
        const url = window.location.hostname;
        const username = usernameField ? usernameField.value : '';
        
        // Request master password
        const masterPassword = prompt('Enter your CipherMesh master password:');
        if (!masterPassword) return;
        
        // Verify master password first
        try {
            const verifyResponse = await chrome.runtime.sendMessage({
                type: "VERIFY_MASTER_PASSWORD",
                password: masterPassword
            });
            
            if (!verifyResponse.success || !verifyResponse.verified) {
                alert('Incorrect master password');
                return;
            }
        } catch (error) {
            alert('Failed to verify password: ' + error.message);
            return;
        }
        
        // Get credentials
        try {
            const response = await chrome.runtime.sendMessage({
                type: "GET_CREDENTIALS",
                url: url,
                username: username
            });
            
            if (response.success && response.data.entries) {
                const entries = response.data.entries;
                
                if (entries.length === 0) {
                    alert('No credentials found for this site');
                } else if (entries.length === 1) {
                    fillCredentials(entries[0], usernameField, passwordField);
                } else {
                    // Multiple entries - let user choose
                    showCredentialSelector(entries, usernameField, passwordField);
                }
            } else {
                alert('Failed to get credentials: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
    
    // Fill credentials into form
    function fillCredentials(entry, usernameField, passwordField) {
        if (usernameField) {
            usernameField.value = entry.username;
            usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            usernameField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        passwordField.value = entry.password;
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Show credential selector when multiple matches
    function showCredentialSelector(entries, usernameField, passwordField) {
        const selector = document.createElement('div');
        selector.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #569cd6;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 100000;
            max-width: 400px;
        `;
        
        selector.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #333;">Select Account</h3>
            <div id="ciphermesh-entries"></div>
            <button id="ciphermesh-cancel" style="margin-top: 15px; padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
        `;
        
        const entriesDiv = selector.querySelector('#ciphermesh-entries');
        entries.forEach(entry => {
            const btn = document.createElement('button');
            btn.textContent = entry.username || entry.title;
            btn.style.cssText = `
                display: block;
                width: 100%;
                padding: 10px;
                margin-bottom: 8px;
                background: #569cd6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
            `;
            btn.addEventListener('click', () => {
                fillCredentials(entry, usernameField, passwordField);
                document.body.removeChild(selector);
            });
            entriesDiv.appendChild(btn);
        });
        
        selector.querySelector('#ciphermesh-cancel').addEventListener('click', () => {
            document.body.removeChild(selector);
        });
        
        document.body.appendChild(selector);
    }
    
    // Handle form submission
    function handleFormSubmit(form, usernameField, passwordField) {
        const username = usernameField ? usernameField.value : '';
        const password = passwordField.value;
        const url = window.location.hostname;
        
        if (!username || !password) return;
        
        // Check if credentials already exist
        chrome.runtime.sendMessage({
            type: "GET_CREDENTIALS",
            url: url,
            username: username
        }).then(response => {
            if (response.success && response.data.entries && response.data.entries.length === 0) {
                // No existing entry - ask to save
                setTimeout(() => {
                    if (confirm('Save this password to CipherMesh?')) {
                        promptSaveCredentials(url, username, password);
                    }
                }, 500);
            }
        }).catch(error => {
            console.error('Error checking credentials:', error);
        });
    }
    
    // Prompt to save credentials
    async function promptSaveCredentials(url, username, password) {
        const masterPassword = prompt('Enter your CipherMesh master password to save:');
        if (!masterPassword) return;
        
        // Verify master password
        try {
            const verifyResponse = await chrome.runtime.sendMessage({
                type: "VERIFY_MASTER_PASSWORD",
                password: masterPassword
            });
            
            if (!verifyResponse.success || !verifyResponse.verified) {
                alert('Incorrect master password');
                return;
            }
        } catch (error) {
            alert('Failed to verify password: ' + error.message);
            return;
        }
        
        // Get available groups
        try {
            const groupsResponse = await chrome.runtime.sendMessage({
                type: "LIST_GROUPS"
            });
            
            if (groupsResponse.success && groupsResponse.groups) {
                const groups = groupsResponse.groups;
                let groupName = 'Default';
                
                if (groups.length > 1) {
                    // Show group selector
                    groupName = prompt('Choose group:\n' + groups.join('\n') + '\n\nEnter group name:', groups[0]);
                    if (!groupName) return;
                }
                
                // Save credentials
                const saveResponse = await chrome.runtime.sendMessage({
                    type: "SAVE_CREDENTIALS",
                    url: url,
                    username: username,
                    password: password,
                    title: document.title || url,
                    group: groupName
                });
                
                if (saveResponse.success) {
                    alert('Password saved to CipherMesh!');
                } else {
                    alert('Failed to save: ' + (saveResponse.error || 'Unknown error'));
                }
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
    
    // Scan on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanForPasswordFields);
    } else {
        scanForPasswordFields();
    }
    
    // Watch for dynamically added password fields
    const observer = new MutationObserver(() => {
        if (isConnected) {
            scanForPasswordFields();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
})();
