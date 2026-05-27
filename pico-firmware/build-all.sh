#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_PATH="$SCRIPT_DIR/pico-sdk"
BUILD_DIR="$SCRIPT_DIR/build"
DIST_DIR="$SCRIPT_DIR/dist"
BOARDS=(pico pico_w pico2 pico2_w)
WIFI_BOARDS=(pico_w pico2_w)

if [ ! -f "$SDK_PATH/CMakeLists.txt" ]; then
    echo "Error: pico-sdk submodule not initialised."
    echo "Run: git submodule update --init --recursive"
    exit 1
fi

mkdir -p "$BUILD_DIR"

for BOARD in "${BOARDS[@]}"; do
    echo "==> Building for $BOARD..."
    BOARD_BUILD_DIR="$BUILD_DIR/$BOARD"
    mkdir -p "$BOARD_BUILD_DIR"
    cmake -S "$SCRIPT_DIR" -B "$BOARD_BUILD_DIR" \
        -DPICO_BOARD="$BOARD" \
        -DPICO_SDK_PATH="$SDK_PATH" \
        -DCMAKE_BUILD_TYPE=Release \
        --log-level=WARNING \
        -Wno-dev
    cmake --build "$BOARD_BUILD_DIR" --parallel
done

echo "==> Collecting UF2 files..."
mkdir -p "$DIST_DIR"

for BOARD in "${BOARDS[@]}"; do
    BOARD_BUILD_DIR="$BUILD_DIR/$BOARD"
    is_wifi=false
    for WB in "${WIFI_BOARDS[@]}"; do
        [ "$BOARD" = "$WB" ] && is_wifi=true && break
    done

    if $is_wifi; then
        # WiFi-capable board: ship the combined serial+WiFi firmware
        UF2=$(find "$BOARD_BUILD_DIR" -maxdepth 1 -name "RpiGpioRts_Pico_WiFi.uf2" | head -1)
    else
        UF2=$(find "$BOARD_BUILD_DIR" -maxdepth 1 -name "RpiGpioRts_Pico.uf2" | head -1)
    fi

    cp "$UF2" "$DIST_DIR/firmware_${BOARD}.uf2"
    echo "    -> dist/firmware_${BOARD}.uf2"
done

echo ""
echo "Done. UF2 files written to pico-firmware/dist/"
echo ""
echo "  pico / pico2         : USB serial only"
echo "  pico_w / pico2_w     : USB serial always + WiFi when credentials stored"
echo "  WiFi first-boot setup: power on, connect to 'somfy-pico-setup', open http://192.168.4.1"
