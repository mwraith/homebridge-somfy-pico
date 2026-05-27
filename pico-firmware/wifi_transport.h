#ifndef WIFI_TRANSPORT_H
#define WIFI_TRANSPORT_H

// Entry point for WiFi mode. Handles first-boot AP provisioning then
// switches to station mode and serves commands over TCP. Never returns.
void wifi_transport_run(void);

#endif
