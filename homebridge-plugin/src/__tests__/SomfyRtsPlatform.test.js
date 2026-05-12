import SomfyRtsPlatform from '../SomfyRtsPlatform.js';
import { api, log } from 'homebridge';


describe("Testing Main Class", () => {
    test("Check services with admin mode", () => {
        // Config for the accessory
        const config = {
            devices: [{
                "id": 99100,
                "name": "test",
                "adminMode": true
            }]
        };

        // Create the accessory
        let rts = new SomfyRtsPlatform(log, config, api);

        // Check we have Toggle, Up, Down, My, Prog buttons
        expect(rts.accessories.size).toEqual(1);
        expect(rts.accessories.has('uuid-somfy-rts:99100')).toEqual(true);
        expect(rts.accessories.get('uuid-somfy-rts:99100').services.length).toEqual(5);
    });

    test("check services with non admin mode", () => {
        // Config for the accessory
        const config = {
            devices: [{
                "id": 99100,
                "name": "test",
                "adminMode": false
            }]
        };

        // Create the accessory
        let rts = new SomfyRtsPlatform(log, config, api);

        // Check we have the main service only
        expect(rts.accessories.size).toEqual(1);
        expect(rts.accessories.has('uuid-somfy-rts:99100')).toEqual(true);
        expect(rts.accessories.get('uuid-somfy-rts:99100').services.length).toEqual(1);
    });
});