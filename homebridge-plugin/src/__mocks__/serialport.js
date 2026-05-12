export class SerialPort {
    constructor(options) {
        this.isOpen = true;
        this.path = options.path;
    }
    write(data) {}
    on(event, fn) {}
    static list() {
        return Promise.resolve([{ path: '/dev/ttyACM0', manufacturer: 'homebridge-somfy-pi' }]);
    }
}
