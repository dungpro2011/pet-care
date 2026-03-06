var mongoose = require('mongoose');

var schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Thông tin người dùng đăng nhập (object)',
    },
    username: {
      type: String,
      default: '',
      description: 'Tên đăng nhập của người dùng',
    },
    type: {
      type: String,
      default: '',
      description: 'Loại người dùng (ví dụ: admin, staff, customer...)',
    },
    acess_token: {
      type: String,
      default: '',
      description: 'Access token được cấp khi đăng nhập',
    },
    user_ip: {
      type: String,
      default: '',
      description: 'Địa chỉ IP của người dùng khi đăng nhập',
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Thông tin header gửi lên (User-Agent, platform, etc)',
    },
    time: {
      type: String,
      default: '',
      description: 'Thời gian người dùng đăng nhập',
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
schema.set('description', 'Nhật ký đăng nhập của người dùng');

module.exports = schema;
