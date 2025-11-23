add_library(ipc
    ipc_server.cpp
)

target_include_directories(ipc PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

target_link_libraries(ipc
    PUBLIC
    Qt6::Core
    Qt6::Network
    nlohmann_json::nlohmann_json
)
