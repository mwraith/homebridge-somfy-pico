import ButtonAccessory from './ButtonAccessory.js';
import WindowCoveringAccessory from './WindowCoveringAccessory.js';

/**
 * Manages the set of services for a single Somfy RTS device.
 * In normal mode exposes a WindowCovering service; in admin mode
 * also exposes individual button switches for Up/Down/My/Prog.
 *
 * @class SomfyRtsRemoteAccessory
 */
export default class SomfyRtsRemoteAccessory {

    /**
     * Constructor of the class SomfyRtsRemoteAccessory.
     *
     * @constructor
     * @param {Object} log    - The Homebridge log
     * @param {Object} config - The Homebridge config data filtered for this item
     * @param {Object} api    - The Homebridge API
     */
    constructor(log, config, api) {
        this.switchServices = [];

        // In admin mode expose individual button switches for each RTS command
        if (config.adminMode) {
            const buttons = ['Up', 'Down', 'My', 'Prog'];

            buttons.forEach(button => {
                const buttonName = `${config.name} ${button}`;
                this.switchServices.push(new ButtonAccessory(buttonName, button, log, config, api));
            });
        }

        // Always expose the stateful WindowCovering that represents the blind
        this.switchServices.push(new WindowCoveringAccessory(config.name, log, config, api));

        log.debug(`Initialized accessory ${config.name}`);
    }

    /**
     * Registers all services for this accessory with the platform accessory.
     *
     * @param {Object} accessory - The Homebridge platform accessory
     */
    configureServices(accessory) {
        this.switchServices.forEach(service => accessory.addService(service));
    }
}
