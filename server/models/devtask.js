const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DevTaskSchema = new Schema({
    devTaskID: {
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
    projectID: String,
    description: String,
    resourceURL: String
}, {
    timestamps: true
});

const DevTask = mongoose.model('DevTask', DevTaskSchema);

module.exports = DevTask;
