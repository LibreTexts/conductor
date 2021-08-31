//
// LibreTexts Conductor
// collection.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CollectionSchema = new Schema({
    orgID: {                        // the organization's internal identifier string
        type: String,
        required: true
    },
    collID: {                        // base62 8-digit identifier
        type: String,
        required: true
    },
    title: {                        // the collection title/name
        type: String,
        required: true
    },
    coverPhoto: {                   // the collection's "cover photo"/thumbnail
        type: String,
        default: ''
    },
    enabled: Boolean,               // the collection status (enabled/disabled)
    resources: [String]             // the array of resource IDs included in the collection
}, {
    timestamps: true
});

const Collection = mongoose.model('Collection', CollectionSchema);

module.exports = Collection;
