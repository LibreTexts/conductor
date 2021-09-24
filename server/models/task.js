//
// LibreTexts Conductor
// project.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TaskSchema = new Schema({
    orgID: {                    // organization identifier string
        type: String,
        required: true
    },
    projectID: {                // the projectID the task belongs to
        type: String,
        required: true
    },
    taskID: {                   // base62 16-digit identifier
        type: String,
        required: true
    },
    title: {                    // task title
        type: String,
        required: true
    },
    description: {              // task description
        type: String
    },
    status: {                   // task status, one of: 'available', 'inprogress', 'completed'
        type: String,
        default: 'available'
    },
    assignees: [String],        // the users who need to complete the task
    parentTask: String,         // the parent taskID (only applicable if it is a subtask)
    dependencies: [String],     // tasks to be completed before the current can be marked in progress (taskIDs)
    createdBy: String           // the user who created the task (UUID)
}, {
    timestamps: true
});

const Task = mongoose.model('Task', TaskSchema);

module.exports = Task;
