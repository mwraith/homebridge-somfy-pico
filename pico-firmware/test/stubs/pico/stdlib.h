#pragma once
#include <stdint.h>

static inline void stdio_init_all(void) {}
static inline void sleep_ms(uint32_t ms) {}

void busy_wait_us(uint32_t us);
