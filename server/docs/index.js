//
// LibreTexts Conductor
// index.js
// SwaggerUI Module Exposure
//

const config = require('./config.js');
const servers = require('./servers.js');
const tags = require('./tags.js');
const routes = require('./routes');

module.exports = {
    ...config,
    ...servers,
    ...tags,
    ...routes
}
