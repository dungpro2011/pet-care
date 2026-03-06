var mongoose = require('mongoose');

var schema = new mongoose.Schema(
  {
    user_details: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
      description: 'Thông tin người dùng gọi API',
    },
    query: {
      type: String,
      default: '',
      description: 'Câu truy vấn GraphQL hoặc endpoint API được gọi',
    },
    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
      description: 'Biến đầu vào gửi kèm trong truy vấn',
    },
    error: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Thông tin lỗi trả về (nếu có)',
    },
    ip: {
      type: String,
      default: '',
      description: 'Địa chỉ IP của client gọi API',
    },
    time: {
      type: String,
      default: '',
      description: 'Thời gian thực hiện truy vấn',
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Thông tin HTTP headers từ client',
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Kết quả phản hồi của server',
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
schema.set('description', 'Nhật ký truy vấn API của người dùng');

module.exports = schema;
