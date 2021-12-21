//
// LibreTexts Conductor
// accountrequest.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AccountRequestSchema = new Schema({
    status: {
        type: String,
        enum: ['open', 'completed']
    },
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    institution: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        required: true,
        enum: ['oer', 'h5p', 'adapt']
    },
    facultyURL: {
        type: String,
        required: true
    },
    libraries: [String],
    moreInfo: Boolean,
    requester: String       // user's uuid if requester was authenticated
}, {
    timestamps: true
});

const AccountRequest = mongoose.model('AccountRequest', AccountRequestSchema);

module.exports = AccountRequest;
