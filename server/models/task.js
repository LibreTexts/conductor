//
// LibreTexts Conductor
// project.js
// Mongoose Model
//

import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
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
    assignees: {                // the users who need to complete the task
        type: [String],
        default: []
    },
    parent: String,             // the parent taskID (only applicable if it is a subtask)
    dependencies: {             // tasks to be completed before the current can be marked in progress (taskIDs)
        type: [String],
        default: []
    },
    startDate: String,          // the day the task is scheduled to start
    endDate: String,            // the day the task is scheduled to end or is due on
    createdBy: String           // the user who created the task (UUID)
}, {
    timestamps: true
});

const Task = mongoose.model('Task', TaskSchema);

export default Task;
