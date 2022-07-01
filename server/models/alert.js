//
// LibreTexts Conductor
// alert.js
// Mongoose Model
//

import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema({
    orgID: {                            // the OrgID of the instance the Alert was created in
        type: String,
        required: true
    },
    alertID: {                          // base62 17-digit identifier
        type: String,
        required: true,
        unique: true
    },
    user: {                             // the UUID of the user the Alert belongs to
        type: String,
        required: true
    },
    query: {                            // the phrase to search for matching results with
        type: String,
        required: true
    },
    timing: {                           // how often to check for new results, one of ['instant', 'daily']
        type: String,
        required: true,
    },
    resources: {                        // the resource types to match, some of ['project', 'book', 'homework']
        type: [String],
        required: true
    },
    projectLocation: String,            // one of ['global', 'local']
    lastTriggered: Date                 // timestamp when the alert was last 'triggered'
}, {
    timestamps: true
});

const Alert = mongoose.model('Alert', AlertSchema);

export default Alert;
