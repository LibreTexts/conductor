//
// LibreTexts Conductor
// collection.js
// Mongoose Model
//

import mongoose from 'mongoose';

const CollectionSchema = new mongoose.Schema({
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
    program: {                      // the OER program the collection is automatically managed for
        type: String,
        default: ''
    },
    locations: {                    // locations to search in, if automatically managed (e.g., 'central', 'campus')
      type: [String],
      default: ['central']
    },
    autoManage: {                   // allow the system to automatically manage the collection based on 'program' and 'locations'
      type: Boolean,
      default: false,
    },
}, {
    timestamps: true
});

const Collection = mongoose.model('Collection', CollectionSchema);

export default Collection;
