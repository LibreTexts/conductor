const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdminProjectUpdateSchema = new Schema({
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
    estimatedProgress: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

const AdminProjectUpdate = mongoose.model('AdminProjectUpdate', AdminProjectUpdateSchema);

module.exports = AdminProjectUpdate;
