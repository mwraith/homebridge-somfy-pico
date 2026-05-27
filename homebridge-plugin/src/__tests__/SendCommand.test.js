import { jest } from '@jest/globals';
import { sendCommand, configure } from '../SendCommand.js';
import * as BlindState from '../BlindState.js';
import { SerialPort } from 'serialport';
import { Socket } from 'net';
import { api } from 'homebridge';

// ── USB serial transport (default) ────────────────────────────────────────────

describe("Serial transport (USB, default)", () => {
    test("sends one command and advances rolling code", async () => {
        const config = { id: 99100, name: "test" };

        await sendCommand(api, config, 'Up');

        expect(BlindState.getRollingCode(api, config.id)).toEqual(2);
    });

    test("sends two commands and advances rolling code twice", async () => {
        const config = { id: 99110, name: "test" };

        await sendCommand(api, config, 'Up');
        await sendCommand(api, config, 'Down');

        expect(BlindState.getRollingCode(api, config.id)).toEqual(3);
    });

    test("rolling code does not advance when Pico is not found", async () => {
        const config = { id: 99120, name: "test" };

        jest.spyOn(SerialPort.prototype, 'write').mockImplementationOnce(() => {
            throw new Error('Serial write failed');
        });

        const log = { error: jest.fn() };
        await sendCommand(api, config, 'Up', log);

        expect(BlindState.getRollingCode(api, config.id)).toEqual(1);
        expect(log.error).toHaveBeenCalled();
    });

    test("rolling code does not advance when Pico returns ERR", async () => {
        const config = { id: 99130, name: "test" };

        jest.spyOn(SerialPort.prototype, 'write').mockImplementationOnce(function(data, callback) {
            if (callback) callback(null);
            process.nextTick(() => this.emit('data', Buffer.from('ERR\n')));
        });

        const log = { error: jest.fn() };
        await sendCommand(api, config, 'Up', log);

        expect(BlindState.getRollingCode(api, config.id)).toEqual(1);
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('ERR'));
    });
});

// ── WiFi TCP transport ────────────────────────────────────────────────────────

describe("TCP transport (WiFi mode)", () => {
    beforeEach(() => {
        // configure() resets _socket so each test starts with a fresh connection
        configure({ host: 'somfy-pico.local' });
    });

    afterEach(() => {
        configure({});  // back to serial mode
    });

    test("sends command and advances rolling code", async () => {
        const config = { id: 99200, name: "test" };

        await sendCommand(api, config, 'Up');

        expect(BlindState.getRollingCode(api, config.id)).toEqual(2);
    });

    test("sends two commands and advances rolling code twice", async () => {
        const config = { id: 99210, name: "test" };

        await sendCommand(api, config, 'Up');
        await sendCommand(api, config, 'Down');

        expect(BlindState.getRollingCode(api, config.id)).toEqual(3);
    });

    test("sends correct wire format to the socket", async () => {
        const config = { id: 12345, name: "test", repetitions: 2 };
        const writeSpy = jest.spyOn(Socket.prototype, 'write');

        await sendCommand(api, config, 'Down');

        const rollingCode = BlindState.getRollingCode(api, config.id) - 1;
        expect(writeSpy).toHaveBeenCalledWith(
            expect.stringMatching(`12345,4,${rollingCode},2\r\n`),
            expect.any(Function)
        );
    });

    test("rolling code does not advance when Pico returns ERR", async () => {
        const config = { id: 99220, name: "test" };

        jest.spyOn(Socket.prototype, 'write').mockImplementationOnce(function(data, callback) {
            if (callback) callback(null);
            process.nextTick(() => this.emit('data', Buffer.from('ERR\n')));
        });

        const log = { error: jest.fn() };
        await sendCommand(api, config, 'Up', log);

        expect(BlindState.getRollingCode(api, config.id)).toEqual(1);
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('ERR'));
    });

    test("rolling code does not advance when connection fails", async () => {
        const config = { id: 99230, name: "test" };

        jest.spyOn(Socket.prototype, 'connect').mockImplementationOnce(function(port, host, callback) {
            process.nextTick(() => this.emit('error', new Error('Connection refused')));
            return this;
        });

        const log = { error: jest.fn() };
        await sendCommand(api, config, 'Up', log);

        expect(BlindState.getRollingCode(api, config.id)).toEqual(1);
        expect(log.error).toHaveBeenCalled();
    });

    test("reuses the same socket across multiple commands", async () => {
        const config = { id: 99240, name: "test" };
        const connectSpy = jest.spyOn(Socket.prototype, 'connect');

        await sendCommand(api, config, 'Up');
        await sendCommand(api, config, 'Down');

        // connect() should only have been called once — socket is cached
        expect(connectSpy).toHaveBeenCalledTimes(1);
    });
});
