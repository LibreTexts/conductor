//
// LibreTexts Conductor
// collection.js
// Mongoose Model
//

import mongoose from 'mongoose';

const ResourceSchema = new mongoose.Schema({
    resourceType: {
        type: String,
        default: 'resource',
        enum: ['resource', 'collection']
    },
    resourceID: {
        type: String,
        required: true
    }
})

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
    resources: [ResourceSchema],    // the array of resource IDs included in the collection, can be either a single resource or a nested collection
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
    parentID: {                     // collID of the parent collection if collection is nested in another
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

const Collection = mongoose.model('Collection', CollectionSchema);

export default Collection;
