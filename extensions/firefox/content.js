// Content script for CipherMesh Firefox Extension
// Detects password fields and injects auto-fill UI

(function() {
    'use strict';
    
    const CIPHERMESH_MARKER = 'data-ciphermesh-processed';
    let isConnected = false;
    
    // Button positioning constants
    const MIN_BUTTON_OFFSET = 40;      // Minimum distance from right edge to avoid browser buttons
    const MIN_PADDING_FOR_BUTTONS = 75; // Minimum padding needed for both buttons
    const BUTTON_PADDING = 80;          // Total padding to accommodate both buttons
    
    // Initialize on load
    function initialize() {
        console.log('[CipherMesh] Initializing content script...');
        
        // Always scan for password fields immediately, regardless of connection
        console.log('[CipherMesh] Scanning for password fields...');
        scanForPasswordFields();
        setupMutationObserver();
        
        // Check connection status in background
        browser.runtime.sendMessage({ type: "CHECK_CONNECTION" }).then(response => {
            console.log('[CipherMesh] Connection check result:', response);
            isConnected = response.connected;
            if (isConnected) {
                console.log('[CipherMesh] Connected to vault service');
            } else {
                console.log('[CipherMesh] Not connected to vault service - buttons will still appear but may not function');
            }
        }).catch((error) => {
            console.error('[CipherMesh] Connection check failed:', error);
            isConnected = false;
            console.log('[CipherMesh] Buttons will appear but vault service connection required for functionality');
        });
    }
    
    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        console.log('[CipherMesh] DOM still loading, waiting...');
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        console.log('[CipherMesh] DOM ready, initializing immediately');
        initialize();
    }
    
    // Listen for connection status updates
    browser.runtime.onMessage.addListener((message) => {
        if (message.type === "CONNECTION_STATUS") {
            isConnected = message.connected;
            if (isConnected) {
                scanForPasswordFields();
            }
        }
    });
    
    // Setup MutationObserver to detect dynamically added password fields
    function setupMutationObserver() {
        let debounceTimer = null;
        
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'INPUT' || node.querySelector) {
                                shouldScan = true;
                                break;
                            }
                        }
                    }
                }
                if (shouldScan) break;
            }
            
            if (shouldScan) {
                // Debounce scanning to avoid excessive re-processing
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = setTimeout(() => {
                    console.log('[CipherMesh] Mutation detected, rescanning...');
                    scanForPasswordFields();
                }, 250); // Wait 250ms after last mutation
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Detect password fields on the page
    function scanForPasswordFields() {
        const passwordFields = document.querySelectorAll('input[type="password"]');
        console.log('[CipherMesh] Found', passwordFields.length, 'password fields');
        
        let processed = 0;
        passwordFields.forEach(field => {
            if (!field.hasAttribute(CIPHERMESH_MARKER) && isVisible(field)) {
                field.setAttribute(CIPHERMESH_MARKER, 'true');
                processPasswordField(field);
                processed++;
            }
        });
        console.log('[CipherMesh] Processed', processed, 'new password fields');
    }
    
    // Check if element is visible
    function isVisible(element) {
        return element.offsetWidth > 0 && element.offsetHeight > 0 &&
               window.getComputedStyle(element).visibility !== 'hidden' &&
               window.getComputedStyle(element).display !== 'none';
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
            console.log('[CipherMesh] Button already exists for this field');
            return;
        }
        
        console.log('[CipherMesh] Adding autofill button to password field');
        
        // Calculate button position to avoid conflicts with browser show/hide password button
        // Most browsers add a show/hide button at around 5-10px from the right
        // We need to position our button further left to avoid overlap
        const computedStyle = window.getComputedStyle(passwordField);
        const paddingRight = parseInt(computedStyle.paddingRight) || 0;
        
        // Position button at least MIN_BUTTON_OFFSET from the right edge to avoid overlap
        // If there's already significant padding, add to it
        const rightOffset = Math.max(paddingRight + 5, MIN_BUTTON_OFFSET);
        
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ciphermesh-autofill-btn';
        button.innerHTML = '🔐';
        button.title = 'Auto-fill with CipherMesh';
        button.setAttribute('aria-label', 'Auto-fill password with CipherMesh');
        button.style.cssText = `
            position: absolute;
            right: ${rightOffset}px;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 6px;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 16px;
            z-index: 10000;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.background = 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)';
            button.style.transform = 'translateY(-50%) scale(1.05)';
            button.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            button.style.transform = 'translateY(-50%)';
            button.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
        });
        
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('[CipherMesh] Autofill button clicked');
            await handleAutoFill(passwordField, usernameField);
        });
        
        // Make parent relative if not already positioned
        const parent = passwordField.parentElement;
        const position = window.getComputedStyle(parent).position;
        if (position === 'static') {
            parent.style.position = 'relative';
        }
        
        // Adjust password field padding to make room for both our button and browser's show/hide button
        // We need at least MIN_PADDING_FOR_BUTTONS to accommodate both buttons without overlap
        if (paddingRight < MIN_PADDING_FOR_BUTTONS) {
            passwordField.style.paddingRight = `${BUTTON_PADDING}px`;
        }
        
        parent.appendChild(button);
        console.log('[CipherMesh] Button added successfully');
    }
    
    // Create styled modal dialog
    function createModal(title, content, buttons) {
        const overlay = document.createElement('div');
        overlay.className = 'ciphermesh-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        `;
        
        const modal = document.createElement('div');
        modal.className = 'ciphermesh-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            padding: 0;
            max-width: 450px;
            width: 90%;
            animation: ciphermesh-modal-appear 0.2s ease-out;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 24px;
            border-radius: 12px 12px 0 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        header.innerHTML = `🔐 ${title}`;
        
        const body = document.createElement('div');
        body.style.cssText = `
            padding: 24px;
            color: #333;
        `;
        body.appendChild(content);
        
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 24px;
            background: #f8f9fa;
            border-radius: 0 0 12px 12px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        `;
        
        buttons.forEach(btn => footer.appendChild(btn));
        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ciphermesh-modal-appear {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
        
        return overlay;
    }
    
    // Show master password input dialog
    function showMasterPasswordDialog() {
        return new Promise((resolve) => {
            const content = document.createElement('div');
            content.innerHTML = `
                <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
                    Enter your CipherMesh master password to continue
                </p>
                <input type="password" id="ciphermesh-master-pwd" 
                    placeholder="Master password" 
                    style="
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                        box-sizing: border-box;
                        transition: border-color 0.2s;
                        font-family: inherit;
                    "
                />
            `;
            
            const input = content.querySelector('#ciphermesh-master-pwd');
            input.addEventListener('focus', () => {
                input.style.borderColor = '#667eea';
                input.style.outline = 'none';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#e0e0e0';
            });
            
            const okButton = document.createElement('button');
            okButton.textContent = 'Unlock';
            okButton.style.cssText = `
                padding: 10px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.1s, box-shadow 0.2s;
            `;
            okButton.addEventListener('mouseenter', () => {
                okButton.style.transform = 'translateY(-1px)';
                okButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            });
            okButton.addEventListener('mouseleave', () => {
                okButton.style.transform = 'translateY(0)';
                okButton.style.boxShadow = 'none';
            });
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = `
                padding: 10px 24px;
                background: white;
                color: #666;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            `;
            cancelButton.addEventListener('mouseenter', () => {
                cancelButton.style.borderColor = '#999';
                cancelButton.style.color = '#333';
            });
            cancelButton.addEventListener('mouseleave', () => {
                cancelButton.style.borderColor = '#e0e0e0';
                cancelButton.style.color = '#666';
            });
            
            const modal = createModal('Master Password', content, [cancelButton, okButton]);
            
            const submit = () => {
                const password = input.value;
                document.body.removeChild(modal);
                resolve(password);
            };
            
            okButton.addEventListener('click', submit);
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit();
            });
            
            document.body.appendChild(modal);
            setTimeout(() => input.focus(), 100);
        });
    }
    
    // Show confirmation dialog
    function showConfirmDialog(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const content = document.createElement('div');
            content.innerHTML = `
                <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.5;">
                    ${message}
                </p>
            `;
            
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes';
            yesButton.style.cssText = `
                padding: 10px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.1s, box-shadow 0.2s;
            `;
            yesButton.addEventListener('mouseenter', () => {
                yesButton.style.transform = 'translateY(-1px)';
                yesButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            });
            yesButton.addEventListener('mouseleave', () => {
                yesButton.style.transform = 'translateY(0)';
                yesButton.style.boxShadow = 'none';
            });
            
            const noButton = document.createElement('button');
            noButton.textContent = 'No';
            noButton.style.cssText = `
                padding: 10px 24px;
                background: white;
                color: #666;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            `;
            noButton.addEventListener('mouseenter', () => {
                noButton.style.borderColor = '#999';
                noButton.style.color = '#333';
            });
            noButton.addEventListener('mouseleave', () => {
                noButton.style.borderColor = '#e0e0e0';
                noButton.style.color = '#666';
            });
            
            const modal = createModal(title, content, [noButton, yesButton]);
            
            yesButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            noButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            document.body.appendChild(modal);
        });
    }
    
    // Show alert dialog
    function showAlertDialog(message, title = 'CipherMesh', isError = false) {
        return new Promise((resolve) => {
            const content = document.createElement('div');
            content.innerHTML = `
                <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.5;">
                    ${message}
                </p>
            `;
            
            const okButton = document.createElement('button');
            okButton.textContent = 'OK';
            okButton.style.cssText = `
                padding: 10px 32px;
                background: ${isError ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.1s, box-shadow 0.2s;
            `;
            okButton.addEventListener('mouseenter', () => {
                okButton.style.transform = 'translateY(-1px)';
                okButton.style.boxShadow = `0 4px 12px ${isError ? 'rgba(245, 87, 108, 0.4)' : 'rgba(102, 126, 234, 0.4)'}`;
            });
            okButton.addEventListener('mouseleave', () => {
                okButton.style.transform = 'translateY(0)';
                okButton.style.boxShadow = 'none';
            });
            
            const modal = createModal(title, content, [okButton]);
            
            okButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve();
            });
            
            document.body.appendChild(modal);
            okButton.focus();
        });
    }
    
    // Handle auto-fill button click
    async function handleAutoFill(passwordField, usernameField) {
        console.log('[CipherMesh] Starting autofill process...');
        const url = window.location.hostname;
        const username = usernameField ? usernameField.value : '';
        console.log('[CipherMesh] URL:', url, 'Username:', username || '(empty)');
        
        // Request master password with styled dialog
        console.log('[CipherMesh] Requesting master password...');
        const masterPassword = await showMasterPasswordDialog();
        if (!masterPassword) {
            console.log('[CipherMesh] Master password dialog canceled');
            return;
        }
        
        console.log('[CipherMesh] Verifying master password...');
        // Verify master password first
        try {
            const verifyResponse = await browser.runtime.sendMessage({
                type: "VERIFY_MASTER_PASSWORD",
                password: masterPassword
            });
            
            console.log('[CipherMesh] Verify response:', verifyResponse);
            
            if (!verifyResponse || !verifyResponse.success) {
                console.error('[CipherMesh] Verification failed:', verifyResponse);
                await showAlertDialog('Failed to verify password. The password may be incorrect.', 'Verification Failed', true);
                return;
            }
            
            if (!verifyResponse.verified) {
                console.log('[CipherMesh] Password incorrect');
                await showAlertDialog('The master password you entered is incorrect.', 'Incorrect Password', true);
                return;
            }
            
            console.log('[CipherMesh] Password verified successfully');
        } catch (error) {
            console.error('[CipherMesh] Error verifying password:', error);
            await showAlertDialog('Failed to verify password: ' + error.message, 'Error', true);
            return;
        }
        
        // Get credentials
        console.log('[CipherMesh] Fetching credentials...');
        try {
            const response = await browser.runtime.sendMessage({
                type: "GET_CREDENTIALS",
                url: url,
                username: username
            });
            
            console.log('[CipherMesh] Credentials response:', response);
            
            if (response.success && response.data) {
                // Handle single credential returned directly
                if (response.data.username && response.data.password) {
                    console.log('[CipherMesh] Filling single credential');
                    fillCredentials(response.data, usernameField, passwordField);
                    await showAlertDialog('Credentials filled successfully!', 'Success');
                    return;
                }
                
                // Check for both 'entries' and 'credentials' fields (vault-service uses 'credentials' for multiple)
                const entries = response.data.entries || response.data.credentials || [];
                console.log('[CipherMesh] Found', entries.length, 'entries');
                
                if (entries.length === 0) {
                    await showAlertDialog('No credentials found for this site in your vault.', 'No Credentials');
                } else if (entries.length === 1) {
                    console.log('[CipherMesh] Filling credentials from single entry');
                    fillCredentials(entries[0], usernameField, passwordField);
                    await showAlertDialog('Credentials filled successfully!', 'Success');
                } else {
                    // Multiple entries - let user choose
                    console.log('[CipherMesh] Multiple entries found, showing selector');
                    await showCredentialSelector(entries, usernameField, passwordField);
                }
            } else {
                console.error('[CipherMesh] Failed to get credentials:', response);
                await showAlertDialog('Failed to get credentials: ' + (response.error || 'Unknown error'), 'Error', true);
            }
        } catch (error) {
            console.error('[CipherMesh] Error getting credentials:', error);
            await showAlertDialog('Error: ' + error.message, 'Error', true);
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
        browser.runtime.sendMessage({
            type: "GET_CREDENTIALS",
            url: url,
            username: username
        }).then(response => {
            // Check if there's a direct credential or multiple entries
            if (response.success && response.data) {
                const hasSingleEntry = response.data.username && response.data.password;
                const entries = response.data.entries || response.data.credentials || [];
                
                if (!hasSingleEntry && entries.length === 0) {
                    // No existing entry - ask to save
                    setTimeout(async () => {
                        const shouldSave = await showConfirmDialog(
                        `Save password for <strong>${username}</strong> on <strong>${url}</strong> to your CipherMesh vault?`,
                        'Save Password'
                    );
                    if (shouldSave) {
                        promptSaveCredentials(url, username, password);
                    }
                }, 500);
            }
        }).catch(error => {
            console.error('Error checking credentials:', error);
        });
    }
    
    // Show group selector dialog
    function showGroupSelector(groups) {
        return new Promise((resolve) => {
            const content = document.createElement('div');
            content.innerHTML = `
                <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
                    Choose which group to save this password to
                </p>
                <div id="ciphermesh-group-list" style="
                    max-height: 300px;
                    overflow-y: auto;
                "></div>
            `;
            
            const groupList = content.querySelector('#ciphermesh-group-list');
            
            groups.forEach((group, index) => {
                const groupBtn = document.createElement('button');
                groupBtn.textContent = group;
                groupBtn.style.cssText = `
                    display: block;
                    width: 100%;
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    background: white;
                    color: #333;
                    border: 2px solid ${index === 0 ? '#667eea' : '#e0e0e0'};
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                `;
                
                groupBtn.addEventListener('mouseenter', () => {
                    groupBtn.style.borderColor = '#667eea';
                    groupBtn.style.background = '#f8f9ff';
                });
                groupBtn.addEventListener('mouseleave', () => {
                    groupBtn.style.borderColor = index === 0 ? '#667eea' : '#e0e0e0';
                    groupBtn.style.background = 'white';
                });
                groupBtn.addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve(group);
                });
                
                groupList.appendChild(groupBtn);
            });
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = `
                padding: 10px 24px;
                background: white;
                color: #666;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            `;
            cancelButton.addEventListener('mouseenter', () => {
                cancelButton.style.borderColor = '#999';
                cancelButton.style.color = '#333';
            });
            cancelButton.addEventListener('mouseleave', () => {
                cancelButton.style.borderColor = '#e0e0e0';
                cancelButton.style.color = '#666';
            });
            
            const modal = createModal('Select Group', content, [cancelButton]);
            
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
            
            document.body.appendChild(modal);
        });
    }
    
    // Prompt to save credentials
    async function promptSaveCredentials(url, username, password) {
        const masterPassword = await showMasterPasswordDialog();
        if (!masterPassword) return;
        
        // Verify master password
        try {
            const verifyResponse = await browser.runtime.sendMessage({
                type: "VERIFY_MASTER_PASSWORD",
                password: masterPassword
            });
            
            if (!verifyResponse.success || !verifyResponse.verified) {
                await showAlertDialog('The master password you entered is incorrect.', 'Incorrect Password', true);
                return;
            }
        } catch (error) {
            await showAlertDialog('Failed to verify password: ' + error.message, 'Error', true);
            return;
        }
        
        // Get available groups
        try {
            const groupsResponse = await browser.runtime.sendMessage({
                type: "LIST_GROUPS"
            });
            
            if (groupsResponse.success && groupsResponse.groups) {
                const groups = groupsResponse.groups;
                let groupName = groups[0] || 'Default';
                
                if (groups.length > 1) {
                    // Show group selector
                    const selected = await showGroupSelector(groups);
                    if (!selected) return;
                    groupName = selected;
                }
                
                // Save credentials
                const saveResponse = await browser.runtime.sendMessage({
                    type: "SAVE_CREDENTIALS",
                    url: url,
                    username: username,
                    password: password,
                    title: document.title || url,
                    group: groupName
                });
                
                if (saveResponse.success) {
                    await showAlertDialog(`Password for <strong>${username}</strong> has been saved to group <strong>${groupName}</strong>!`, 'Password Saved');
                } else {
                    await showAlertDialog('Failed to save: ' + (saveResponse.error || 'Unknown error'), 'Error', true);
                }
            }
        } catch (error) {
            await showAlertDialog('Error: ' + error.message, 'Error', true);
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
