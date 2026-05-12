import { EventEmitter } from 'events';

export class SerialPort extends EventEmitter {
    constructor(options) {
        super();
        this.isOpen = true;
        this.path = options.path;
    }
    write(data, callback) {
        if (callback) callback(null);
        process.nextTick(() => this.emit('data', Buffer.from('OK\n')));
    }
    static list() {
        return Promise.resolve([{ path: '/dev/ttyACM0', manufacturer: 'homebridge-somfy-pi' }]);
    }
}
