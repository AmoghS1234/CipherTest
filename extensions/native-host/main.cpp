#include <iostream>
#include <cstdint>
#include <vector>
#include <nlohmann/json.hpp>
#include "message_handler.hpp"

using json = nlohmann::json;

// Read a message from stdin (native messaging format)
json readMessage() {
    // Read 4-byte length header
    uint32_t length = 0;
    std::cin.read(reinterpret_cast<char*>(&length), sizeof(length));
    
    if (std::cin.eof()) {
        return json(); // Empty JSON indicates EOF
    }
    
    if (length == 0 || length > 1024 * 1024) { // Max 1MB
        std::cerr << "Invalid message length: " << length << std::endl;
        return json();
    }
    
    // Read message body
    std::vector<char> buffer(length);
    std::cin.read(buffer.data(), length);
    
    if (std::cin.gcount() != static_cast<std::streamsize>(length)) {
        std::cerr << "Failed to read complete message" << std::endl;
        return json();
    }
    
    try {
        return json::parse(buffer.begin(), buffer.end());
    } catch (const json::exception& e) {
        std::cerr << "JSON parse error: " << e.what() << std::endl;
        return json();
    }
}

// Write a message to stdout (native messaging format)
void writeMessage(const json& message) {
    std::string messageStr = message.dump();
    uint32_t length = static_cast<uint32_t>(messageStr.length());
    
    // Write length header
    std::cout.write(reinterpret_cast<const char*>(&length), sizeof(length));
    
    // Write message body
    std::cout.write(messageStr.c_str(), length);
    std::cout.flush();
}

int main() {
    // Set binary mode for stdin/stdout on Windows
    #ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
    #endif
    
    std::cerr << "CipherMesh Native Messaging Host started" << std::endl;
    
    MessageHandler handler;
    
    // Main message loop
    while (true) {
        json request = readMessage();
        
        if (request.empty()) {
            std::cerr << "Empty or invalid message, exiting" << std::endl;
            break;
        }
        
        std::cerr << "Received: " << request.dump() << std::endl;
        
        // Process message
        json response = handler.handleMessage(request);
        
        std::cerr << "Sending: " << response.dump() << std::endl;
        
        // Send response
        writeMessage(response);
    }
    
    std::cerr << "CipherMesh Native Messaging Host stopped" << std::endl;
    return 0;
}
