cmake_minimum_required(VERSION 3.16)

project(CipherMeshNativeHost VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(nlohmann_json 3.2.0 REQUIRED)

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

# Install
install(TARGETS ciphermesh-native-host
    RUNTIME DESTINATION bin
)

# Install native messaging manifests
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/com.ciphermesh.native.json.in
    ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json
    @ONLY
)

install(FILES ${CMAKE_CURRENT_BINARY_DIR}/com.ciphermesh.native.json
    DESTINATION share/ciphermesh/native-messaging
)
