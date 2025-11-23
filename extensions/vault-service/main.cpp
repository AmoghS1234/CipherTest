#include "vault_service.hpp"
#include <iostream>
#include <cstring>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Native messaging protocol: 4-byte length (little-endian) followed by JSON message
std::string readNativeMessage() {
    // Read 4-byte length
    uint32_t length = 0;
    std::cin.read(reinterpret_cast<char*>(&length), 4);
    
    if (std::cin.eof() || length == 0 || length > 1024 * 1024) {
        return "";
    }
    
    // Read message
    std::string message(length, '\0');
    std::cin.read(&message[0], length);
    
    return message;
}

void writeNativeMessage(const std::string& message) {
    uint32_t length = message.length();
    std::cout.write(reinterpret_cast<const char*>(&length), 4);
    std::cout.write(message.c_str(), length);
    std::cout.flush();
}

int main() {
    // Disable buffering for immediate I/O
    std::cin.sync_with_stdio(false);
    std::cout.sync_with_stdio(false);
    
    VaultService service;
    
    std::cerr << "[Vault Service] Started" << std::endl;
    
    while (true) {
        std::string input = readNativeMessage();
        
        if (input.empty()) {
            std::cerr << "[Vault Service] Empty message or EOF, exiting" << std::endl;
            break;
        }
        
        try {
            json request = json::parse(input);
            std::cerr << "[Vault Service] Request: " << request["action"] << std::endl;
            
            json response = service.handleRequest(request);
            
            std::string responseStr = response.dump();
            writeNativeMessage(responseStr);
            
            std::cerr << "[Vault Service] Response sent: " << response["status"] << std::endl;
            
        } catch (const json::exception& e) {
            std::cerr << "[Vault Service] JSON error: " << e.what() << std::endl;
            
            json errorResponse;
            errorResponse["status"] = "error";
            errorResponse["error"] = std::string("JSON parse error: ") + e.what();
            
            writeNativeMessage(errorResponse.dump());
        } catch (const std::exception& e) {
            std::cerr << "[Vault Service] Error: " << e.what() << std::endl;
            
            json errorResponse;
            errorResponse["status"] = "error";
            errorResponse["error"] = e.what();
            
            writeNativeMessage(errorResponse.dump());
        }
    }
    
    std::cerr << "[Vault Service] Exiting" << std::endl;
    return 0;
}
