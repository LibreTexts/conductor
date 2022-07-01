//
// LibreTexts Conductor
// announcement.js
// Mongoose Model
//

import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
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
    org: {                      // announcement target Organization, one of: ['global', <ORGID>, 'system']
        type: String,
        required: true
    },
    expires: Date               // announcement expiration date (system announcements only)
}, {
    timestamps: true
});

const Announcement = mongoose.model('Announcement', AnnouncementSchema);

export default Announcement;
