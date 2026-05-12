import { jest } from '@jest/globals';
import { sendCommand } from '../SendCommand.js';
import * as BlindState from '../BlindState.js';
import { SerialPort } from 'serialport';
import { api } from 'homebridge';

describe("Testing Send Command class", () => {
    test("send one command", async () => {
        const config = {
            "id": 99100,
            "name": "test"
        };

        await sendCommand(api, config, 'Up');

        // Then get state
        let state = BlindState.getRollingCode(api, config.id);

        // Check the rolling state is set
        expect(state).toEqual(2);
    });

    test("send two commands", async () => {
        const config = {
            "id": 99110,
            "name": "test"
        };

        await sendCommand(api, config, 'Up');

        await sendCommand(api, config, 'Down');

        // Then get state
        let state = BlindState.getRollingCode(api, config.id);

        // Check the rolling state is set
        expect(state).toEqual(3);
    });

    test("rolling code does not advance when Pico is not found", async () => {
        const config = {
            "id": 99120,
            "name": "test"
        };

        jest.spyOn(SerialPort.prototype, 'write').mockImplementationOnce(() => {
            throw new Error('Serial write failed');
        });

        const log = { error: jest.fn() };
        await sendCommand(api, config, 'Up', log);

        const state = BlindState.getRollingCode(api, config.id);
        expect(state).toEqual(1);
        expect(log.error).toHaveBeenCalled();
    });
});