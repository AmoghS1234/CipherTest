#include "ipc_server.hpp"
#include "vault.hpp"
#include "vault_entry.hpp"
#include <QDir>
#include <QFile>
#include <QStandardPaths>
#include <QDebug>

namespace CipherMesh {
namespace IPC {

IPCServer::IPCServer(CipherMesh::Core::Vault* vault, QObject* parent)
    : QObject(parent), m_server(nullptr), m_vault(vault)
{
    // Use home directory for socket
    QString home = QDir::homePath();
    m_socketPath = home + "/.ciphermesh.sock";
}

IPCServer::~IPCServer() {
    stop();
}

bool IPCServer::start() {
    if (m_server) {
        return true; // Already running
    }
    
    // Remove old socket file if it exists
    QFile::remove(m_socketPath);
    
    m_server = new QLocalServer(this);
    
    connect(m_server, &QLocalServer::newConnection, 
            this, &IPCServer::onNewConnection);
    
    if (!m_server->listen(m_socketPath)) {
        qCritical() << "Failed to start IPC server:" << m_server->errorString();
        delete m_server;
        m_server = nullptr;
        return false;
    }
    
    qInfo() << "IPC server started on" << m_socketPath;
    return true;
}

void IPCServer::stop() {
    if (m_server) {
        m_server->close();
        delete m_server;
        m_server = nullptr;
        
        // Clean up socket file
        QFile::remove(m_socketPath);
        
        qInfo() << "IPC server stopped";
    }
}

bool IPCServer::isRunning() const {
    return m_server != nullptr && m_server->isListening();
}

QString IPCServer::getSocketPath() const {
    return m_socketPath;
}

void IPCServer::onNewConnection() {
    QLocalSocket* client = m_server->nextPendingConnection();
    if (!client) return;
    
    qInfo() << "New IPC client connected";
    
    connect(client, &QLocalSocket::readyRead, 
            this, &IPCServer::onReadyRead);
    connect(client, &QLocalSocket::disconnected, 
            this, &IPCServer::onDisconnected);
    
    m_clientBuffers[client] = QByteArray();
}

void IPCServer::onReadyRead() {
    QLocalSocket* client = qobject_cast<QLocalSocket*>(sender());
    if (!client) return;
    
    // Append new data to buffer
    m_clientBuffers[client].append(client->readAll());
    
    // Process complete messages (terminated by newline)
    QByteArray& buffer = m_clientBuffers[client];
    int newlineIndex;
    
    while ((newlineIndex = buffer.indexOf('\n')) != -1) {
        QByteArray message = buffer.left(newlineIndex);
        buffer.remove(0, newlineIndex + 1);
        
        if (!message.isEmpty()) {
            QByteArray response = handleMessage(message);
            client->write(response + "\n");
            client->flush();
        }
    }
}

void IPCServer::onDisconnected() {
    QLocalSocket* client = qobject_cast<QLocalSocket*>(sender());
    if (!client) return;
    
    qInfo() << "IPC client disconnected";
    
    m_clientBuffers.remove(client);
    client->deleteLater();
}

QByteArray IPCServer::handleMessage(const QByteArray& message) {
    try {
        json request = json::parse(message.toStdString());
        json response = processRequest(request);
        return QByteArray::fromStdString(response.dump());
    } catch (const json::exception& e) {
        qWarning() << "JSON parse error:" << e.what();
        json error = createErrorResponse(std::string("Invalid JSON: ") + e.what());
        return QByteArray::fromStdString(error.dump());
    } catch (const std::exception& e) {
        qWarning() << "Exception handling message:" << e.what();
        json error = createErrorResponse(std::string("Error: ") + e.what());
        return QByteArray::fromStdString(error.dump());
    }
}

json IPCServer::processRequest(const json& request) {
    std::string type = request.value("type", "");
    
    // Only log non-PING requests to reduce overhead
    if (type != "PING") {
        qInfo() << "Processing request:" << QString::fromStdString(type);
    }
    
    if (type == "PING") {
        return handlePing(request);
    } else if (type == "GET_CREDENTIALS") {
        return handleGetCredentials(request);
    } else if (type == "SAVE_CREDENTIALS") {
        return handleSaveCredentials(request);
    } else if (type == "VERIFY_MASTER_PASSWORD") {
        return handleVerifyMasterPassword(request);
    } else if (type == "LIST_GROUPS") {
        return handleListGroups(request);
    } else {
        return createErrorResponse("Unknown request type: " + type);
    }
}

json IPCServer::handlePing(const json& request) {
    return createSuccessResponse({{"status", "ok"}});
}

json IPCServer::handleGetCredentials(const json& request) {
    std::string url = request.value("url", "");
    std::string username = request.value("username", "");
    
    if (url.empty()) {
        return createErrorResponse("URL is required");
    }
    
    if (!m_vault || m_vault->isLocked()) {
        return createErrorResponse("Vault is locked");
    }
    
    try {
        std::vector<CipherMesh::Core::VaultEntry> entries;
        
        // Find entries by URL
        entries = m_vault->findEntriesByLocation(url);
        
        // Filter by username if provided
        if (!username.empty()) {
            std::vector<CipherMesh::Core::VaultEntry> filtered;
            for (const auto& entry : entries) {
                if (entry.username == username) {
                    filtered.push_back(entry);
                }
            }
            entries = filtered;
        }
        
        // Convert entries to JSON
        json entryArray = json::array();
        for (const auto& entry : entries) {
            std::string password = m_vault->getDecryptedPassword(entry.id);
            
            entryArray.push_back({
                {"id", entry.id},
                {"title", entry.title},
                {"username", entry.username},
                {"password", password},
                {"notes", entry.notes}
            });
        }
        
        return createSuccessResponse({{"entries", entryArray}});
        
    } catch (const std::exception& e) {
        return createErrorResponse(std::string("Failed to get credentials: ") + e.what());
    }
}

json IPCServer::handleSaveCredentials(const json& request) {
    std::string url = request.value("url", "");
    std::string username = request.value("username", "");
    std::string password = request.value("password", "");
    std::string title = request.value("title", url);
    std::string groupName = request.value("group", "Default");
    
    if (url.empty() || username.empty() || password.empty()) {
        return createErrorResponse("URL, username, and password are required");
    }
    
    if (!m_vault || m_vault->isLocked()) {
        return createErrorResponse("Vault is locked");
    }
    
    try {
        // Check if entry already exists
        if (m_vault->entryExists(username, url)) {
            return createErrorResponse("Entry already exists for this username and URL");
        }
        
        // Set active group
        if (!m_vault->setActiveGroup(groupName)) {
            // Group doesn't exist, create it
            if (!m_vault->addGroup(groupName)) {
                return createErrorResponse("Failed to create group: " + groupName);
            }
            if (!m_vault->setActiveGroup(groupName)) {
                return createErrorResponse("Failed to set active group: " + groupName);
            }
        }
        
        // Create entry
        CipherMesh::Core::VaultEntry entry;
        entry.title = title;
        entry.username = username;
        entry.notes = "Saved from browser extension";
        
        // Add URL as location
        CipherMesh::Core::Location location;
        location.type = "URL";
        location.value = url;
        entry.locations.push_back(location);
        
        // Save entry
        if (m_vault->addEntry(entry, password)) {
            return createSuccessResponse({{"saved", true}});
        } else {
            return createErrorResponse("Failed to save credentials");
        }
        
    } catch (const std::exception& e) {
        return createErrorResponse(std::string("Failed to save credentials: ") + e.what());
    }
}

json IPCServer::handleVerifyMasterPassword(const json& request) {
    std::string password = request.value("password", "");
    
    if (password.empty()) {
        return createErrorResponse("Password is required");
    }
    
    if (!m_vault) {
        return createErrorResponse("Vault not available");
    }
    
    try {
        bool verified = m_vault->verifyMasterPassword(password);
        return createSuccessResponse({{"verified", verified}});
    } catch (const std::exception& e) {
        return createErrorResponse(std::string("Failed to verify password: ") + e.what());
    }
}

json IPCServer::handleListGroups(const json& request) {
    if (!m_vault || m_vault->isLocked()) {
        return createErrorResponse("Vault is locked");
    }
    
    try {
        std::vector<std::string> groups = m_vault->getGroupNames();
        json groupArray = json::array();
        
        for (const auto& group : groups) {
            groupArray.push_back(group);
        }
        
        return createSuccessResponse({{"groups", groupArray}});
        
    } catch (const std::exception& e) {
        return createErrorResponse(std::string("Failed to list groups: ") + e.what());
    }
}

json IPCServer::createErrorResponse(const std::string& error) {
    return {
        {"success", false},
        {"error", error}
    };
}

json IPCServer::createSuccessResponse(const json& data) {
    json response = {
        {"success", true}
    };
    
    // Merge data into response
    for (auto it = data.begin(); it != data.end(); ++it) {
        response[it.key()] = it.value();
    }
    
    return response;
}

} // namespace IPC
} // namespace CipherMesh
