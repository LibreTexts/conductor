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
app.use(helmet.contentSecurityPolicy({
    directives: {
        baseUri: ["'self'"],
        childSrc: ["'self'", 'https://*.libretexts.org'],
        connectSrc: ["'self'", 'https://*.libretexts.org'],
        defaultSrc: ["'self'"],
        fontSrc: ["'self'",
            'https://*.libretexts.org',
            'https://fonts.gstatic.com',
            'data:'
        ],
        frameSrc: ["'self'", 'https://*.libretexts.org'],
        imgSrc: ["'self'", 'https://*.libretexts.org', 'https://*.mtstatic.com'],
        objectSrc: ['none'],
        scriptSrc: ["'self'", 'https://*.libretexts.org'],
        styleSrc: [
            "'self'",
            'https://*.libretexts.org',
            'https://fonts.googleapis.com'
        ]
    }
}));

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== 'development') {
            return res.redirect('https://' + req.get('host') + req.url);
        }
        next();
    });
}

app.use('/api', api);

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
    debugServer(`Conductor is listening on ${port}`);
});
