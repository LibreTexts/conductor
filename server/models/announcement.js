const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
    author: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    recipientGroups: {
        type: [String],
        required: true
    }
}, {
    timestamps: true
});

const Announcement = mongoose.model('Announcement', AnnouncementSchema);

module.exports = Announcement;

// admin
// develop
// harvest
