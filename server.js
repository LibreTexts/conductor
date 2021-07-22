//
// LibreTexts Conductor
// server.js
//

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bluebird = require('bluebird');
const helmet = require('helmet');

const api = require('./server/api.js');

const app = express();
const port = process.env.PORT || 5000;
dotenv.config();

mongoose.Promise = bluebird;
if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', true);
}
mongoose.connect(process.env.MONGOOSEURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('[DB]: Connected to MongoDB Atlas.');
}).catch((err) => {
    console.error('[DB]: ' + err);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());

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
cliRouter.route('*').get((req, res) => {
    res.sendFile(path.resolve('./client/build/index.html'));
});
app.use('/', cliRouter);

app.listen(port, (err) => {
    if (err) {
        console.log('[SERVER ERROR]: ' + err);
    }
    console.log(`[SERVER]: Conductor is listening on ${port}`);
});
