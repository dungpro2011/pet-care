var mongoose = require("mongoose");

var schema = new mongoose.Schema(
  {
    username: {
      type: String,
    },
    time_login: {
      type: mongoose.Types.Decimal128,
      default: 0,
    },
    count_time_login_fail: {
      type: Number,
      default: 0,
    },
    id_tenant: {
      type: String,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  { versionKey: false }
);

module.exports = schema;