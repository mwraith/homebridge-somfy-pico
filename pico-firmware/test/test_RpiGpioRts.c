#define UNIT_TEST

#include <stdint.h>
#include <string.h>
#include "unity.h"

/* -------------------------------------------------------------------------
 * Stub implementations for Pico SDK functions (declarations come from the
 * stub headers on the include path, which replace pico/stdlib.h and
 * hardware/gpio.h at compile time).
 * --------------------------------------------------------------------- */

typedef struct {
    uint32_t pin;
    int      value;
} GpioCall;

#define MAX_GPIO_CALLS 4096
static GpioCall gpio_calls[MAX_GPIO_CALLS];
static int      gpio_call_count = 0;

void gpio_init(uint32_t pin)              { (void)pin; }
void gpio_set_dir(uint32_t pin, int dir)  { (void)pin; (void)dir; }

void gpio_put(uint32_t pin, int value) {
    if (gpio_call_count < MAX_GPIO_CALLS) {
        gpio_calls[gpio_call_count].pin   = pin;
        gpio_calls[gpio_call_count].value = value;
        gpio_call_count++;
    }
}

void busy_wait_us(uint32_t us) { (void)us; }

/* -------------------------------------------------------------------------
 * Pull in the source under test.  The stub headers above (resolved via the
 * -I stubs flag in CMakeLists.txt) satisfy its #include "pico/stdlib.h" and
 * #include "hardware/gpio.h" dependencies without the Pico SDK.
 * --------------------------------------------------------------------- */
#include "../RpiGpioRts_pico.c"

/* -------------------------------------------------------------------------
 * Helper: reverse the XOR-obfuscation applied by getPayloadData so that
 * assertions can be made against plaintext frame bytes.
 *   out[0] = frame[0]
 *   out[i] = frame[i] ^ frame[i-1]   for i = 1..6
 * --------------------------------------------------------------------- */
static void deobfuscate(const uint8_t *frame, uint8_t *out) {
    out[0] = frame[0];
    for (int i = 1; i < 7; i++) {
        out[i] = frame[i] ^ frame[i - 1];
    }
}

/* -------------------------------------------------------------------------
 * Unity fixtures
 * --------------------------------------------------------------------- */
void setUp(void) {
    gpio_call_count = 0;
}

void tearDown(void) {}

/* =========================================================================
 * Tests for getPayloadData
 * ===================================================================== */

void test_payload_encryption_key_is_always_0xA7(void) {
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    TEST_ASSERT_EQUAL_HEX8(0xA7, frame[0]);
    free(frame);
}

void test_payload_button_in_upper_nibble(void) {
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    uint8_t plain[7];
    deobfuscate(frame, plain);
    /* Button UP == 0x2; stored in the upper nibble of plain[1] */
    TEST_ASSERT_EQUAL_HEX8(UP, plain[1] >> 4);
    free(frame);
}

void test_payload_rolling_code_big_endian(void) {
    uint16_t rollingCode = 0x0102;
    uint8_t *frame = getPayloadData(0x010203, UP, rollingCode);
    uint8_t plain[7];
    deobfuscate(frame, plain);
    TEST_ASSERT_EQUAL_HEX8(0x01, plain[2]); /* high byte */
    TEST_ASSERT_EQUAL_HEX8(0x02, plain[3]); /* low byte  */
    free(frame);
}

void test_payload_id_little_endian(void) {
    uint32_t id = 0x010203;
    uint8_t *frame = getPayloadData(id, UP, 0x0001);
    uint8_t plain[7];
    deobfuscate(frame, plain);
    TEST_ASSERT_EQUAL_HEX8(0x03, plain[4]); /* id & 0xFF       */
    TEST_ASSERT_EQUAL_HEX8(0x02, plain[5]); /* (id >> 8) & 0xFF */
    TEST_ASSERT_EQUAL_HEX8(0x01, plain[6]); /* id >> 16         */
    free(frame);
}

void test_payload_known_output(void) {
    /* Pre-computed for id=0x010203, button=UP, rollingCode=0x0001 */
    const uint8_t expected[7] = {0xA7, 0x89, 0x89, 0x88, 0x8B, 0x89, 0x88};
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    TEST_ASSERT_EQUAL_HEX8_ARRAY(expected, frame, 7);
    free(frame);
}

void test_payload_checksum_valid(void) {
    uint8_t *frame = getPayloadData(0xABCDEF, DOWN, 0x1234);
    uint8_t plain[7];
    deobfuscate(frame, plain);
    /* After deobfuscation the checksum nibble satisfies:
     * XOR of every (byte ^ byte>>4) across the full frame == 0 (mod 16) */
    uint8_t acc = 0;
    for (int i = 0; i < 7; i++) {
        acc ^= plain[i] ^ (plain[i] >> 4);
    }
    TEST_ASSERT_EQUAL_HEX8(0, acc & 0x0F);
    free(frame);
}

/* =========================================================================
 * Tests for getWaveform
 * ===================================================================== */

void test_waveform_size_one_repetition(void) {
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    int size = 0;
    Pulse *wf = getWaveform(frame, 1, &size);
    TEST_ASSERT_EQUAL_INT(121, size);
    free(frame);
    free(wf);
}

void test_waveform_size_four_repetitions(void) {
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    int size = 0;
    Pulse *wf = getWaveform(frame, 4, &size);
    TEST_ASSERT_EQUAL_INT(508, size);
    free(frame);
    free(wf);
}

void test_waveform_starts_with_wake_pulse(void) {
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    int size = 0;
    Pulse *wf = getWaveform(frame, 1, &size);
    TEST_ASSERT_EQUAL_UINT32((uint32_t)(1 << OUT_PIN), wf[0].gpioOn);
    TEST_ASSERT_EQUAL_UINT32(0,                        wf[0].gpioOff);
    TEST_ASSERT_EQUAL_UINT32(9415,                     wf[0].usDelay);
    free(frame);
    free(wf);
}

void test_waveform_second_pulse_is_silence(void) {
    uint8_t *frame = getPayloadData(0x010203, UP, 0x0001);
    int size = 0;
    Pulse *wf = getWaveform(frame, 1, &size);
    TEST_ASSERT_EQUAL_UINT32(0,                        wf[1].gpioOn);
    TEST_ASSERT_EQUAL_UINT32((uint32_t)(1 << OUT_PIN), wf[1].gpioOff);
    TEST_ASSERT_EQUAL_UINT32(89565,                    wf[1].usDelay);
    free(frame);
    free(wf);
}

/* =========================================================================
 * Tests for sendCommand
 * ===================================================================== */

void test_sendCommand_drives_gpio_low_first(void) {
    sendCommand(0x010203, UP, 0x0001, 1);
    TEST_ASSERT_EQUAL_UINT32(OUT_PIN, gpio_calls[0].pin);
    TEST_ASSERT_EQUAL_INT(0,          gpio_calls[0].value);
}

void test_sendCommand_makes_gpio_calls(void) {
    sendCommand(0x010203, UP, 0x0001, 1);
    TEST_ASSERT_GREATER_THAN_INT(10, gpio_call_count);
}

/* =========================================================================
 * Entry point
 * ===================================================================== */

int main(void) {
    UNITY_BEGIN();

    /* getPayloadData */
    RUN_TEST(test_payload_encryption_key_is_always_0xA7);
    RUN_TEST(test_payload_button_in_upper_nibble);
    RUN_TEST(test_payload_rolling_code_big_endian);
    RUN_TEST(test_payload_id_little_endian);
    RUN_TEST(test_payload_known_output);
    RUN_TEST(test_payload_checksum_valid);

    /* getWaveform */
    RUN_TEST(test_waveform_size_one_repetition);
    RUN_TEST(test_waveform_size_four_repetitions);
    RUN_TEST(test_waveform_starts_with_wake_pulse);
    RUN_TEST(test_waveform_second_pulse_is_silence);

    /* sendCommand */
    RUN_TEST(test_sendCommand_drives_gpio_low_first);
    RUN_TEST(test_sendCommand_makes_gpio_calls);

    return UNITY_END();
}
