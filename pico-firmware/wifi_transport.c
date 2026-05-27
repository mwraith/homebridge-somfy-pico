#include "wifi_transport.h"
#include "rts_command.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "pico/stdlib.h"
#include "pico/cyw43_arch.h"
#include "hardware/flash.h"
#include "hardware/gpio.h"
#include "hardware/sync.h"
#include "hardware/watchdog.h"
#include "lwip/netif.h"
#include "lwip/tcp.h"
#include "lwip/apps/mdns.h"

// ── Flash credential storage ──────────────────────────────────────────────────

#define FLASH_TARGET_OFFSET  (PICO_FLASH_SIZE_BYTES - FLASH_SECTOR_SIZE)
#define CREDENTIALS_MAGIC    0x50494357u   // "PICW"

typedef struct {
    uint32_t magic;
    char ssid[64];
    char password[64];
} WifiCredentials;

static bool flash_read_credentials(WifiCredentials *out) {
    const WifiCredentials *stored =
        (const WifiCredentials *)(XIP_BASE + FLASH_TARGET_OFFSET);
    if (stored->magic != CREDENTIALS_MAGIC) return false;
    *out = *stored;
    return true;
}

static void flash_write_credentials(const char *ssid, const char *password) {
    WifiCredentials creds;
    memset(&creds, 0xff, sizeof(creds));
    creds.magic = CREDENTIALS_MAGIC;
    strncpy(creds.ssid,     ssid,     sizeof(creds.ssid)     - 1);
    strncpy(creds.password, password, sizeof(creds.password) - 1);

    uint8_t page[FLASH_PAGE_SIZE];
    memset(page, 0xff, sizeof(page));
    memcpy(page, &creds, sizeof(creds));

    uint32_t ints = save_and_disable_interrupts();
    flash_range_erase(FLASH_TARGET_OFFSET, FLASH_SECTOR_SIZE);
    flash_range_program(FLASH_TARGET_OFFSET, page, FLASH_PAGE_SIZE);
    restore_interrupts(ints);
}

// ── AP provisioning HTTP server ───────────────────────────────────────────────
// Called after cyw43_arch_init() has already succeeded.

#define AP_SSID    "somfy-pico-setup"
#define HTTP_PORT  80

static volatile bool credentials_saved = false;

static const char HTTP_FORM[] =
    "HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\n"
    "<!DOCTYPE html><html><head><title>Somfy Pico Setup</title>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<style>"
    "body{font-family:sans-serif;max-width:420px;margin:40px auto;padding:20px}"
    "label{display:block;margin:12px 0 4px}"
    "input{width:100%;padding:8px;box-sizing:border-box;font-size:16px}"
    "button{margin-top:16px;width:100%;padding:12px;"
    "background:#007aff;color:#fff;border:none;border-radius:8px;font-size:16px}"
    "</style></head><body>"
    "<h2>Somfy Pico Setup</h2>"
    "<p>Enter your WiFi credentials. The Pico will reboot as "
    "<strong>somfy-pico.local</strong>.</p>"
    "<form method='POST' action='/save'>"
    "<label>Network name (SSID)<input name='ssid' type='text' autocomplete='off'></label>"
    "<label>Password<input name='pass' type='password'></label>"
    "<button type='submit'>Save &amp; Connect</button>"
    "</form></body></html>";

static const char HTTP_SAVED[] =
    "HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\n"
    "<!DOCTYPE html><html><head><title>Saved</title></head><body>"
    "<h2>Credentials saved!</h2>"
    "<p>The Pico is rebooting. It will appear on your network as "
    "<strong>somfy-pico.local</strong> within a few seconds.</p>"
    "</body></html>";

static const char HTTP_ERR[] =
    "HTTP/1.0 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nBad Request";

typedef struct {
    char buf[512];
    int  len;
} HttpState;

static void url_decode(char *dst, const char *src, size_t dst_max) {
    size_t i = 0;
    while (*src && i < dst_max - 1) {
        if (*src == '%' && src[1] && src[2]) {
            char hex[3] = {src[1], src[2], 0};
            dst[i++] = (char)strtol(hex, NULL, 16);
            src += 3;
        } else if (*src == '+') {
            dst[i++] = ' ';
            src++;
        } else {
            dst[i++] = *src++;
        }
    }
    dst[i] = '\0';
}

static void parse_and_save_credentials(const char *body) {
    char ssid_enc[128] = {0}, pass_enc[128] = {0};
    char ssid[64] = {0}, pass[64] = {0};

    const char *p = strstr(body, "ssid=");
    if (p) {
        p += 5;
        size_t i = 0;
        while (*p && *p != '&' && i < sizeof(ssid_enc) - 1)
            ssid_enc[i++] = *p++;
    }
    p = strstr(body, "pass=");
    if (p) {
        p += 5;
        size_t i = 0;
        while (*p && *p != '&' && i < sizeof(pass_enc) - 1)
            pass_enc[i++] = *p++;
    }

    url_decode(ssid, ssid_enc, sizeof(ssid));
    url_decode(pass, pass_enc, sizeof(pass));

    if (ssid[0] != '\0') {
        flash_write_credentials(ssid, pass);
        credentials_saved = true;
    }
}

static void http_close(struct tcp_pcb *pcb, HttpState *hs) {
    tcp_arg(pcb, NULL);
    tcp_recv(pcb, NULL);
    tcp_err(pcb, NULL);
    tcp_close(pcb);
    free(hs);
}

static err_t http_recv(void *arg, struct tcp_pcb *pcb, struct pbuf *p, err_t err) {
    HttpState *hs = (HttpState *)arg;

    if (!p) { http_close(pcb, hs); return ERR_OK; }

    int copy = p->tot_len;
    if (hs->len + copy >= (int)sizeof(hs->buf) - 1)
        copy = (int)sizeof(hs->buf) - 1 - hs->len;
    pbuf_copy_partial(p, hs->buf + hs->len, copy, 0);
    hs->len += copy;
    hs->buf[hs->len] = '\0';
    tcp_recved(pcb, p->tot_len);
    pbuf_free(p);

    const char *hdr_end = strstr(hs->buf, "\r\n\r\n");
    if (!hdr_end) return ERR_OK;

    if (strncmp(hs->buf, "POST /save", 10) == 0) {
        parse_and_save_credentials(hdr_end + 4);
        tcp_write(pcb, HTTP_SAVED, sizeof(HTTP_SAVED) - 1, TCP_WRITE_FLAG_COPY);
    } else if (strncmp(hs->buf, "GET ", 4) == 0) {
        tcp_write(pcb, HTTP_FORM, sizeof(HTTP_FORM) - 1, TCP_WRITE_FLAG_COPY);
    } else {
        tcp_write(pcb, HTTP_ERR, sizeof(HTTP_ERR) - 1, TCP_WRITE_FLAG_COPY);
    }

    tcp_output(pcb);
    http_close(pcb, hs);
    return ERR_OK;
}

static err_t http_accept(void *arg, struct tcp_pcb *pcb, err_t err) {
    (void)arg; (void)err;
    HttpState *hs = (HttpState *)calloc(1, sizeof(HttpState));
    if (!hs) return ERR_MEM;
    tcp_arg(pcb, hs);
    tcp_recv(pcb, http_recv);
    tcp_err(pcb, NULL);
    return ERR_OK;
}

// CYW43 must already be initialised before calling this.
static void provision_run(void) {
    printf("No WiFi credentials found. Starting setup AP: %s\n", AP_SSID);
    printf("Connect your phone to '%s' and open http://192.168.4.1\n", AP_SSID);

    cyw43_arch_enable_ap_mode(AP_SSID, NULL, CYW43_AUTH_OPEN);

    cyw43_arch_lwip_begin();
    struct tcp_pcb *pcb = tcp_new_ip_type(IPADDR_TYPE_V4);
    tcp_bind(pcb, IP_ADDR_ANY, HTTP_PORT);
    pcb = tcp_listen(pcb);
    tcp_accept(pcb, http_accept);
    cyw43_arch_lwip_end();

    while (!credentials_saved) {
        cyw43_arch_poll();
        sleep_ms(1);
    }

    // Keep polling so the HTTP response flushes before reboot
    absolute_time_t flush_until = make_timeout_time_ms(1500);
    while (!time_reached(flush_until)) {
        cyw43_arch_poll();
        sleep_ms(1);
    }

    watchdog_reboot(0, 0, 100);
    while (1) tight_loop_contents();
}

// ── Command TCP server ────────────────────────────────────────────────────────

#define CMD_PORT  8765
#define HOSTNAME  "somfy-pico"

static volatile bool  command_pending     = false;
static uint32_t       pending_id;
static Button         pending_button;
static uint16_t       pending_rolling_code;
static int            pending_repetitions;
static struct tcp_pcb *response_pcb       = NULL;

typedef struct {
    char buf[64];
    int  len;
} CmdState;

static void cmd_close(struct tcp_pcb *pcb, CmdState *cs) {
    tcp_arg(pcb, NULL);
    tcp_recv(pcb, NULL);
    tcp_err(pcb, NULL);
    if (response_pcb == pcb) response_pcb = NULL;
    tcp_close(pcb);
    free(cs);
}

static err_t cmd_recv(void *arg, struct tcp_pcb *pcb, struct pbuf *p, err_t err) {
    CmdState *cs = (CmdState *)arg;

    if (!p) { cmd_close(pcb, cs); return ERR_OK; }

    int copy = p->tot_len;
    if (cs->len + copy >= (int)sizeof(cs->buf) - 1)
        copy = (int)sizeof(cs->buf) - 1 - cs->len;
    pbuf_copy_partial(p, cs->buf + cs->len, copy, 0);
    cs->len += copy;
    tcp_recved(pcb, p->tot_len);
    pbuf_free(p);

    char *nl;
    while ((nl = (char *)memchr(cs->buf, '\n', cs->len)) != NULL) {
        unsigned int id, button_code, rolling_code_raw;
        int repetitions;

        if (sscanf(cs->buf, "%u,%u,%u,%d", &id, &button_code,
                   &rolling_code_raw, &repetitions) == 4) {
            if (!command_pending) {
                pending_id           = id;
                pending_button       = (Button)button_code;
                pending_rolling_code = (uint16_t)rolling_code_raw;
                pending_repetitions  = repetitions;
                response_pcb         = pcb;
                command_pending      = true;
            }
        } else {
            tcp_write(pcb, "ERR\n", 4, TCP_WRITE_FLAG_COPY);
            tcp_output(pcb);
        }

        int consumed = (int)(nl - cs->buf) + 1;
        memmove(cs->buf, cs->buf + consumed, cs->len - consumed);
        cs->len -= consumed;
    }

    return ERR_OK;
}

static void cmd_err(void *arg, err_t err) {
    (void)err;
    if (arg) free(arg);
    response_pcb    = NULL;
    command_pending = false;
}

static err_t cmd_accept(void *arg, struct tcp_pcb *pcb, err_t err) {
    (void)arg; (void)err;
    CmdState *cs = (CmdState *)calloc(1, sizeof(CmdState));
    if (!cs) return ERR_MEM;
    tcp_arg(pcb, cs);
    tcp_recv(pcb, cmd_recv);
    tcp_err(pcb, cmd_err);
    return ERR_OK;
}

// ── Entry point ───────────────────────────────────────────────────────────────

void wifi_transport_run(void) {
    stdio_init_all();
    sleep_ms(2000);
    while (getchar_timeout_us(0) >= 0);  // flush USB enumeration bytes

    gpio_init(OUT_PIN);
    gpio_set_dir(OUT_PIN, GPIO_OUT);
    gpio_put(OUT_PIN, 0);

    bool wifi_active = false;

    if (cyw43_arch_init() == 0) {
        WifiCredentials creds;
        if (!flash_read_credentials(&creds)) {
            provision_run();  // reboots — never returns
        }

        cyw43_arch_enable_sta_mode();
        netif_set_hostname(netif_default, HOSTNAME);

        if (cyw43_arch_wifi_connect_timeout_ms(creds.ssid, creds.password,
                CYW43_AUTH_WPA2_AES_PSK, 30000) == 0) {
            cyw43_arch_lwip_begin();
            mdns_resp_init();
            mdns_resp_add_netif(netif_default, HOSTNAME);
            struct tcp_pcb *server_pcb = tcp_new_ip_type(IPADDR_TYPE_V4);
            tcp_bind(server_pcb, IP_ADDR_ANY, CMD_PORT);
            server_pcb = tcp_listen(server_pcb);
            tcp_accept(server_pcb, cmd_accept);
            cyw43_arch_lwip_end();
            wifi_active = true;
            printf("WiFi connected. Listening on somfy-pico.local:%d and USB serial.\n", CMD_PORT);
        } else {
            // Credentials present but connection failed (wrong password, network down, etc.)
            // Keep credentials — don't force re-provisioning. Fall back to serial.
            printf("WiFi connection failed. Running serial-only mode.\n");
            cyw43_arch_deinit();
        }
    }

    // ── Combined main loop ────────────────────────────────────────────────────
    // Serial is always active. TCP commands are also processed when wifi_active.

    char serial_buf[64];
    int  serial_len = 0;

    while (1) {
        if (wifi_active) cyw43_arch_poll();

        // Non-blocking serial: accumulate characters, process on newline
        int c;
        while ((c = getchar_timeout_us(0)) >= 0) {
            if (c == '\r') continue;
            if (c == '\n') {
                serial_buf[serial_len] = '\0';
                unsigned int id, button_code, rolling_code_raw;
                int repetitions;
                if (sscanf(serial_buf, "%u,%u,%u,%d",
                           &id, &button_code, &rolling_code_raw, &repetitions) == 4) {
                    sendCommand(id, (Button)button_code,
                                (uint16_t)rolling_code_raw, repetitions);
                    printf("OK\n");
                } else {
                    printf("ERR\n");
                }
                fflush(stdout);
                serial_len = 0;
                break;  // one command per loop tick
            } else if (serial_len < (int)sizeof(serial_buf) - 1) {
                serial_buf[serial_len++] = c;
            }
        }

        // TCP command — set by cmd_recv callback, processed here so sendCommand
        // runs from the main loop (not from an IRQ/lwIP callback context)
        if (wifi_active && command_pending) {
            command_pending = false;
            sendCommand(pending_id, pending_button,
                        pending_rolling_code, pending_repetitions);
            if (response_pcb) {
                cyw43_arch_lwip_begin();
                tcp_write(response_pcb, "OK\n", 3, TCP_WRITE_FLAG_COPY);
                tcp_output(response_pcb);
                cyw43_arch_lwip_end();
            }
        }

        sleep_ms(1);
    }
}
