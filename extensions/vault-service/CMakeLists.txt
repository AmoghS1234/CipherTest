cmake_minimum_required(VERSION 3.15)

# Find nlohmann_json (should already be available from main project)
find_package(nlohmann_json REQUIRED)

# Vault service executable
add_executable(ciphermesh-vault-service
    main.cpp
    vault_service.cpp
)

target_link_libraries(ciphermesh-vault-service
    PRIVATE
    ciphermesh-core
    nlohmann_json::nlohmann_json
)

target_include_directories(ciphermesh-vault-service
    PRIVATE
    ${CMAKE_SOURCE_DIR}/src/core
)

# Install vault service
install(TARGETS ciphermesh-vault-service
    RUNTIME DESTINATION bin
)

# Generate wrapper script that runs vault service from build directory
set(VAULT_SERVICE_PATH "${CMAKE_CURRENT_BINARY_DIR}/ciphermesh-vault-service")
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/ciphermesh-vault-service-wrapper.sh.in
    ${CMAKE_CURRENT_BINARY_DIR}/ciphermesh-vault-service-wrapper.sh
    @ONLY
)

# Make wrapper executable
add_custom_command(TARGET ciphermesh-vault-service POST_BUILD
    COMMAND chmod +x "${CMAKE_CURRENT_BINARY_DIR}/ciphermesh-vault-service-wrapper.sh"
    COMMENT "Making vault service wrapper executable"
)

# Generate native messaging manifest pointing to wrapper
set(VAULT_SERVICE_WRAPPER_PATH "${CMAKE_CURRENT_BINARY_DIR}/ciphermesh-vault-service-wrapper.sh")
set(VAULT_SERVICE_INSTALL_PATH "${CMAKE_INSTALL_PREFIX}/bin/ciphermesh-vault-service")

# Template for installed version (points to installed executable)
set(VAULT_SERVICE_PATH ${VAULT_SERVICE_INSTALL_PATH})
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/com.ciphermesh.vault.json.in
    ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.vault.json.install
    @ONLY
)

# Template for development version (points to wrapper script)
set(VAULT_SERVICE_PATH ${VAULT_SERVICE_WRAPPER_PATH})
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/com.ciphermesh.vault.json.in
    ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.vault.json
    @ONLY
)

# Install manifest
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.vault.json.install
    DESTINATION share/ciphermesh/native-messaging
    RENAME com.ciphermesh.vault.json
)

# Auto-install development manifests to browser directories
add_custom_command(TARGET ciphermesh-vault-service POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.mozilla/native-messaging-hosts"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.vault.json"
        "$ENV{HOME}/.mozilla/native-messaging-hosts/com.ciphermesh.vault.json"
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.config/google-chrome/NativeMessagingHosts"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.vault.json"
        "$ENV{HOME}/.config/google-chrome/NativeMessagingHosts/com.ciphermesh.vault.json"
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.config/chromium/NativeMessagingHosts"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.vault.json"
        "$ENV{HOME}/.config/chromium/NativeMessagingHosts/com.ciphermesh.vault.json"
    COMMENT "Installing vault service native messaging manifests for development"
)
