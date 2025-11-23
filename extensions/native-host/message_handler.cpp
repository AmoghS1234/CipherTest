#include "message_handler.hpp"
#include <iostream>

MessageHandler::MessageHandler() : m_ipcClient(std::make_unique<IPCClient>()) {
}

MessageHandler::~MessageHandler() {
    if (m_ipcClient) {
        m_ipcClient->disconnect();
    }
}

bool MessageHandler::ensureConnected() {
    if (m_ipcClient && m_ipcClient->isConnected()) {
        return true;
    }
    
    if (!m_ipcClient) {
        m_ipcClient = std::make_unique<IPCClient>();
    }
    
    return m_ipcClient->connect();
}

json MessageHandler::handleMessage(const json& request) {
    try {
        int requestId = request.value("requestId", -1);
        std::string type = request.value("type", "");
        
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
            return createErrorResponse(requestId, "Unknown message type: " + type);
        }
    } catch (const std::exception& e) {
        std::cerr << "Error handling message: " << e.what() << std::endl;
        return createErrorResponse(-1, e.what());
    }
}

json MessageHandler::handlePing(const json& request) {
    int requestId = request.value("requestId", -1);
    
    // Check if desktop app is running by trying to connect
    if (ensureConnected()) {
        json pingMsg = {{"type", "PING"}};
        json response = m_ipcClient->sendMessage(pingMsg);
        
        if (response.value("success", false)) {
            return createSuccessResponse(requestId, {{"status", "ok"}});
        }
    }
    
    return createErrorResponse(requestId, "Desktop app not running");
}

json MessageHandler::handleGetCredentials(const json& request) {
    int requestId = request.value("requestId", -1);
    std::string url = request.value("url", "");
    std::string username = request.value("username", "");
    
    if (url.empty()) {
        return createErrorResponse(requestId, "URL is required");
    }
    
    if (!ensureConnected()) {
        return createErrorResponse(requestId, "Failed to connect to desktop app");
    }
    
    json ipcRequest = {
        {"type", "GET_CREDENTIALS"},
        {"url", url},
        {"username", username}
    };
    
    json response = m_ipcClient->sendMessage(ipcRequest);
    
    if (response.value("success", false)) {
        return createSuccessResponse(requestId, response["data"]);
    } else {
        // Connection might be broken, disconnect and let next call reconnect
        if (response.value("error", "") == "Failed to receive response") {
            m_ipcClient->disconnect();
        }
        return createErrorResponse(requestId, response.value("error", "Unknown error"));
    }
}

json MessageHandler::handleSaveCredentials(const json& request) {
    int requestId = request.value("requestId", -1);
    std::string url = request.value("url", "");
    std::string username = request.value("username", "");
    std::string password = request.value("password", "");
    std::string title = request.value("title", "");
    std::string group = request.value("group", "Default");
    
    if (url.empty() || username.empty() || password.empty()) {
        return createErrorResponse(requestId, "URL, username, and password are required");
    }
    
    if (!ensureConnected()) {
        return createErrorResponse(requestId, "Failed to connect to desktop app");
    }
    
    json ipcRequest = {
        {"type", "SAVE_CREDENTIALS"},
        {"url", url},
        {"username", username},
        {"password", password},
        {"title", title},
        {"group", group}
    };
    
    json response = m_ipcClient->sendMessage(ipcRequest);
    
    if (response.value("success", false)) {
        return createSuccessResponse(requestId, {{"saved", true}});
    } else {
        if (response.value("error", "") == "Failed to receive response") {
            m_ipcClient->disconnect();
        }
        return createErrorResponse(requestId, response.value("error", "Unknown error"));
    }
}

json MessageHandler::handleVerifyMasterPassword(const json& request) {
    int requestId = request.value("requestId", -1);
    std::string password = request.value("password", "");
    
    if (password.empty()) {
        return createErrorResponse(requestId, "Password is required");
    }
    
    if (!ensureConnected()) {
        return createErrorResponse(requestId, "Failed to connect to desktop app");
    }
    
    json ipcRequest = {
        {"type", "VERIFY_MASTER_PASSWORD"},
        {"password", password}
    };
    
    json response = m_ipcClient->sendMessage(ipcRequest);
    
    if (response.value("success", false)) {
        return createSuccessResponse(requestId, {{"verified", response.value("verified", false)}});
    } else {
        if (response.value("error", "") == "Failed to receive response") {
            m_ipcClient->disconnect();
        }
        return createErrorResponse(requestId, response.value("error", "Unknown error"));
    }
}

json MessageHandler::handleListGroups(const json& request) {
    int requestId = request.value("requestId", -1);
    
    if (!ensureConnected()) {
        return createErrorResponse(requestId, "Failed to connect to desktop app");
    }
    
    json ipcRequest = {{"type", "LIST_GROUPS"}};
    
    json response = m_ipcClient->sendMessage(ipcRequest);
    
    if (response.value("success", false)) {
        return createSuccessResponse(requestId, {{"groups", response.value("groups", json::array())}});
    } else {
        if (response.value("error", "") == "Failed to receive response") {
            m_ipcClient->disconnect();
        }
        return createErrorResponse(requestId, response.value("error", "Unknown error"));
    }
}

json MessageHandler::createErrorResponse(int requestId, const std::string& error) {
    return {
        {"requestId", requestId},
        {"success", false},
        {"error", error}
    };
}

json MessageHandler::createSuccessResponse(int requestId, const json& data) {
    return {
        {"requestId", requestId},
        {"success", true},
        {"data", data}
    };
}
