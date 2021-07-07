const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HarvestingProjectUpdateSchema = new Schema({
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
    message: {
        type: String,
        required: true
    },
    chapterCompleted: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

const HarvestingProjectUpdate = mongoose.model('HarvestingProjectUpdate', HarvestingProjectUpdateSchema);

module.exports = HarvestingProjectUpdate;
