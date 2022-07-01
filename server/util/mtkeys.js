//
// LibreTexts Conductor
// mtkeys.js
//
import base64 from 'base-64';

let browserKeys = {};

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

export const getBrowserKeyForLib = (lib) => {
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
