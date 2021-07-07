const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DevProjectUpdateSchema = new Schema({
    updateID: {
        type: String,
        required: true
    },
    projectID: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    estimatedHours: {
        type: Number,
        default: 0,
        required: true
    },
    accomplishments: {
        type: String,
        required: true
    },
    issues: {
        type: String,
        required: true
    },
    objectives: {
        type: String,
        required: true
    },
    notes: {
        type: String
    },
    estimatedProgress: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

const DevProjectUpdate = mongoose.model('DevProjectUpdate', DevProjectUpdateSchema);

module.exports = DevProjectUpdate;
