//
// LibreTexts Conductor
// customcatalog.js
// Mongoose Model
//

import mongoose from 'mongoose';

const CustomCatalogSchema = new mongoose.Schema({
    orgID: {                        // the organization's internal identifier string (one custom catalog/organization)
        type: String,
        required: true,
        unique: true
    },
    resources: [String]             // the array of resource IDs included in the custom catalog
}, {
    timestamps: true
});

const CustomCatalog = mongoose.model('CustomCatalog', CustomCatalogSchema);

export default CustomCatalog;
