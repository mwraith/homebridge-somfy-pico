import { SerialPort } from 'serialport';
import * as BlindState from './BlindState.js';

// Button codes matching the Pico firmware enum
const BUTTON = {
    My: 0x1,
    Up: 0x2,
    Down: 0x4,
    Prog: 0x8,
};

// Cached serial port — opened lazily, reset on error so it reconnects next call
let _port = null;

// Cached logger — set on first sendCommand call, used by the port error handler
let _log = null;

// Serialises writes so concurrent group commands don't contend for the port lock
let _writeQueue = Promise.resolve();

/**
 * Finds the serial port path of the connected Pico by matching the manufacturer string.
 *
 * @returns {String} The path of the Pico serial port
 * @throws {Error} If no Pico is found
 */
async function findPicoPath() {
    const ports = await SerialPort.list();
    const pico = ports.find(p => p.manufacturer === 'homebridge-somfy-pi');
    if (!pico) throw new Error('Somfy Pico not found — is it plugged in?');
    return pico.path;
}

/**
 * Returns the cached open serial port, or opens a new one via auto-detection.
 *
 * @returns {SerialPort} An open SerialPort instance
 */
async function getPort() {
    if (_port?.isOpen) return _port;
    const path = await findPicoPath();
    _port = new SerialPort({ path, baudRate: 115200 });
    _port.on('error', (err) => {
        _log.error(`Pico serial error: ${err.message}`);
        _port = null;
    });
    return _port;
}

// Mutable export object so jest.spyOn can intercept sendCommand in tests
const commands = {};
export default commands;

/**
 * Sends a button press command to the Pico over USB serial and maintains
 * the rolling code in BlindState.
 *
 * The Pico receives comma-separated values: id,button,rollingCode,repetitions
 *
 * @param {Object} api    Homebridge API object
 * @param {Object} config Homebridge device config
 * @param {String} button Button to press (Up/Down/My/Prog)
 * @param {Object} log    Homebridge logger
 */
export async function sendCommand(api, config, button, log) {
    _log = log;
    const rollingCode = BlindState.getRollingCode(api, config.id);
    const repetitions = config.repetitions || 4;

    const queued = _writeQueue.then(async () => {
        try {
            const port = await getPort();
            port.write(`${config.id},${BUTTON[button]},${rollingCode},${repetitions}\r\n`);
            BlindState.advanceRollingCode(api, config.id);
        } catch (err) {
            log.error(`Failed to send command to Pico: ${err.message}`);
        }
    });

    _writeQueue = queued;
    await queued;
}
commands.sendCommand = sendCommand;
