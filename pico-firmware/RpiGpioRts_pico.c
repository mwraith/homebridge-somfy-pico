#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "pico/stdlib.h"
#include "hardware/gpio.h"

// The Raspberry Pi Pico's GPIO pin number linked to the 'data' pin of the RF emitter
#define OUT_PIN 4

// Button codes — must match the BUTTON enum in the homebridge plugin's SendCommand.js
typedef enum {
    MY   = 0x1,
    UP   = 0x2,
    DOWN = 0x4,
    PROG = 0x8
} Button;

// Structure for waveform pulses
typedef struct {
    uint32_t gpioOn;
    uint32_t gpioOff;
    uint32_t usDelay;
} Pulse;

// Function prototypes
void sendCommand(uint32_t id, Button button, uint16_t rollingCode, int repetitions);
uint8_t* getPayloadData(uint32_t id, Button button, uint16_t rollingCode);
Pulse* getWaveform(uint8_t* payloadData, int repetitions, int* waveformSize);

#ifndef UNIT_TEST
int main() {
    stdio_init_all();
    sleep_ms(2000);

    gpio_init(OUT_PIN);
    gpio_set_dir(OUT_PIN, GPIO_OUT);
    gpio_put(OUT_PIN, 0);

    // Flush any bytes that arrived during USB enumeration
    while (getchar_timeout_us(0) >= 0);

    while (1) {
        unsigned int id, buttonCode, rollingCode_raw;
        int repetitions;

        // scanf skips leading whitespace (including \r\n) and reads the four values
        if (scanf("%u,%u,%u,%d", &id, &buttonCode, &rollingCode_raw, &repetitions) == 4) {
            sendCommand(id, (Button)buttonCode, (uint16_t)rollingCode_raw, repetitions);
            printf("OK\n");
        } else {
            // Discard the rest of the malformed line
            int c;
            do { c = getchar(); } while (c != '\n' && c != '\r' && c != EOF);
            printf("ERR\n");
        }

        fflush(stdout);
    }

    return 0;
}
#endif /* UNIT_TEST */

void sendCommand(uint32_t id, Button button, uint16_t rollingCode, int repetitions) {
    uint8_t* payloadData = getPayloadData(id, button, rollingCode);
    int waveformSize;
    Pulse* waveform = getWaveform(payloadData, repetitions, &waveformSize);

    gpio_put(OUT_PIN, 0);

    for (int i = 0; i < waveformSize; i++) {
        if (waveform[i].gpioOn & (1 << OUT_PIN)) {
            gpio_put(OUT_PIN, 1);
        }
        if (waveform[i].gpioOff & (1 << OUT_PIN)) {
            gpio_put(OUT_PIN, 0);
        }
        busy_wait_us(waveform[i].usDelay);
    }

    free(payloadData);
    free(waveform);
}

uint8_t* getPayloadData(uint32_t id, Button button, uint16_t rollingCode) {
    uint8_t* frame = (uint8_t*)malloc(7 * sizeof(uint8_t));

    frame[0] = 0xA7;                    // Encryption key
    frame[1] = button << 4;             // Button pressed
    frame[2] = rollingCode >> 8;        // Rolling code (big endian)
    frame[3] = rollingCode & 0xFF;      // Rolling code
    frame[4] = id & 0xFF;               // Remote address (little endian)
    frame[5] = (id >> 8) & 0xFF;        // Remote address
    frame[6] = id >> 16;                // Remote address

    uint8_t checksum = 0;
    for (int i = 0; i < 7; i++) {
        checksum ^= frame[i] ^ (frame[i] >> 4);
    }
    checksum &= 0b1111;
    frame[1] |= checksum;

    for (int i = 1; i < 7; i++) {
        frame[i] ^= frame[i - 1];
    }

    return frame;
}

Pulse* getWaveform(uint8_t* payloadData, int repetitions, int* waveformSize) {
    int size = 2;
    for (int j = 0; j < repetitions; j++) {
        int loops = (j == 0) ? 2 : 7;
        size += loops * 2;  // hardware sync
        size += 2;          // software sync
        size += 56 * 2;     // manchester encoding
        size += 1;          // interframe gap
    }
    Pulse* wf = (Pulse*)malloc(size * sizeof(Pulse));
    int idx = 0;

    // Wake up pulse + silence
    wf[idx++] = (Pulse){1 << OUT_PIN, 0, 9415};
    wf[idx++] = (Pulse){0, 1 << OUT_PIN, 89565};

    for (int j = 0; j < repetitions; j++) {
        // Hardware synchronization
        int loops = (j == 0) ? 2 : 7;
        for (int i = 0; i < loops; i++) {
            wf[idx++] = (Pulse){1 << OUT_PIN, 0, 2560};
            wf[idx++] = (Pulse){0, 1 << OUT_PIN, 2560};
        }

        // Software synchronization
        wf[idx++] = (Pulse){1 << OUT_PIN, 0, 4550};
        wf[idx++] = (Pulse){0, 1 << OUT_PIN, 640};

        // Manchester encoding of payload data
        for (int i = 0; i < 56; i++) {
            int bit = (payloadData[i / 8] >> (7 - (i % 8))) & 1;
            if (bit) {
                wf[idx++] = (Pulse){0, 1 << OUT_PIN, 640};
                wf[idx++] = (Pulse){1 << OUT_PIN, 0, 640};
            } else {
                wf[idx++] = (Pulse){1 << OUT_PIN, 0, 640};
                wf[idx++] = (Pulse){0, 1 << OUT_PIN, 640};
            }
        }

        // Interframe gap
        wf[idx++] = (Pulse){0, 1 << OUT_PIN, 30415};
    }

    *waveformSize = idx;
    return wf;
}
