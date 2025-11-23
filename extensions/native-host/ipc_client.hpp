#pragma once

#include <nlohmann/json.hpp>
#include <string>

using json = nlohmann::json;

class IPCClient {
public:
    IPCClient();
    ~IPCClient();
    
    bool connect();
    void disconnect();
    json sendMessage(const json& message);
    
private:
    int sockfd;
    bool connected;
    
    std::string getSocketPath();
};
