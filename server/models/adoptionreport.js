const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdoptionReportSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    resource: {
        id: String,
        title: String,
        library: String,
        link: String
    },
    instructor: {
        isLibreNet: String,
        institution: String,
        class: String,
        term: String,
        students: Number,
        replaceCost: Number,
        printCost: Number,
        access: {
            type: [String],
            default: undefined
        }
    },
    student: {
        use: String,
        institution: String,
        class: String,
        instructor: String,
        quality: Number,
        navigation: Number,
        printCost: Number,
        access: {
            type: [String],
            default: undefined
        }
    },
    comments: String
}, {
    timestamps: true
});

const AdoptionReport = mongoose.model('AdoptionReport', AdoptionReportSchema);

module.exports = AdoptionReport;
