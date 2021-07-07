const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bluebird = require('bluebird');
const helmet = require('helmet');

const app = express();
const port = 5000;
dotenv.config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(helmet());

app.use((req, res, next) => {
    var allowedOrigins = ['http://localhost:3000'];
    var origin = req.headers.origin;
    if (allowedOrigins.indexOf(origin) > -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization, X-Requested-With');
    return next();
});

mongoose.Promise = bluebird;
mongoose.set('debug', true);
mongoose.connect(process.env.MONGOOSEURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
    }
).then(() => {
    console.log('[DB]: Connected to MongoDB Atlas.');
}).catch((err) => {
    console.error('[DB]: ' + err);
});

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== 'development') {
            return res.redirect('https://' + req.get('host') + req.url);
        }
        next();
    });
}

const api = require('./server/api.js');
const client = require('./server/client-router.js');

app.use('/api', api);
app.use(express.static(path.join(__dirname, 'client/build')));
var cliRouter = express.Router();
cliRouter.route('*').get((req, res) => {
    res.sendFile(path.resolve('./client/build/index.html'));
});
app.use('/', cliRouter);

//app.use('/', client);

app.listen(port, (err) => {
    if (err) {
        console.log('[SERVER ERROR]: ' + err);
    }
    console.log(`[SERVER]: PTS listening on ${port}`);
});
