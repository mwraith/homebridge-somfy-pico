import { EventEmitter } from 'events';

export class Socket extends EventEmitter {
    constructor() {
        super();
        this.destroyed = false;
    }

    connect(port, host, callback) {
        process.nextTick(callback);
        return this;
    }

    write(data, callback) {
        if (callback) callback(null);
        process.nextTick(() => this.emit('data', Buffer.from('OK\n')));
        return true;
    }
}

export default { Socket };
