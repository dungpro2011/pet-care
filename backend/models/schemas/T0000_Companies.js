var mongoose = require('mongoose');

var schema = new mongoose.Schema(
    {
        key: {
            type: String,
        },
        id_tenant: {
            type: String,
        },
        code_company: {
            type: String,
        },
        name_company: {
            type: String,
        },
        address: {
            type: String,
        },
        tax_code: {
            type: String,
        },
        note: {
            type: String,
        },
        is_delete: {
            type: Boolean,
            default: false,
        },
        password_expire: {
            type: Number,
            default: 0,
        },
        max_login: {
            type: Number,
            default: 0,
        },
        lockout_time: {
            type: Number,
            default: 5,
        },
        is_complex_password: {
            type: Number,
            default: 0,
        },
        password_length: {
            type: Number,
            default: 5,
        },
        password_old: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    }
);

module.exports = schema;
