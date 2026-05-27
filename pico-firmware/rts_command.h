#ifndef RTS_COMMAND_H
#define RTS_COMMAND_H

#include <stdint.h>

#define OUT_PIN 4

typedef enum {
    MY   = 0x1,
    UP   = 0x2,
    DOWN = 0x4,
    PROG = 0x8
} Button;

void sendCommand(uint32_t id, Button button, uint16_t rollingCode, int repetitions);

#endif
