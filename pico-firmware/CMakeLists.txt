cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(RpiGpioRts_Pico C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(RpiGpioRts_Pico RpiGpioRts_pico.c)

pico_enable_stdio_usb(RpiGpioRts_Pico 1)
pico_enable_stdio_uart(RpiGpioRts_Pico 1)

pico_add_extra_outputs(RpiGpioRts_Pico)

target_compile_definitions(RpiGpioRts_Pico PRIVATE
    USBD_MANUFACTURER="homebridge-somfy-pico"
)

target_link_libraries(RpiGpioRts_Pico pico_stdlib hardware_gpio)