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
            
            // Extract requestId if present (native-host protocol compatibility)
            int requestId = request.value("requestId", -1);
            
            std::string action = request.value("action", request.value("type", ""));
            std::cerr << "[Vault Service] Request: " << action;
            if (requestId != -1) {
                std::cerr << " (requestId: " << requestId << ")";
            }
            std::cerr << std::endl;
            
            json serviceResponse = service.handleRequest(request);
            
            // Convert to native-host format if requestId is present
            json response;
            if (requestId != -1) {
                // Native-host protocol format
                response["requestId"] = requestId;
                if (serviceResponse["status"] == "success") {
                    response["success"] = true;
                    // Extract data fields
                    json data;
                    if (serviceResponse.contains("verified")) {
                        data["verified"] = serviceResponse["verified"];
                    }
                    if (serviceResponse.contains("entries")) {
                        data["entries"] = serviceResponse["entries"];
                    }
                    if (serviceResponse.contains("groups")) {
                        data["groups"] = serviceResponse["groups"];
                    }
                    if (serviceResponse.contains("username")) {
                        data["username"] = serviceResponse["username"];
                        data["password"] = serviceResponse["password"];
                        data["title"] = serviceResponse.value("title", "");
                    }
                    if (serviceResponse.contains("saved")) {
                        data["saved"] = serviceResponse["saved"];
                    }
                    response["data"] = data;
                } else {
                    response["success"] = false;
                    response["error"] = serviceResponse.value("error", "Unknown error");
                }
            } else {
                // Original vault-service format
                response = serviceResponse;
            }
            
            std::string responseStr = response.dump();
            writeNativeMessage(responseStr);
            
            std::cerr << "[Vault Service] Response sent: " << (response.contains("success") ? (response["success"].get<bool>() ? "success" : "error") : serviceResponse["status"].get<std::string>()) << std::endl;
            
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
