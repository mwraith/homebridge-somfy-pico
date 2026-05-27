cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(RpiGpioRts_Pico C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

# ── Serial (USB) target — all boards ─────────────────────────────────────────

add_executable(RpiGpioRts_Pico RpiGpioRts_pico.c)

pico_enable_stdio_usb(RpiGpioRts_Pico 1)
pico_enable_stdio_uart(RpiGpioRts_Pico 1)

pico_add_extra_outputs(RpiGpioRts_Pico)

target_compile_definitions(RpiGpioRts_Pico PRIVATE
    USBD_MANUFACTURER="homebridge-somfy-pi"
)

target_link_libraries(RpiGpioRts_Pico pico_stdlib hardware_gpio)

# ── WiFi target — pico_w and pico2_w only ────────────────────────────────────

if(PICO_CYW43_SUPPORTED)
    add_executable(RpiGpioRts_Pico_WiFi
        RpiGpioRts_pico.c
        wifi_transport.c
    )

    # USB serial stays active — WiFi is additive when credentials are stored
    pico_enable_stdio_usb(RpiGpioRts_Pico_WiFi 1)
    pico_enable_stdio_uart(RpiGpioRts_Pico_WiFi 0)

    target_compile_definitions(RpiGpioRts_Pico_WiFi PRIVATE
        WIFI_TRANSPORT=1
    )

    # lwipopts.h must be on the include path
    target_include_directories(RpiGpioRts_Pico_WiFi PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

    target_link_libraries(RpiGpioRts_Pico_WiFi
        pico_stdlib
        hardware_gpio
        hardware_flash
        hardware_sync
        hardware_watchdog
        pico_cyw43_arch_lwip_threadsafe_background
        pico_lwip_mdns
    )

    pico_add_extra_outputs(RpiGpioRts_Pico_WiFi)
endif()
