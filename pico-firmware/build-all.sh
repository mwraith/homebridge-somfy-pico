#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_PATH="$SCRIPT_DIR/pico-sdk"
DIST_DIR="$SCRIPT_DIR/dist"
BOARDS=(pico pico_w pico2 pico2_w)

if [ ! -f "$SDK_PATH/CMakeLists.txt" ]; then
    echo "Error: pico-sdk submodule not initialised."
    echo "Run: git submodule update --init --recursive"
    exit 1
fi

mkdir -p "$DIST_DIR"

for BOARD in "${BOARDS[@]}"; do
    echo "==> Building for $BOARD..."
    BUILD_DIR="$SCRIPT_DIR/build/$BOARD"
    mkdir -p "$BUILD_DIR"
    cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR" \
        -DPICO_BOARD="$BOARD" \
        -DPICO_SDK_PATH="$SDK_PATH" \
        -DCMAKE_BUILD_TYPE=Release \
        --log-level=WARNING \
        -Wno-dev
    cmake --build "$BUILD_DIR" --parallel
    cp "$BUILD_DIR/RpiGpioRts_Pico.uf2" "$DIST_DIR/RpiGpioRts_Pico-${BOARD}.uf2"
    echo "    -> dist/RpiGpioRts_Pico-${BOARD}.uf2"
done

echo ""
echo "Done. UF2 files written to pico-firmware/dist/"
