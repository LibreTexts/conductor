//
// LibreTexts Conductor
// mtkeys.js
//

const base64 = require('base-64');

var browserKeys = {};

const decodeBrowserKeys = () => {
    if (process.env.BROWSERKEYS) {
        const keyVar = String(process.env.BROWSERKEYS);
        const decodedKeys = base64.decode(keyVar);
        browserKeys = JSON.parse(decodedKeys);
    }
};

const checkKeyStatus = () => {
    if (Object.keys(browserKeys).length > 0) {
        return true;
    }
    return false;
};

const getBrowserKeyForLib = (lib) => {
    // check if keys are already decoded, otherwise do it now
    if (checkKeyStatus()) {
        return browserKeys[lib];
    } else {
        decodeBrowserKeys();
        // check if the decode attempt worked
        if (checkKeyStatus()) {
            return browserKeys[lib];
        } else {
            return 'err';
        }
    }
};

module.exports = {
    getBrowserKeyForLib
}
