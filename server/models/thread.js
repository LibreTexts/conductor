//
// LibreTexts Conductor
// thread.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ThreadSchema = new Schema({
    threadID: {                         // base62 14-digit identifier
        type: String,
        required: true,
        unique: true
    },
    project: {                          // the projectID the thread belongs to
        type: String,
        required: true
    },
    title: {                            // the thread's title/topic
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const Thread = mongoose.model('Thread', ThreadSchema);

module.exports = Thread;
