cmake_minimum_required(VERSION 3.16)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Native messaging host executable
add_executable(ciphermesh-native-host
    main.cpp
    message_handler.cpp
    ipc_client.cpp
)

target_link_libraries(ciphermesh-native-host
    PRIVATE
    nlohmann_json::nlohmann_json
)

# Configure manifest with build directory path for development use
set(NATIVE_HOST_PATH "${CMAKE_CURRENT_BINARY_DIR}/ciphermesh-native-host")
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/com.ciphermesh.native.json.in
    ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json.dev
    @ONLY
)

# Configure manifest with install prefix for system installation
set(NATIVE_HOST_PATH "${CMAKE_INSTALL_PREFIX}/bin/ciphermesh-native-host")
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/com.ciphermesh.native.json.in
    ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json
    @ONLY
)

# Automatically copy development manifest to Firefox native messaging directory after build
add_custom_command(TARGET ciphermesh-native-host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.mozilla/native-messaging-hosts"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json.dev"
        "$ENV{HOME}/.mozilla/native-messaging-hosts/com.ciphermesh.native.json"
    COMMENT "Installing native messaging manifest for Firefox (development)"
)

# Also copy to Chrome/Chromium directories if they exist
add_custom_command(TARGET ciphermesh-native-host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.config/google-chrome/NativeMessagingHosts"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json.dev"
        "$ENV{HOME}/.config/google-chrome/NativeMessagingHosts/com.ciphermesh.native.json"
    COMMENT "Installing native messaging manifest for Chrome (development)"
    COMMAND_EXPAND_LISTS
)

add_custom_command(TARGET ciphermesh-native-host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "$ENV{HOME}/.config/chromium/NativeMessagingHosts"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json.dev"
        "$ENV{HOME}/.config/chromium/NativeMessagingHosts/com.ciphermesh.native.json"
    COMMENT "Installing native messaging manifest for Chromium (development)"
    COMMAND_EXPAND_LISTS
)

# Install for system-wide use
install(TARGETS ciphermesh-native-host
    RUNTIME DESTINATION bin
)

install(FILES ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json
    DESTINATION share/ciphermesh/native-messaging
)
