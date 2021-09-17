//
// LibreTexts Conductor
// project.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
    orgID: {                    // organization identifier string
        type: String,
        required: true
    },
    projectID: {                // base62 10-digit identifier
        type: String,
        required: true
    },
    title: {                    // project title
        type: String,
        required: true
    },
    status: {                   // project status, one of: 'available', 'open', 'completed', 'flagged'
        type: String,
        default: 'available'
    },
    visibility: {
        type: String,           // project privacy, one of: 'public', 'private'
        default: 'private'
    },
    currentProgress: {          // estimated project progress (%)
        type: Number,
        default: 0
    },
    author: String,             // resource author (if applicable)
    license: String,            // resource license (if applicable)
    resourceURL: String,        // resource original URL (if applicable)
    projectURL: String,         // the URL where the project exists (if applicable)
    collaborators: [String],    // all users with access to the project (UUIDs)
    tags: [String],             // project tags (tagIDs)
    notes: String,              // project notes/description
    owner: String               // the user who created the project (UUID)
}, {
    timestamps: true
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project;
