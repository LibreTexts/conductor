//
// LibreTexts Conductor
// project.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { projectClassifications } = require('../util/projectutils.js');
const { a11ySectionReviewSchema } = require('../util/a11yreviewutils.js');

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
    peerProgress: {             // estimated project peer review progress (%)
        type: Number,
        default: 0
    },
    a11yProgress: {             // estimated project accessibility progress/score (%)
        type: Number,
        default: 0
    },
    classification: {           // the project's internal classification
        type: String,
        enum: ['', ...projectClassifications]
    },
    libreLibrary: String,       // the corresponding LibreText's library
    libreCoverID: String,       // the corresponding LibreText's Coverpage ID
    author: String,             // resource author (if applicable)
    authorEmail: String,        // resource author's email (if applicable)
    license: String,            // resource license (if applicable)
    resourceURL: String,        // resource original URL (if applicable)
    projectURL: String,         // the URL where the project exists (if applicable)
    collaborators: [String],    // all users with access to the project (UUIDs)
    tags: [String],             // project tags (tagIDs)
    notes: String,              // project notes/description
    owner: String,              // the user who created the project (UUID),
    rdmpReqRemix: Boolean,      // whether the Construction Roadmap indicates remixing is required
    rdmpCurrentStep: String,    // the project's current step in the Construction Roadmap,
    a11yReview: [               // the text section accessibility reviews
        a11ySectionReviewSchema
    ],
    harvestReqID: String,
    flag: String                // user group to flag, one of: ['libretexts', 'campusadmin', 'lead', 'liaison']
}, {
    timestamps: true
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project;
