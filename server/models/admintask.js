const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdminTaskSchema = new Schema({
    adminTaskID: {
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
    description: String
}, {
    timestamps: true
});

const AdminTask = mongoose.model('AdminTask', AdminTaskSchema);

module.exports = AdminTask;
