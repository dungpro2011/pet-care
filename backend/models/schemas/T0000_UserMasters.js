var mongoose = require('mongoose');

var schema = new mongoose.Schema(
    {
        username: {
            type: String,
            index: true,
        },
        password: {
            type: String,
        },
        full_name: {
            type: String,
        },
        is_lock: {
            type: Boolean,
            default: false,
        },
        is_delete: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    { versionKey: false }
);

module.exports = schema;
