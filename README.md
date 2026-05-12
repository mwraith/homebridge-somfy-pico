# homebridge-somfy-pico
A Homebridge plugin to control any device with the Somfy RTS technology with a Raspberry Pi Pico connected to a simple 433 MHz transmitter. Optimised for Homebridge v2

A [Homebridge](https://github.com/homebridge/homebridge) plugin to add HomeKit compatibility to Somfy RTS devices (rolling shutters, blinds, awnings, ...) using a Raspberry Pi Pico with a simple 433 MHz transmitter. This is the successor to the [homebridge-somfi-blinds](https://github.com/mwraith/homebridge-somfi-blinds) plugin and uses a Raspberry Pi Pico rather than a Raspberry Pi 4.

## Advantages to this newer version
The previous version used a Raspberry Pi 4 with a transmitter connected to the GPIO pins, where-as this version uses a Raspberry Pi Pico and transmitter. There are several advantages:
- The Pico can can be connected via USB to any device running Homebridge. You are not limited to using a Raspberry Pi for the server.
- You can use a Raspberry Pi 5 as the server. This was not possible with the previous plugin, as Pi 5 switched to a software based RP1 I/O controller that did not support the low latency ability required for RF signal generation.
- You no longer need Homebridge to run as root (also needed for GPIO access). A standard installation suffices.
- It has been upgraded to support running as a Child Bridge thus improving stability.

## Hardware Setup
Somfy RTS uses a frequency of 433.42 MHz instead of the usual 433.92 MHz, which requires you to replace the resonator on the standard transmitter.

### Parts
- Raspberry Pi Pico with header and USB cable (any version should work)
- 433 MHz RF transmitter ([example](https://i.pinimg.com/474x/cb/47/a8/cb47a81619e16eb344d89ee03a382dc1.jpg))
- 433.42 MHz saw resonator ([example](https://www.ebay.com/sch/i.html?_nkw=433.42+resonator))
- antenna (my transmitter cam with one, but any wire should work)
- Pico PCB - Technically you only need 3 female to female jumper wires ([example](https://www.ebay.com/sch/i.html?_nkw=female+to+female+jumper+wire)), but for a tidy finish buy a PCB ([Pico Proto PCB](https://thepihut.com/products/pico-proto-pcb)) and [jumper wire kit](https://thepihut.com/products/jumper-wire-kit-140-piece)

### Modification of the Transmitter
1. Remove the original resonator by pulling it while heating its 3 pins with a soldering iron
2. Clean the remaining solder
3. Solder the 433.42 MHz resonator instead
4. Solder the antenna to the ANT pad

### Connection to the Raspberry Pi
Connect the transmitter to the Raspberry Pi Pico:
- Transmitter GND to Raspberry Pi GND
- Transmitter VCC to Raspberry Pi +5V
- Transmitter ATAD (DATA) to Raspberry Pi GPIO 4 (Pin 6)

### Installing the firmware onto the Pico
There is a Boot Selection button on the Raspberry Pi Pico that allows you to flash the firmware of the device. Hold this button whilst you plug it into a USB port. You should see that the device is automatically mounted as a USB drive. Once mounted copy the [UF2 file](pico-firmware/build) corresponding to the version of your Pico device. After the transfer completes, the device resets automatically and should be running in application mode (mounted under `/etc/` but no longer visible as a drive).

### Installing the Homebridge Plugin
This plugin works with a standard Homebridge install. Simply install `homebridge-somfy-pico` from the **Plugins** menu and make sure the Pico is connected via USB to the server.

## Configuration

### Upgrading from the homebridge-somfi-blinds plugin
For those who are upgrading the configuration options are identical to those of the [homebridge-somfi-blinds](https://github.com/mwraith/homebridge-somfi-blinds) plugin. It's easiest to use the **JSON Config** viewer in Homebridge and to cut and paste the relevant JSON for the devices (exclude the `accessory` tag that is no longer required). The state files that store the current position of the blind and the rolling code use identical format to the old plugin so there is no needed to change. Just remember to disable the old plugin once configured.


### Overview for new installations
Each Somfy device listens to a list of remotes that were previously registered on this device.

The remotes send 3 values:
- Its unique ID
- A rolling code that is incremented each time a button is pressed on the remote
- A command: Up, Down, My, Prog

When a device receives a signal it does the following:
- It verifies that the unique ID of the remote is in the list of its registered remotes
- It verifies that the rolling code is the same or very close to the one it knows for this remote ID
- It increments the rolling code for this remote ID (so it keeps the same value than the one stored on the remote)
- It performs the command (move up, down, ...)

A same remote can even be registered on many devices (intentionally or inadvertently), and thus control simultaneoulsy many devices.


### Platform Configuration (recommended as it supports Child Bridge)
Go to **Homebridge Config UI**, open the **Plugins** tab, and click **Plugin Config** under *Homebridge Somfy Pico*.  

Add your blinds under the **Devices** list. Each device entry is equivalent to a virtual Somfy RTS remote. Each device must have a unique `id`.

Alternatively, edit your `config.json` and add the following block inside the **platforms** array:

```json
{
    "name": "Somfy Blinds Pico",
    "devices": [
        {
            "id": 12345,
            "name": "Living Room Blind",
            "adminMode": true
        },
        {
            "id": 67890,
            "name": "Kitchen Blind",
            "adminMode": false
        }
    ]
}
```


### Configuration Options
Configuration settings below are supported for both platform and accessory modes:
- `name` is the name of the accessory as it will appear in HomeKit (required)
- `id` is the unique ID of the virtual Somfy RTS remote to choose between 0 and 16777216 (required)
- `adminMode` is used for programming the blind. When set to true Homebridge will shows four stateless buttons (Up, Down, My, Prog) and when false it shows only a single stateful device
- `invertToggle` is used for blinds that extend upwards where the Up command actually closes the blind
- `repetitions` is an optional parameter that states how many times the signal should be sent. Sending multiple times may improve reception, however if the number is too large some blinds may detect it as a long button press, which only moves the blinds one step (Default = 4)
- `openToMyPosition` should be enabled for venetian blinds or other window coverings that should be opened to a partial position. It sends a MY button press when open is set as target position
- `blindTimeToOpen` defines the time in ms that it typically takes for the blind to open or close. Used to mock the current position that is reported. For venetian blinds the recommendation is to lower this number to 2000 or 2s (Default = 10000)


### Pairing
For each virtual remote created:

1. Take the current physical remote that controls the Somfy device to be programmed. If the remote controls several channels, make sure to select the good one.

2. With this remote, use the Up/Down/My buttons to make the device approximately half way between the opened and closed positions (the aim is to not be totally opened or totally closed).

3. On the same remote, locate the Prog button (usually a small button on the back) and keep it pressed until the Somfy device does a short up and down movement.

4. Without waiting, press the Prog button on the virtual remote to pair with this device. The Somfy device should do again a short up and down movement confirming the registration of this new remote.

5. Wait at least 5 minutes before pairing another remote to avoid pairing a remote to multiple devices.

### Post Setup
Once pairing is complete, switch the controls to a single stateful On/Off window covering. Go to Homebridge Config UI X, then in the Config tab, edit the JSON to set the `adminMode` to false. Restart homebridge.


## Backup
Any loss of unique IDs and/or rolling codes, leads to the impossibility to control the Somfy RTS devices.

Even worst, it makes unregistering the virtual remotes impossible, because the unique ID and correct rolling code are necessary to send the command to unregister a remote. The only solution would be a hard reset of the device involving accessing the motor, resetting the upper/lower limits and registering the remotes from scratch.

As rolling codes are incremented each time a signal is sent, it is strongly advised to perform Homebridge backups frequently.

Rolling codes are stored in text files in the Homebridge storage path with the unique ID as the name, e.g. 12345.json, and are thus normally backed-up during Homebridge backups.


## Troubleshooting

- Blind only moves a small step instead of fully opening/closing. The blind is detecting the signal as a long-press. Change your config file and lower the repetitions parameter (e.g. to 2).


## Links
- [homebridge-somfi-blinds](https://github.com/mwraith/homebridge-somfi-blinds) is the previous version of the plugin based on a Raspberry Pi 4 controller.
- [Pushstack](https://pushstack.wordpress.com/somfy-rts-protocol/) for a detailed description of the Somfy RTS protocol.
- [Nickduino](https://github.com/Nickduino/Pi-Somfy) wrote the original python implementation of the Somfy RTS protocol. I used this as a reference for the `pico-firmware` port in C.
