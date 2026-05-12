const LOGGING_ON = false;

const CHARACTERISTICS = {
    'On': 'ON',
    'CurrentPosition': 'CURRENTPOSITION',
    'TargetPosition': 'TARGETPOSITION',
    'PositionState': {
        DECREASING: 'DECREASING',
        INCREASING: 'INCREASING',
        STOPPED: 'STOPPED',
        toString: function() { return 'POSITIONSTATE'; }
    }
};

class MockCharacteristic {
    updateValue(value) {
        this.value = value;
        return this;
    }

    get() {
        return this.getMethod();
    }

    async set(value) {
        this.value = value;
        return await this.setMethod(value);
    }

    onGet(f) {
        this.getMethod = f;
        return this;
    }

    onSet(f) {
        this.setMethod = f;
        return this;
    }

    setProps(props) {
        this.props = props;
        return this;
    }
}

class SwitchServiceMock {
    constructor(buttonName, button) {
        this.buttonName = buttonName;
        this.button = button;
        this.characteristics = {
            'ON': new MockCharacteristic()
        };
    }

    getCharacteristic(characteristic) {
        return this.characteristics[characteristic];
    }

    updateCharacteristic(characteristic, value) {
        return this;
    }
}

class WindowCoveringMock {
    constructor(buttonName) {
        this.buttonName = buttonName;
        this.characteristics = {
            'CURRENTPOSITION': new MockCharacteristic(),
            'TARGETPOSITION': new MockCharacteristic(),
            'POSITIONSTATE': new MockCharacteristic()
        };
    }

    getCharacteristic(characteristic) {
        return this.characteristics[characteristic];
    }

    updateCharacteristic(characteristic, value) {
        return this;
    }
}

let api = {
    'hap': {
        'Characteristic': CHARACTERISTICS,
        'Service': {
            'Switch': SwitchServiceMock,
            'WindowCovering': WindowCoveringMock
        },
        'uuid': {
            'generate': (key) => 'uuid-' + key
        }
    },
    'user': {
        storagePath: () => './test/'
    },
    'on': (event, fn) => {
        if (event === 'didFinishLaunching')
            fn();
    },
    'registerPlatformAccessories': () => {},
    'unregisterPlatformAccessories': () => {},
    'platformAccessory': class {
        constructor(name, uuid) {
            this.name = name;
            this.uuid = uuid;
            this.context = {};
            this.services = [];
        }

        addService(service) {
            this.services.push(service);
            return service;
        }

        getService(name) {
            for (let service of this.services) {
                if (service.buttonName === name)
                    return service;
            }
            return null;
        }

        removeService(name) {
            this.services = this.services.filter(s => s.buttonName !== name);
        }
    }
};

let log = {
    debug: function(text) { if (LOGGING_ON) console.log(text); },
    warn: function(text) { if (LOGGING_ON) console.log(text); },
    error: function(text) { if (LOGGING_ON) console.log(text); },
    info: function(text) { if (LOGGING_ON) console.log(text); }
}

// Type-only exports required by SomfyRtsPlatform.js (TypeScript import artifacts)
export const API = undefined;
export const Logger = undefined;
export const PlatformAccessory = undefined;
export const PlatformConfig = undefined;
export const Service = undefined;
export const Characteristic = undefined;

export { api, log };
