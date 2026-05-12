import SomfyRtsPlatform from './SomfyRtsPlatform.js';

/**
 * This method registers the platform with Homebridge.
 * @param {Object} api - The Homebridge API
 */
export default (api) => {
    api.registerPlatform('homebridge-somfy-pico', 'Somfy Blinds', SomfyRtsPlatform);
};
