const auth = require('../auth');
const { SECRET } = require('../../constants');
const hmacSHA512 = require('crypto-js/hmac-sha512');
const { selects } = require('../utils/selectGraphql');
const { composeResolvers } = require('@graphql-tools/resolvers-composition');
const T1001_Users = require('../../models/schemas/T1001_Users');

const resolvers = {
  Query: {
    Users: async (parent, args, context) => {
      return selects({
        model: T1001_Users,
        args,
        find_required: { T1001_IS_DELETE: { $ne: true }, T1001_SUPER_ADMIN: { $ne: true } },
      });
    },
    User: async (parent, args, context) => {
      const userId = context.payload?.data?._id;

      const data = await T1001_Users.findById(userId).lean();
      if (data) {
        return data;
      } else {
        throw new Error('Get data failed!!!');
      }
    },
  },
  User: {
    FILE_AVATAR: async (parent, args, context) => {
      if (!parent?.T1001_AVATAR) return null;

      const data = await UploadFiles.findById(parent?.T1001_AVATAR).lean();
      if (data) {
        return data;
      } else {
        return null;
      }
    },
  },

  Mutation: {
    User_create: async (parent, args, context) => {
      const codeStore = context.payload?.data?.T1001_CODE_STORE;
      const user = await T1001_Users.findOne({
        T1001_USERNAME: args.T1001_USERNAME,
      }).lean();

      if (user !== null) {
        throw new Error('User already exists');
      } else {
        if (args.T1001_PASSWORD) {
          args.T1001_PASSWORD = hmacSHA512(args.T1001_PASSWORD, SECRET.SECRET_PASS).toString();
        }
        var data = new T1001_Users({ ...args, ...(codeStore ? { T1001_CODE_STORE: codeStore } : {}) });
        await data.save();
        if (data) {
          return data;
        } else {
          throw new Error('Create failed');
        }
      }
    },
    User_update: async (parent, args, context) => {
      const user = await T1001_Users.findOne({
        T1001_USERNAME: args.T1001_USERNAME,
      }).lean();

      if (!user) {
        throw new Error('User not found');
      }

      // Kiểm tra mật khẩu cũ nếu có mật khẩu mới
      if (args.T1001_PASSWORD) {
        if (!args.T1001_OLD_PASSWORD) {
          throw new Error('error_user_105');
        }

        const hashedOldPassword = hmacSHA512(args.T1001_OLD_PASSWORD, SECRET.SECRET_PASS).toString();
        if (hashedOldPassword !== user.T1001_PASSWORD) {
          throw new Error('error_user_104');
        }

        // Băm và kiểm tra mật khẩu mới
        const hashedNewPassword = hmacSHA512(args.T1001_PASSWORD, SECRET.SECRET_PASS).toString();
        if (hashedNewPassword === user.T1001_PASSWORD) {
          throw new Error('error_user_102');
        }
        args.T1001_PASSWORD = hashedNewPassword;
      }

      const checkRole =
        args?.T1001_ROLE == 'ADMIN'
          ? { T1001_ID_BRANCH: '', T1001_ID_STORE: '' }
          : args?.T1001_ROLE == 'MANAGER'
            ? {
              T1001_ID_BRANCH: '',
            }
            : {};

      const result = await T1001_Users.findByIdAndUpdate(args._id, { ...args, ...checkRole }, { new: true }).lean();
      if (result) {
        return result;
      } else {
        throw new Error('Update failed');
      }
    },
    User_admin_update: async (parent, args, context) => {
      const checkRole =
        args?.T1001_ROLE == 'ADMIN'
          ? {
            // T1001_ID_BRANCH: '',
            // T1001_ID_STORE: ''
          }
          : args?.T1001_ROLE == 'MANAGER'
            ? {
              // T1001_ID_BRANCH: '',
            }
            : {};

      if (args.T1001_PASSWORD) {
        args.T1001_PASSWORD = hmacSHA512(args.T1001_PASSWORD, SECRET.SECRET_PASS).toString();
      }
      const result = await T1001_Users.findByIdAndUpdate(args._id, { ...args, ...checkRole }, { new: true }).lean();
      if (result) {
        return result;
      } else {
        throw new Error('Update failed');
      }
    },
    User_delete: async (parent, args, context) => {
      var result = await T1001_Users.findByIdAndUpdate(args._id, { T1001_IS_DELETE: true }, { new: true }).lean();
      if (result) {
        return true;
      } else {
        throw new Error('Delete failed');
      }
    },
  },
};

const resolversComposition = {
  'Query.Users': [auth.authentication()],
  'Query.User': [auth.authentication()],
  'Mutation.User_create': [auth.authentication(), auth.authorization(20)],
  'Mutation.User_update': [auth.authentication(), auth.authorization(20)],
  'Mutation.User_admin_update': [auth.authentication(), auth.authorization(20)],
  'Mutation.User_delete': [auth.authentication(), auth.authorization(20)],
};

module.exports = composeResolvers(resolvers, resolversComposition);
