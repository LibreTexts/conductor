//
// LibreTexts Conductor
// project.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
    projectID: {                // b62 10-digit identifier
        type: String,
        required: true
    },
    title: {                    // project title
        type: String,
        required: true
    },
    status: {                   // project status, one of: 'available', 'ip', 'completed', 'flagged'
        type: String,
        default: 'available'
    },
    currentProgress: {          // estimated project progress (%)
        type: Number,
        default: 0
    },
    author: String,             // resource author (if applicable)
    license: String,            // resource license (if applicable)
    resourceURL: String,        // resource original URL (if applicable)
    projectURL: String,         // the URL where the project exists (if applicable)
    assignees: [String],        // all users assigned to the project (UUIDs)
    tags: [String],             // project tags
    notes: String,              // project notes/description
    createdBy: String,          // the user who created the project (UUID)
    flaggedUser: String         // user who should review the flagged project (UUID)
}, {
    timestamps: true
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project;
