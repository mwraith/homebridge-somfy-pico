import { jest } from '@jest/globals';
import WindowCoveringAccessory from '../WindowCoveringAccessory.js';
import { api, log } from 'homebridge';
import SendCommandMethods from '../SendCommand.js';


const Characteristic = api.hap.Characteristic;

describe("Testing Window Covering Accessory", () => {
    beforeAll(() => {
        jest.useFakeTimers({ legacyFakeTimers: true });
        jest.spyOn(global, 'setTimeout');
    });

    test("Check Window Covering Initialisation", () => {
        // Config for the accessory
        const config = {
            "id": 99201,
            "name": "Test",
            "adminMode": true
        };

        // Create the accessory
        let service = new WindowCoveringAccessory('Test', log, config, api);

        // Check we got a service back
        expect(service instanceof api.hap.Service.WindowCovering).toEqual(true);
    });

    test("Check Button Set", async () => {
        // Config for the accessory
        const config = {
            "id": 99203,
            "name": "Test",
            "adminMode": true
        };

        // Spy on calls to send command
        const spy = jest.spyOn(SendCommandMethods, 'sendCommand');

        // Create the accessory
        let service = new WindowCoveringAccessory('Test', log, config, api);
        let TargetPosition = service.getCharacteristic(Characteristic.TargetPosition);
        let CurrentPosition = service.getCharacteristic(Characteristic.CurrentPosition);
        let PositionState = service.getCharacteristic(Characteristic.PositionState);

        // Fully open the blind
        await TargetPosition.set(100);

        // Expect button pressed to be UP
        expect(spy).toHaveBeenCalledWith(
            api,
            expect.objectContaining(config),
            'Up',
            expect.anything()
        );

        // Wait a while
        jest.runAllTimers();

        // Expect position to be open
        expect(await TargetPosition.get()).toEqual(100);
        expect(await CurrentPosition.get()).toEqual(100);
        expect(await PositionState.get()).toEqual(Characteristic.PositionState.STOPPED);

        // Fully close the blind
        await TargetPosition.set(0);

        // Expect button pressed to be DOWN
        expect(spy).toHaveBeenCalledWith(
            api,
            expect.objectContaining(config),
            'Down',
            expect.anything()
        );

        // Wait a while
        jest.runAllTimers();

        // Expect to be closed
        expect(await TargetPosition.get()).toEqual(0);
        expect(await CurrentPosition.get()).toEqual(0);
        expect(await PositionState.get()).toEqual(Characteristic.PositionState.STOPPED);
    });

    test("Check My Position Mode", async () => {
        // Config for the accessory
        const config = {
            "id": 99204,
            "name": "Test",
            "adminMode": true,
            "openToMyPosition": true
        };

        // Spy on calls to send command
        const spy = jest.spyOn(SendCommandMethods, 'sendCommand');

        // Create the accessory
        let service = new WindowCoveringAccessory('Test', log, config, api);
        let TargetPosition = service.getCharacteristic(Characteristic.TargetPosition);
        let CurrentPosition = service.getCharacteristic(Characteristic.CurrentPosition);
        let PositionState = service.getCharacteristic(Characteristic.PositionState);

        // Fully open the blind
        await TargetPosition.set(100);

        // Expect button pressed to be MY
        expect(spy).toHaveBeenCalledWith(
            api,
            expect.objectContaining(config),
            'My',
            expect.anything()
        );

        // Wait a while
        jest.runAllTimers();

        // Expect to be open
        expect(await TargetPosition.get()).toEqual(100);
        expect(await CurrentPosition.get()).toEqual(100);
        expect(await PositionState.get()).toEqual(Characteristic.PositionState.STOPPED);

        // Fully close the blind
        await TargetPosition.set(0);

        // Expect button pressed to be DOWN
        expect(spy).toHaveBeenCalledWith(
            api,
            expect.objectContaining(config),
            'Down',
            expect.anything()
        );

        // Wait a while
        jest.runAllTimers();

        // Expect to be closed
        expect(await TargetPosition.get()).toEqual(0);
        expect(await CurrentPosition.get()).toEqual(0);
        expect(await PositionState.get()).toEqual(Characteristic.PositionState.STOPPED);
    });


    test("Test current position works", async () => {
        // Config for the accessory
        const config = {
            "id": 99205,
            "name": "Test",
            "adminMode": false,
            "openToMyPosition": false,
            "blindTimeToOpen": 10000
        };

        // Create the accessory
        let service = new WindowCoveringAccessory('Test', log, config, api);
        let TargetPosition = service.getCharacteristic(Characteristic.TargetPosition);
        let CurrentPosition = service.getCharacteristic(Characteristic.CurrentPosition);

        // Fully open the blind
        await TargetPosition.set(100);

        // Wait a while
        jest.advanceTimersByTime(config.blindTimeToOpen*0.3);

        // Expect current position to be 30% open
        expect(await CurrentPosition.get()).toEqual(30);

        // Wait a while
        jest.advanceTimersByTime(config.blindTimeToOpen*0.3);

        // Expect current position to be 60% open
        expect(await CurrentPosition.get()).toEqual(60);

        // Finish opening
        jest.runAllTimers();

        // Fully close the blind
        await TargetPosition.set(0);

        // Wait a while
        jest.advanceTimersByTime(config.blindTimeToOpen*0.3);

        // Expect current position to be 30% closed
        expect(await CurrentPosition.get()).toEqual(70);

        // Wait a while longer
        jest.advanceTimersByTime(config.blindTimeToOpen*0.3);

        // Expect current position to be 60% closed
        expect(await CurrentPosition.get()).toEqual(40);
    });

    test("Test stopping in partial position", async () => {
        // Config for the accessory
        const config = {
            "id": 99206,
            "name": "Test",
            "adminMode": false,
            "openToMyPosition": false,
            "blindTimeToOpen": 10000
        };

        // Create the accessory
        let service = new WindowCoveringAccessory('Test', log, config, api);
        let TargetPosition = service.getCharacteristic(Characteristic.TargetPosition);

        // Spy on calls to send command
        const spy = jest.spyOn(SendCommandMethods, 'sendCommand');

        // Fully open the blind
        await TargetPosition.set(100);

        // Wait a while
        jest.advanceTimersByTime(config.blindTimeToOpen*0.3);

        // Send a closed signal
        await TargetPosition.set(0);

        // Expect button pressed to be MY
        expect(spy).toHaveBeenCalledWith(
            api,
            expect.objectContaining(config),
            'My',
            expect.anything()
        );
    });
});