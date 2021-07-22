const debug = require('debug')('conductor');

const debugError = (err) => {
    debug('[ORGID=%s] %s', process.env.ORG_ID, err.toString());
};

module.exports = {
    debugError
}
