//
// LibreTexts Conductor
// homework.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HomeworkSchema = new Schema({
    hwID: {                     // base62 11-digit identifier
        type: String,
        required: true,
        unique: true
    },
    title: {                    // the full book title
        type: String,
        required: true
    },
    kind: {
        type: String,           // the assignment type (i.e., 'adapt', 'h5p')
        required: true
    },
    externalID: {               // the identifier used in the origin system
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    adaptAssignments: [{        // the array of assignments for an ADAPT course
        title: String,
        description: String
    }]
}, {
    timestamps: true
});

const Homework = mongoose.model('Homework', HomeworkSchema);

module.exports = Homework;
