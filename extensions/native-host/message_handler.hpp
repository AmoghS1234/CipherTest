#pragma once

#include <nlohmann/json.hpp>
#include <string>

using json = nlohmann::json;

class MessageHandler {
public:
    MessageHandler();
    ~MessageHandler();
    
    json handleMessage(const json& request);
    
private:
    json handlePing(const json& request);
    json handleGetCredentials(const json& request);
    json handleSaveCredentials(const json& request);
    json handleVerifyMasterPassword(const json& request);
    json handleListGroups(const json& request);
    
    json createErrorResponse(int requestId, const std::string& error);
    json createSuccessResponse(int requestId, const json& data);
};
