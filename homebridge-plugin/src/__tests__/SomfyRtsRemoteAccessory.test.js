import SomfyRtsRemoteAccessory from '../SomfyRtsRemoteAccessory.js';
import { api, log } from 'homebridge';


describe("Testing Main Class", () => {
    test("Check services with admin mode", () => {
        // Config for the accessory
        const config = {
            "id": 99100,
            "name": "test",
            "adminMode": true
        };

        // Create the accessory
        let rts = new SomfyRtsRemoteAccessory(log, config, api);
        let services = rts.switchServices;

        // Check we have Toggle, Up, Down, My, Prog buttons
        expect(services.length).toEqual(5);
    });

    test("check services with non admin mode", () => {
        // Config for the accessory
        const config = {
            "id": 99101,
            "name": "test",
            "adminMode": false
        };

        // Create the accessory
        let rts = new SomfyRtsRemoteAccessory(log, config, api);
        let services = rts.switchServices;

        // Check we have the main service only
        expect(services.length).toEqual(1);
    });
});