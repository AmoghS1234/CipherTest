#include "vault_service.hpp"
#include "../../src/core/vault.hpp"
#include "../../src/core/crypto.hpp"
#include <iostream>
#include <fstream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using namespace CipherMesh::Core;

VaultService::VaultService() : m_vault(nullptr) {
}

VaultService::~VaultService() {
    if (m_vault) {
        m_vault->lock();
    }
}

std::string VaultService::getDefaultVaultPath() {
    const char* home = getenv("HOME");
    if (!home) {
        return "";
    }
    return std::string(home) + "/.ciphermesh/vault.db";
}

json VaultService::handleRequest(const json& request) {
    json response;
    
    try {
        std::string action = request["action"];
        
        if (action == "VERIFY_MASTER_PASSWORD") {
            return handleVerifyMasterPassword(request);
        } else if (action == "GET_CREDENTIALS") {
            return handleGetCredentials(request);
        } else if (action == "GET_CREDENTIAL_BY_ID") {
            return handleGetCredentialById(request);
        } else if (action == "SAVE_CREDENTIALS") {
            return handleSaveCredentials(request);
        } else if (action == "LIST_GROUPS") {
            return handleListGroups(request);
        } else if (action == "PING") {
            response["status"] = "success";
            response["message"] = "pong";
            return response;
        } else {
            response["status"] = "error";
            response["error"] = "Unknown action: " + action;
            return response;
        }
    } catch (const std::exception& e) {
        response["status"] = "error";
        response["error"] = std::string("Exception: ") + e.what();
        return response;
    }
}

json VaultService::handleVerifyMasterPassword(const json& request) {
    json response;
    
    try {
        std::string masterPassword = request["masterPassword"];
        std::string vaultPath = request.value("vaultPath", getDefaultVaultPath());
        
        if (vaultPath.empty()) {
            response["status"] = "error";
            response["error"] = "Could not determine vault path";
            return response;
        }
        
        // Check if vault file exists
        std::ifstream vaultFile(vaultPath);
        if (!vaultFile.good()) {
            response["status"] = "error";
            response["error"] = "Vault file not found at: " + vaultPath;
            return response;
        }
        
        // Create new vault instance
        std::unique_ptr<Vault> vault = std::make_unique<Vault>();
        
        // Try to load vault with master password
        if (!vault->loadVault(vaultPath, masterPassword)) {
            response["status"] = "error";
            response["error"] = "Incorrect master password";
            return response;
        }
        
        // Password is correct, keep vault unlocked for this session
        m_vault = std::move(vault);
        
        response["status"] = "success";
        response["message"] = "Master password verified";
        return response;
        
    } catch (const std::exception& e) {
        response["status"] = "error";
        response["error"] = std::string("Error verifying password: ") + e.what();
        return response;
    }
}

json VaultService::handleGetCredentials(const json& request) {
    json response;
    
    try {
        if (!m_vault || m_vault->isLocked()) {
            response["status"] = "error";
            response["error"] = "Vault is locked. Please verify master password first.";
            return response;
        }
        
        std::string url = request["url"];
        std::string username = request.value("username", "");
        
        // Find entries matching the URL
        std::vector<VaultEntry> entries = m_vault->findEntriesByLocation(url);
        
        if (entries.empty()) {
            response["status"] = "error";
            response["error"] = "No credentials found for: " + url;
            return response;
        }
        
        // If username is specified, filter by username
        if (!username.empty()) {
            auto it = std::find_if(entries.begin(), entries.end(),
                [&username](const VaultEntry& e) { return e.username == username; });
            
            if (it == entries.end()) {
                response["status"] = "error";
                response["error"] = "No credentials found for username: " + username;
                return response;
            }
            
            // Found specific entry
            std::string password = m_vault->getDecryptedPassword(it->id);
            
            response["status"] = "success";
            response["username"] = it->username;
            response["password"] = password;
            response["title"] = it->title;
            return response;
        }
        
        // Multiple entries - return list for user to choose
        json credentials = json::array();
        for (const auto& entry : entries) {
            json cred;
            cred["id"] = entry.id;
            cred["username"] = entry.username;
            cred["title"] = entry.title;
            credentials.push_back(cred);
        }
        
        response["status"] = "multiple";
        response["credentials"] = credentials;
        return response;
        
    } catch (const std::exception& e) {
        response["status"] = "error";
        response["error"] = std::string("Error getting credentials: ") + e.what();
        return response;
    }
}

json VaultService::handleGetCredentialById(const json& request) {
    json response;
    
    try {
        if (!m_vault || m_vault->isLocked()) {
            response["status"] = "error";
            response["error"] = "Vault is locked";
            return response;
        }
        
        int entryId = request["entryId"];
        
        std::string password = m_vault->getDecryptedPassword(entryId);
        
        // Get entry details - we need to find it in current group entries
        std::vector<VaultEntry> allEntries = m_vault->getEntries();
        auto it = std::find_if(allEntries.begin(), allEntries.end(),
            [entryId](const VaultEntry& e) { return e.id == entryId; });
        
        if (it == allEntries.end()) {
            response["status"] = "error";
            response["error"] = "Entry not found";
            return response;
        }
        
        response["status"] = "success";
        response["username"] = it->username;
        response["password"] = password;
        response["title"] = it->title;
        return response;
        
    } catch (const std::exception& e) {
        response["status"] = "error";
        response["error"] = std::string("Error: ") + e.what();
        return response;
    }
}

json VaultService::handleSaveCredentials(const json& request) {
    json response;
    
    try {
        if (!m_vault || m_vault->isLocked()) {
            response["status"] = "error";
            response["error"] = "Vault is locked. Please verify master password first.";
            return response;
        }
        
        std::string url = request["url"];
        std::string username = request["username"];
        std::string password = request["password"];
        std::string groupName = request.value("group", "Default");
        std::string title = request.value("title", url);
        
        // Check if entry already exists
        if (m_vault->entryExists(username, url)) {
            response["status"] = "error";
            response["error"] = "Entry already exists for this username and URL";
            return response;
        }
        
        // Set active group
        if (!m_vault->setActiveGroup(groupName)) {
            // Group doesn't exist, create it
            if (!m_vault->addGroup(groupName)) {
                response["status"] = "error";
                response["error"] = "Failed to create group: " + groupName;
                return response;
            }
            if (!m_vault->setActiveGroup(groupName)) {
                response["status"] = "error";
                response["error"] = "Failed to set active group: " + groupName;
                return response;
            }
        }
        
        // Create entry
        VaultEntry entry;
        entry.title = title;
        entry.username = username;
        entry.notes = "Saved from browser extension";
        entry.locations.push_back({url, "Website"});
        
        if (!m_vault->addEntry(entry, password)) {
            response["status"] = "error";
            response["error"] = "Failed to save credentials";
            return response;
        }
        
        response["status"] = "success";
        response["message"] = "Credentials saved successfully";
        return response;
        
    } catch (const std::exception& e) {
        response["status"] = "error";
        response["error"] = std::string("Error saving credentials: ") + e.what();
        return response;
    }
}

json VaultService::handleListGroups(const json& request) {
    json response;
    
    try {
        if (!m_vault || m_vault->isLocked()) {
            response["status"] = "error";
            response["error"] = "Vault is locked. Please verify master password first.";
            return response;
        }
        
        std::vector<std::string> groupNames = m_vault->getGroupNames();
        
        json groups = json::array();
        for (const auto& name : groupNames) {
            groups.push_back(name);
        }
        
        response["status"] = "success";
        response["groups"] = groups;
        return response;
        
    } catch (const std::exception& e) {
        response["status"] = "error";
        response["error"] = std::string("Error listing groups: ") + e.what();
        return response;
    }
}
