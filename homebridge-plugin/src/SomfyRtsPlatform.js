import SomfyRtsRemoteAccessory from './SomfyRtsRemoteAccessory.js';
import SendCommand from './SendCommand.js';

export default class SomfyRtsPlatform {

    /**
     * Constructor for the SomfyRtsPlatform.
     *
     * @constructor
     * @param {Object} log    - The Homebridge log
     * @param {Object} config - The Homebridge config
     * @param {Object} api    - The Homebridge API
     */
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = new Map();

        if (!config || !config.devices) {
            this.log.warn('No devices configured. Please update your Homebridge config.');
            return;
        }

        if (config.host) {
            SendCommand.configure({ host: config.host });
            this.log.info(`WiFi mode: connecting to Pico at ${config.host}:8765`);
        }

        this.api.on('didFinishLaunching', () => {
            this.log.info('Discovering devices...');
            this.discoverDevices();
        });
    }

    /**
     * Called by Homebridge to restore cached accessories on startup.
     *
     * @param {Object} accessory - The cached platform accessory
     */
    configureAccessory(accessory) {
        this.log.info(`Restoring cached accessory: ${accessory.displayName}`);
        this.accessories.set(accessory.UUID, accessory);
    }

    /**
     * Discover configured devices and register them as platform accessories.
     */
    discoverDevices() {
        const devices = this.config.devices || [];

        devices.forEach((device) => {
            const uuid = this.api.hap.uuid.generate(`somfy-rts:${device.id}`);

            let accessory = this.accessories.get(uuid);

            if (!accessory) {
                this.log.info(`Adding new device: ${device.name}`);
                accessory = new this.api.platformAccessory(device.name, uuid);
                this.api.registerPlatformAccessories('homebridge-somfy-pico', 'Somfy Blinds', [accessory]);
            } else {
                this.log.info(`Updating existing device: ${device.name}`);
                accessory.services
                    .filter(s => s.UUID !== this.api.hap.Service.AccessoryInformation.UUID)
                    .forEach(s => accessory.removeService(s));
            }

            const somfyAccessory = new SomfyRtsRemoteAccessory(this.log, device, this.api);
            somfyAccessory.configureServices(accessory);

            this.accessories.set(uuid, accessory);
        });
    }
}
