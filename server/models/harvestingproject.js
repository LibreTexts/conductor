const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HarvestingProjectSchema = new Schema({
    projectID: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'ready'
    },
    chapters: {
        type: Number,
        default: 0
    },
    currentChapter: {
        type: Number,
        default: 0
    },
    currentProgress: {
        type: Number,
        default: 0
    },
    assignees: [String],
    textbookURL: String,
    libreURL: String,
    library: String,
    shelf: String,
    notes: String,
    convertedFrom: String,
    flaggedUser: String
}, {
    timestamps: true
});

const HarvestingProject = mongoose.model('HarvestingProject', HarvestingProjectSchema);

module.exports = HarvestingProject;
