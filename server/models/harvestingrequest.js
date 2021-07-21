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
    comments: String
}, {
    timestamps: true
});

const HarvestingRequest = mongoose.model('HarvestingRequest', HarvestingRequestSchema);

module.exports = HarvestingRequest;
