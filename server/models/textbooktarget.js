const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TextbookTargetSchema = new Schema({
    textbookTargetID: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    library: String,
    shelf: String,
    originalURL: String,
    type: String,
    status: {
        type: String,
        default: 'ready'
    },
    projectID: String,
    notes: String
}, {
    timestamps: true
});

const TextbookTarget = mongoose.model('TextbookTarget', TextbookTargetSchema);

module.exports = TextbookTarget;
