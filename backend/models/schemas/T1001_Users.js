var mongoose = require('mongoose');

var schema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: '',
      description: 'mã người dùng',
    },
    username: {
      type: String,
      default: '',
      description: 'tài khoản người dùng',
    },
    password: {
      type: String,
      default: '',
      description: 'mật khẩu người dùng',
    },
    full_name: {
      type: String,
      default: '',
      description: 'họ tên người dùng',
    },
    mail: {
      type: String,
      default: '',
      description: 'mail người dùng',
    },
    phone: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
      description: 'phone người dùng',
    },
    avatar: {
      type: String,
      default: '',
      description: 'ảnh đại diện',
    },
    infor: {
      type: Object,
      description: 'Thông tin người dùng',
    },
    role: {
      type: String,
      enum: ['MANAGER', 'STAFF'],
      default: 'STAFF',
      description: 'phân quyền người dùng',
    },
    super_admin: {
      type: Boolean,
      default: false,
      description: 'người dùng có quyền cao nhất (duy nhất 1 tài khoản)',
    },
    is_delete: {
      type: Boolean,
      default: false,
      description: 'xoá người dùng',
    },
    is_display: {
      type: Boolean,
      default: false,
      description: 'khoá người dùng',
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
schema.set('description', 'Thông tin USER');

module.exports = schema;
