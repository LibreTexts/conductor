const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdminProjectSchema = new Schema({
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
    assignees: [String],
    description: String,
    convertedFrom: String
}, {
    timestamps: true
});

const AdminProject = mongoose.model('AdminProject', AdminProjectSchema);

module.exports = AdminProject;
