cmake_minimum_required(VERSION 3.13)
project(RpiGpioRts_test C)
set(CMAKE_C_STANDARD 11)

include(FetchContent)
FetchContent_Declare(unity
    GIT_REPOSITORY https://github.com/ThrowTheSwitch/Unity.git
    GIT_TAG v2.6.0
)
FetchContent_MakeAvailable(unity)

add_executable(test_RpiGpioRts test_RpiGpioRts.c)
target_include_directories(test_RpiGpioRts PRIVATE stubs)
target_link_libraries(test_RpiGpioRts unity)

enable_testing()
add_test(NAME test_RpiGpioRts COMMAND test_RpiGpioRts)
