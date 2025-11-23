#pragma once

#include <QObject>
#include <QLocalServer>
#include <QLocalSocket>
#include <QString>
#include <QByteArray>
#include <QMap>
#include <functional>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

namespace CipherMesh {
namespace Core {
    class Vault;
}
}

namespace CipherMesh {
namespace IPC {

class IPCServer : public QObject {
    Q_OBJECT

public:
    explicit IPCServer(CipherMesh::Core::Vault* vault, QObject* parent = nullptr);
    ~IPCServer();
    
    bool start();
    void stop();
    bool isRunning() const;
    
    QString getSocketPath() const;

private slots:
    void onNewConnection();
    void onReadyRead();
    void onDisconnected();

private:
    QByteArray handleMessage(const QByteArray& message);
    json processRequest(const json& request);
    
    // Message handlers
    json handlePing(const json& request);
    json handleGetCredentials(const json& request);
    json handleSaveCredentials(const json& request);
    json handleVerifyMasterPassword(const json& request);
    json handleListGroups(const json& request);
    
    json createErrorResponse(const std::string& error);
    json createSuccessResponse(const json& data);
    
    QLocalServer* m_server;
    CipherMesh::Core::Vault* m_vault;
    QString m_socketPath;
    QMap<QLocalSocket*, QByteArray> m_clientBuffers;
};

} // namespace IPC
} // namespace CipherMesh
