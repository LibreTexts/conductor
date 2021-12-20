const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HarvestingRequestSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        default: 'open'     // request status, one of: ['open', 'converted']
    },
    library: {
        type: String,
        required: true
    },
    url: String,
    license: {
        type: String,
        required: true
    },
    name: String,
    institution: String,
    resourceUse: String,
    dateIntegrate: Date,
    comments: String,
    submitter: String,      // user's uuid if submitter was authenticated,
    addToProject: Boolean   // if user was authenticated, choice to be added to project team upon conversion
}, {
    timestamps: true
});

const HarvestingRequest = mongoose.model('HarvestingRequest', HarvestingRequestSchema);

module.exports = HarvestingRequest;
