const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DevelopmentProjectSchema = new Schema({
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
    currentProgress: {
        type: Number,
        default: 0
    },
    description: String,
    resourceURL: String,
    assignees: [String],
    convertedFrom: String,
    flaggedUser: String
}, {
    timestamps: true
});

const DevelopmentProject = mongoose.model('DevelopmentProject', DevelopmentProjectSchema);

module.exports = DevelopmentProject;
