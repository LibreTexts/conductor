const debug = require('debug')('conductor');

const debugServer = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[SERVER]: %s', msg);
    } else {
        debug('[SERVER]: %s', msg.toString());
    }
};

const debugDB = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[DB]: %s', msg);
    } else {
        debug('[DB]: %s', msg.toString());
    }
};

const debugError = (err) => {
    debug('[ORGID=%s]: %s', process.env.ORG_ID, err.toString());
};

const debugCommonsSync = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[COMMONS SYNC]: %s', msg);
    } else {
        debug('[COMMONS SYNC]: %s', msg.toString());
    }
}

module.exports = {
    debug,
    debugServer,
    debugDB,
    debugError,
    debugCommonsSync
}
