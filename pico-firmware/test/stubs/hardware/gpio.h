#pragma once
#include <stdint.h>

#define GPIO_OUT 1

void gpio_init(uint32_t pin);
void gpio_set_dir(uint32_t pin, int dir);
void gpio_put(uint32_t pin, int value);
