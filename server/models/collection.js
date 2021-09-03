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
    collID: {                       // base62 8-digit identifier
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
    privacy: {                      // the collection privacy setting (one of: 'public', 'private', 'campus')
        type: String,
        default: 'public'
    },
    resources: [String],            // the array of resource IDs included in the collection,
    program: {                      // the OER program the collection is AUTO-GENERATED for
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

const Collection = mongoose.model('Collection', CollectionSchema);

module.exports = Collection;
