cmake_minimum_required(VERSION 3.16)

# Find Qt6 packages
find_package(Qt6 REQUIRED COMPONENTS Core Network)

# Enable Qt MOC
set(CMAKE_AUTOMOC ON)

add_library(ipc
    ipc_server.cpp
    ipc_server.hpp
)

target_include_directories(ipc 
    PUBLIC 
    ${CMAKE_CURRENT_SOURCE_DIR}
    PRIVATE
    ${CMAKE_SOURCE_DIR}/src/core
)

target_link_libraries(ipc
    PUBLIC
    Qt6::Core
    Qt6::Network
    nlohmann_json::nlohmann_json
    ciphermesh-core
)
