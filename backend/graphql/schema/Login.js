const jws = require('jws');
const { DateTime } = require('luxon');
const { SECRET, SECRET_MASTER } = require('../../constants');
const hmacSHA512 = require('crypto-js/hmac-sha512');
const CryptoJS = require('crypto-js');
const { composeResolvers } = require('@graphql-tools/resolvers-composition');
const auth = require('../auth');
const { Users, UserMasters, BlockLoginAccess, Companies, RoleControl, Stores, LogLogin } = require('../../models');
const graphqlFields = require('../utils/graphql-fields');

const resolvers = {
  Query: {
    login: async (parent, args, context, info) => {
      const tenant = await Companies().findOneAndUpdate({ id_tenant: context.tenant }, args, { new: true }).lean();
      var UsersBlock = await BlockLoginAccess()
        .findOne({
          username: args.username,
          id_tenant: context.tenant,
        })
        .lean();
      if (
        tenant?.max_login > 0 &&
        UsersBlock?.count_time_login_fail >= tenant.max_login &&
        (tenant?.lockout_time > 0
          ? Math.abs(DateTime.fromSeconds(+UsersBlock.time_login).diffNow().toMillis()) / 60000 < tenant.lockout_time
          : true)
      ) {
        log_login(args.username, context, 'failed');
        throw new Error('error_login_102,Too many failed login');
      } else {
        var data = await Users(context.tenant)
          .findOne({
            username: args.username,
            is_lock: { $ne: true },
            is_delete: { $ne: true },
          })
          .lean();
        if (data !== null && !data.is_delete) {
          token = null;
          if (hmacSHA512(args.password, SECRET.SECRET_PASS + context.tenant) == data.password) {
            const infoQuery = graphqlFields(info);
            var salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
            var client_secret = hmacSHA512(salt, SECRET.SECRET_PASS + context.tenant).toString();
            const result = await Users(context.tenant)
              .findByIdAndUpdate(
                { _id: data._id },
                {
                  status: 1,
                  client_secret: infoQuery?.client_secret ? client_secret : undefined,
                },
                { new: true }
              )
              .lean();

            const roleControl = await RoleControl(context.tenant)
              .findOne({ _id: result?.id_role, is_delete: { $ne: true } })
              .lean();
            delete result.password;
            delete result.client_secret;
            delete result.created_at;
            delete result.updated_at;
            delete result.__v;

            const store = await Stores(context.tenant).findOne({ code_store: data?.code_store }).lean();

            if (!data.is_super_admin) {
              if (info.fieldNodes[0]?.alias?.value?.includes('mobi_') ? roleControl.mode_sigin == 1 : roleControl.mode_sigin == 2) {
                log_login(args.username, context, 'mobi_failed');
                throw new Error('not permission device!');
              }
            }

            token = jws.sign({
              header: { alg: 'HS256' },
              payload: {
                iat: DateTime.now().toSeconds(),
                exp: DateTime.now().plus({ hours: 12 }).toSeconds(),
                data: {
                  ...result,
                  arr_role: roleControl?.arr_role,
                  is_admin: roleControl?.is_admin ?? false,
                  code_headquarter: store ? store.code_headquarter : data?.code_headquarter,
                },
              },
              secret: SECRET.SECRET_TOKEN + context.tenant,
            });
            await BlockLoginAccess().deleteMany({ username: args.username, id_tenant: context.tenant });
            log_login(args.username, context, token);
            return { token: token, client_secret: salt, data: data };
          }
          var timeBlock = 0;
          if (tenant?.max_login > 0 && data.is_super_admin != true) {
            if (UsersBlock?.count_time_login_fail < tenant.max_login) {
              timeBlock = UsersBlock.count_time_login_fail + 1;
            } else {
              timeBlock = 1;
            }
            await BlockLoginAccess()
              .updateOne(
                {
                  username: args.username,
                  id_tenant: context.tenant,
                },
                {
                  time_login: DateTime.now().toSeconds(),
                  count_time_login_fail: timeBlock,
                },
                { upsert: true }
              )
              .lean();
          }
        } else {
          log_login(args.username, context, 'failed');
          throw new Error('error_login_101');
        }
        log_login(args.username, context, 'failed');
        throw new Error(['error_login_100', timeBlock, timeBlock == 0 ? 0 : tenant.max_login]);
      }
    },
    reset_token: async (parent, args, context) => {
      var client_secret = hmacSHA512(args.client_secret, SECRET.SECRET_PASS + context.tenant).toString();
      var data = await Users(context.tenant)
        .findOne({
          username: args.username,
        })
        .lean();
      if (data !== null && !data.is_delete && data.client_secret == client_secret) {
        delete data.password;
        delete data.client_secret;
        delete data.created_at;
        delete data.updated_at;
        delete data.__v;
        token = jws.sign({
          header: { alg: 'HS256' },
          payload: {
            iat: DateTime.now().toSeconds(),
            exp: DateTime.now().plus({ hours: args?.bio ? 12 : 1 }).toSeconds(),
            data: data,
          },
          secret: SECRET.SECRET_TOKEN + context.tenant,
        });
        return { token: token, client_secret: args.client_secret, data: data };
      }
      throw new Error('Reset token fail');
    },
    LoginMaster: async (parent, args, context) => {
      var data = await UserMasters()
        .findOne({
          username: args.username,
        })
        .lean();
      if (data !== null && !data.is_delete) {
        token = null;
        if (hmacSHA512(args.password, SECRET_MASTER.SECRET_PASS) == data.password) {
          const result = await UserMasters().findByIdAndUpdate({ _id: data._id }, { status: 1 }, { new: true }).lean();
          delete result.password;
          delete result.client_secret;
          delete result.created_at;
          delete result.updated_at;
          delete result.__v;

          token = jws.sign({
            header: { alg: 'HS256' },
            payload: {
              iat: DateTime.now().toSeconds(),
              exp: DateTime.now().plus({ hours: 1 }).toSeconds(),
              data: result,
            },
            secret: SECRET_MASTER.SECRET_TOKEN,
          });
          return { token: token, data: data };
        } else {
          throw new Error('login fail');
        }
      } else {
        throw new Error('login fail');
      }
    },
    SetingAdministrator: async (parent, args, context) => {
      const tenant = await Companies().findOne({ id_tenant: context.tenant }).lean();
      return tenant;
    },
    check_password: async (parent, args, context) => {
      const _user = context.payload.data;
      var data = await Users(context.tenant)
        .findOne({
          username: _user.username,
        })
        .lean();
      if (data !== null && !data.is_delete && hmacSHA512(args.password, SECRET.SECRET_PASS + context.tenant) == data.password) {
        return true;
      }
      return false;
    },
  },
  login: {
    change_password: async (parent, args, context) => {
      if (!parent?.data?.is_super_admin) {
        const tenant = await Companies().findOne({ id_tenant: context.tenant }).lean();
        if (
          tenant.password_expire &&
          tenant.password_expire > 0 &&
          parent.data.password_date &&
          Math.abs(DateTime.fromSeconds(+parent.data.password_date).diffNow().toMillis()) / 86400000 >= tenant.password_expire
        ) {
          return true;
        }
      }
      return false;
    },
    data_change_password: async (parent, args, context) => {
      if (!parent?.data?.is_super_admin) {
        const tenant = await Companies().findOne({ id_tenant: context.tenant }).lean();
        if (tenant.password_expire && tenant.password_expire > 0 && parent.data.password_date) {
          return DateTime.fromSeconds(+parent.data.password_date + tenant.password_expire * 86400).toMillis();
        }
      }
      return 0;
    },
  },

  Mutation: {
    SetingAdministrator_update: async (parent, args, context) => {
      const tenant = await Companies().findOneAndUpdate({ id_tenant: context.tenant }, args, { new: true }).lean();
      return tenant;
    },
  },
};
async function log_login(username, context, acess_token) {
  var LogLogins = LogLogin(context.tenant);
  const logLogin = new LogLogins({
    username: username,
    ip: context.remoteAddress,
    acess_token: acess_token,
    headers: context.reqHeaders,
    time: DateTime.now().toSeconds(),
  });
  await logLogin.save();
}

const resolversComposition = {
  'Query.login': [auth.check_tenant()],
  'Query.reset_token': [auth.check_tenant()],
  'Query.SetingAdministrator': [auth.check_tenant()],
  'Query.check_password': [auth.check_tenant(), auth.authentication()],
  'Mutation.SetingAdministrator_update': [auth.check_tenant(), auth.authentication(), auth.authorization()],
};

module.exports = composeResolvers(resolvers, resolversComposition);
