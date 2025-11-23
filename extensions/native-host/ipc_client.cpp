#include "ipc_client.hpp"
#include <iostream>
#include <cstring>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <pwd.h>

IPCClient::IPCClient() : sockfd(-1), connected(false) {
}

IPCClient::~IPCClient() {
    disconnect();
}

std::string IPCClient::getSocketPath() {
    // Get user's home directory
    const char* home = getenv("HOME");
    if (!home) {
        struct passwd* pw = getpwuid(getuid());
        if (pw) {
            home = pw->pw_dir;
        }
    }
    
    if (!home) {
        home = "/tmp";
    }
    
    return std::string(home) + "/.ciphermesh.sock";
}

bool IPCClient::connect() {
    if (connected) {
        return true;
    }
    
    sockfd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (sockfd < 0) {
        std::cerr << "Failed to create socket: " << strerror(errno) << std::endl;
        return false;
    }
    
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    
    std::string socketPath = getSocketPath();
    strncpy(addr.sun_path, socketPath.c_str(), sizeof(addr.sun_path) - 1);
    
    if (::connect(sockfd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        std::cerr << "Failed to connect to " << socketPath << ": " << strerror(errno) << std::endl;
        close(sockfd);
        sockfd = -1;
        return false;
    }
    
    connected = true;
    return true;
}

void IPCClient::disconnect() {
    if (sockfd >= 0) {
        close(sockfd);
        sockfd = -1;
    }
    connected = false;
}

json IPCClient::sendMessage(const json& message) {
    if (!connected) {
        return {{"success", false}, {"error", "Not connected"}};
    }
    
    try {
        // Send message as JSON string with newline delimiter
        std::string messageStr = message.dump() + "\n";
        
        ssize_t sent = send(sockfd, messageStr.c_str(), messageStr.length(), 0);
        if (sent < 0) {
            std::cerr << "Failed to send message: " << strerror(errno) << std::endl;
            return {{"success", false}, {"error", "Failed to send message"}};
        }
        
        // Receive response (read until newline)
        std::string response;
        char buffer[4096];
        
        while (true) {
            ssize_t received = recv(sockfd, buffer, sizeof(buffer) - 1, 0);
            if (received <= 0) {
                if (received < 0) {
                    std::cerr << "Failed to receive response: " << strerror(errno) << std::endl;
                }
                return {{"success", false}, {"error", "Failed to receive response"}};
            }
            
            buffer[received] = '\0';
            response += buffer;
            
            // Check if we have a complete message (ends with newline)
            if (response.find('\n') != std::string::npos) {
                break;
            }
        }
        
        // Parse JSON response
        try {
            return json::parse(response);
        } catch (const json::exception& e) {
            std::cerr << "Failed to parse response: " << e.what() << std::endl;
            return {{"success", false}, {"error", "Invalid JSON response"}};
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Exception in sendMessage: " << e.what() << std::endl;
        return {{"success", false}, {"error", e.what()}};
    }
}
