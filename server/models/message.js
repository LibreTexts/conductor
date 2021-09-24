//
// LibreTexts Conductor
// message.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    messageID: {                        // base62 15-digit identifier
        type: String,
        required: true,
        unique: true
    },
    thread: {                           // the threadID the message belongs to (if applicable)
        type: String
    },
    task: {
        type: String                    // the taskID the message belongs to (if applicable)
    },
    body: {                             // the message body
        type: String,
        required: true
    },
    author: {
        type: String,                   // the UUID of the message sender
        required: true
    }
}, {
    timestamps: true
});

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message;
