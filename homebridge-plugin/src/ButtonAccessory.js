import { sendCommand } from './SendCommand.js';

/**
 * Creates a new stateless button using the Switch service in Apple HomeKit.
 *
 * This accessory is only used for the Up, Down, Prog and My buttons shown
 * in admin mode. When the user turns the switch On it sends the corresponding
 * RTS command, then automatically resets back to Off after a short delay to
 * model stateless button behaviour.
 *
 * For the main accessory that represents the blind refer to WindowCoveringAccessory.
 */
export default class ButtonAccessory {

    /**
     * Constructor for a new stateless button.
     *
     * @param {String} name    Label for the button
     * @param {String} button  Up/Down/My/Prog
     * @param {Object} log     Homebridge log object
     * @param {Object} config  Homebridge config object
     * @param {Object} api     Homebridge API object
     * @returns {api.hap.Service} Homebridge Service
     */
    constructor(name, button, log, config, api) {
        this.name = name;
        this.button = button;
        this.log = log;
        this.config = config;
        this.api = api;

        // Delay to reset the switch after being pressed
        this.delay = 1000;

        this.state = false;

        this.service = new this.api.hap.Service.Switch(name, button);

        this.service.getCharacteristic(this.api.hap.Characteristic.On)
            .onGet(this.getButtonOn.bind(this))
            .onSet(this.setButtonOn.bind(this));

        return this.service;
    }

    /**
     * Returns the current state of the button switch.
     *
     * @method getButtonOn
     * @returns {Boolean} Current on/off state
     */
    async getButtonOn() {
        this.log.debug(`Get '${this.button}' for ${this.config.id} - ${this.state}`);

        return this.state;
    }

    /**
     * Handles a button press. Sends the RTS command then schedules an
     * automatic reset back to Off to simulate stateless button behaviour.
     *
     * @method setButtonOn
     * @param {Boolean} value - The value set by the user
     */
    async setButtonOn(value) {
        this.log.debug(`setButtonOn called for button ${this.button} with value ${value}`);

        await sendCommand(this.api, this.config, this.button, this.log);

        this.state = value;

        if (value === true) {
            this.resetSwitchWithTimeout();
        }
    }

    /**
     * Resets the switch to Off after a short delay to simulate stateless behaviour.
     *
     * @method resetSwitchWithTimeout
     */
    resetSwitchWithTimeout() {
        this.log.debug(`resetSwitchWithTimeout called for button ${this.button}`);

        setTimeout(() => {
            this.log.debug(`Auto switching button ${this.button}`);
            this.state = false;
            this.service.updateCharacteristic(this.api.hap.Characteristic.On, false);
        }, this.delay);
    }
}
