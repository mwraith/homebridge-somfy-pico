export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^homebridge$': '<rootDir>/src/__mocks__/homebridge.js',
    '^fs$': '<rootDir>/src/__mocks__/fs.cjs',
    '^serialport$': '<rootDir>/src/__mocks__/serialport.js',
  }
};