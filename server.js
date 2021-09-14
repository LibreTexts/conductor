//
// LibreTexts Conductor
// server.js
//

const dotenv = require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bluebird = require('bluebird');
const helmet = require('helmet');
const { exit } = require('process');
const { debug, debugServer, debugDB } = require('./server/debug.js');

// Prevent startup without ORG_ID env variable
if (!process.env.ORG_ID || process.env.ORG_ID === '') {
    debug('[FATAL ERROR]: The ORG_ID environment variable is missing.');
    exit(1);
}

// Prevent startup without Mailgun env variables
if (!process.env.MAILGUN_API_KEY || process.env.MAILGUN_API_KEY === '' ||
    !process.env.MAILGUN_DOMAIN || process.env.MAILGUN_DOMAIN === '') {
    debug('[FATAL ERROR]: The Mailgun environment variables are missing.');
    exit(1);
}

const api = require('./server/api.js');

const app = express();
const port = process.env.PORT || 5000;


mongoose.Promise = bluebird;
if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', true);
}
mongoose.connect(process.env.MONGOOSEURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
}).then(() => {
    debugDB('Connected to MongoDB Atlas.');
}).catch((err) => {
    debugDB(err);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet.hidePoweredBy());
app.use(helmet.contentSecurityPolicy({
    directives: {
        baseUri: ["'self'"],
        childSrc: ["'self'", 'https://*.libretexts.org'],
        connectSrc: [
            "'self'",
            'https://*.libretexts.org',
            '*.google-analytics.com' // gtag.js
        ],
        defaultSrc: ["'self'"],
        fontSrc: ["'self'",
            'https://*.libretexts.org',
            'https://fonts.gstatic.com',
            'data:'
        ],
        frameSrc: ["'self'", 'https://*.libretexts.org'],
        imgSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ['none'],
        scriptSrc: [
            "'self'",
            'https://*.libretexts.org',
            "'sha256-vr8P/3UUYbbQp32B/lr8C9cGDdP0LmPEdMLlces6xMk='", // gtag.js inline
            '*.googletagmanager.com', // gtag.js,
            '*.ssa.gov', // ANDI,
            'https://ajax.googleapis.com' // Google CDN (jQuery for ANDI)
        ],
        styleSrc: [
            "'self'",
            'https://*.libretexts.org',
            'https://fonts.googleapis.com',
            '*.ssa.gov',
            "'unsafe-inline'" // TODO: Review
        ]
    }
}));

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        /*
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
            return res.redirect('https://' + req.get('host') + req.url);
        }
        */
        next();
    });
}

app.use('/api/v1', api);

app.use(express.static(path.join(__dirname, 'client/build')));
var cliRouter = express.Router();
cliRouter.route('*').get((_req, res) => {
    res.sendFile(path.resolve('./client/build/index.html'));
});
app.use('/', cliRouter);

app.listen(port, (err) => {
    if (err) {
        debugServer(err);
    }
    var startupMsg = '';
    if (process.env.ORG_ID === 'libretexts') startupMsg = `Conductor is listening on ${port}`;
    else startupMsg = `Conductor (${process.env.ORG_ID}) is listening on ${port}`;
    debugServer(startupMsg);
});
