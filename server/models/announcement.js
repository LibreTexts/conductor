//
// LibreTexts Conductor
// announcement.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
    author: {                   // announcement author (UUID)
        type: String,
        required: true
    },
    title: {                    // announcement title
        type: String,
        required: true
    },
    message: {                  // announcement full message
        type: String,
        required: true
    },
    org: {                      // announcement target Organization ('global' or <ORGID>)
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const Announcement = mongoose.model('Announcement', AnnouncementSchema);

module.exports = Announcement;
