import { SerialPort } from 'serialport';
import net from 'net';
import * as BlindState from './BlindState.js';

// Button codes matching the Pico firmware enum
const BUTTON = {
    My: 0x1,
    Up: 0x2,
    Down: 0x4,
    Prog: 0x8,
};

// Transport config — set by configure() when WiFi mode is active
let _host = null;

// Cached connections — reset on error so they reconnect next call
let _port   = null;   // SerialPort (USB serial mode)
let _socket = null;   // net.Socket  (WiFi mode)

// Cached logger — set on first sendCommand call, used by error handlers
let _log = null;

// Serialises writes so concurrent group commands don't contend for the transport
let _writeQueue = Promise.resolve();

// RF transmission takes ~650ms; 5s gives generous headroom
const RESPONSE_TIMEOUT_MS = 5000;
const CMD_PORT = 8765;

/**
 * Switch the active transport. Call once at platform startup.
 * @param {Object} opts
 * @param {string|null} opts.host  Hostname/IP of the Pico (WiFi mode), or null for USB serial.
 */
export function configure({ host } = {}) {
    _host   = host || null;
    _port   = null;
    _socket = null;
}

// ── Response reader ───────────────────────────────────────────────────────────
// Works for both SerialPort and net.Socket — both are EventEmitters that emit 'data'.

function readResponse(emitter) {
    return new Promise((resolve, reject) => {
        let buffer = '';

        const cleanup = (fn) => {
            emitter.removeListener('data', onData);
            clearTimeout(timer);
            fn();
        };

        const onData = (data) => {
            buffer += data.toString();
            if (buffer.includes('OK')) {
                cleanup(resolve);
            } else if (buffer.includes('ERR')) {
                cleanup(() => reject(new Error('Pico returned ERR')));
            }
        };

        const timer = setTimeout(
            () => cleanup(() => reject(new Error('Timed out waiting for Pico response'))),
            RESPONSE_TIMEOUT_MS
        );

        emitter.on('data', onData);
    });
}

// ── Serial transport ──────────────────────────────────────────────────────────

async function findPicoPath() {
    const ports = await SerialPort.list();
    const pico = ports.find(p => p.manufacturer === 'homebridge-somfy-pi');
    if (!pico) throw new Error('Somfy Pico not found — is it plugged in?');
    return pico.path;
}

async function getPort() {
    if (_port?.isOpen) return _port;
    const path = await findPicoPath();
    _port = new SerialPort({ path, baudRate: 115200 });
    _port.on('error', (err) => {
        _log?.error(`Pico serial error: ${err.message}`);
        _port = null;
    });
    return _port;
}

// ── WiFi TCP transport ────────────────────────────────────────────────────────

async function getSocket() {
    if (_socket && !_socket.destroyed) return _socket;
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.connect(CMD_PORT, _host, () => {
            _socket = socket;
            _socket.on('error', (err) => {
                _log?.error(`Pico TCP error: ${err.message}`);
                _socket = null;
            });
            _socket.on('close', () => { _socket = null; });
            resolve(_socket);
        });
        socket.once('error', reject);
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

const commands = {};
export default commands;

/**
 * Sends a button press command to the Pico and maintains the rolling code.
 *
 * Selects the active transport automatically:
 *   - WiFi mode  : TCP socket to the host set via configure()
 *   - Serial mode: USB serial, auto-detected by USB manufacturer string
 *
 * The Pico receives: id,button,rollingCode,repetitions\r\n
 * It responds synchronously with OK or ERR after the RF transmission completes.
 *
 * @param {Object} api    Homebridge API object
 * @param {Object} config Homebridge device config
 * @param {String} button Button to press (Up/Down/My/Prog)
 * @param {Object} log    Homebridge logger
 */
export async function sendCommand(api, config, button, log) {
    _log = log;
    const rollingCode  = BlindState.getRollingCode(api, config.id);
    const repetitions  = config.repetitions || 4;

    const queued = _writeQueue.then(async () => {
        try {
            const transport = _host ? await getSocket() : await getPort();
            await new Promise((resolve, reject) => {
                transport.write(
                    `${config.id},${BUTTON[button]},${rollingCode},${repetitions}\r\n`,
                    err => err ? reject(err) : resolve()
                );
            });
            await readResponse(transport);
            BlindState.advanceRollingCode(api, config.id);
        } catch (err) {
            log?.error(`Failed to send command to Pico: ${err.message}`);
        }
    });

    _writeQueue = queued;
    await queued;
}
commands.sendCommand = sendCommand;
commands.configure   = configure;
