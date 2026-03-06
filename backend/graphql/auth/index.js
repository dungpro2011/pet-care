const jws = require('jws');
var { DateTime } = require('luxon');
const flatCache = require('flat-cache');
const {
    SECRET,
    SECRET_MASTER,
} = require('../../constants');
const { Companies, RoleControl } = require('../../models');

const cache = flatCache.create({
    ttl: 60 * 60 * 1000, // 1 hour
    lruSize: 10000, // 10,000 items
    expirationInterval: 5 * 1000 * 60, // 5 minutes
    persistInterval: 5 * 1000 * 60, // 5 minutes
});

module.exports = {
    authentication: () => (next) => async (root, args, context, info) => {
        try {
            if (jws.verify(context.token, 'HS256', SECRET.SECRET_TOKEN + context.tenant)) {
                if (DateTime.fromSeconds(context.payload.exp) >= DateTime.local()) {
                    return next(root, args, context, info);
                }
            }
        } catch { }
        throw new Error('You are not authenticated!');
    },
    authentication_master: () => (next) => async (root, args, context, info) => {
        try {
            if (jws.verify(context.token, 'HS256', SECRET_MASTER.SECRET_TOKEN)) {
                if (DateTime.fromSeconds(context.payload.exp) >= DateTime.local()) {
                    return next(root, args, context, info);
                }
            }
        } catch { }
        throw new Error('You are not authentication_master!');
    },
    check_tenant: () => (next) => async (root, args, context, info) => {
        const tenant = await Companies().findOne({ id_tenant: context.tenant }).lean();
        if (tenant) {
            return next(root, args, context, info);
        }
        throw new Error('tenant not exist');
    },
    authorization: (key) => (next) => async (root, args, context, info) => {
        const user = context?.payload?.data;
        var roleCache = undefined;
        if (user.id_role) {
            roleCache = cache.get(user.id_role);
            if (!roleCache) {
                const roleControl = await RoleControl(context.tenant)
                    .findOne({ _id: user.id_role, is_delete: { $ne: true } })
                    .lean();
                cache.set(user.id_role, roleControl);
                roleCache = roleControl;
            }
        }
        if (user?.is_super_admin || roleCache.is_admin) {
            context.role_read = 0;
            context.role_edit = 0;
            context.role_detele = 0;
            return next(root, args, context, info);
        }
        const formatData = (key) => {
            const role = roleCache.arr_role.find((el) => el.key == key);

            context.role_read = role.type_control.read ? role.permission_read : -1;
            context.role_edit = role.type_control.write ? role.permission : -1;
            context.role_detele = role.type_control.delete ? role.permission : -1;

            if (info.path.typename == 'Query') {
                if (role.type_control.read) {
                    return next(root, args, context, info);
                }
            }

            if (info.path.typename == 'Mutation') {
                if (info.fieldName == 'User_update' && user?._id == args?._id) {
                    return next(root, args, context, info);
                }
                if ((info.fieldName.includes('create') || info.fieldName.includes('update')) && role.type_control.write) {
                    return next(root, args, context, info);
                }
                if (info.fieldName.includes('delete') && role.type_control.delete) {
                    return next(root, args, context, info);
                }
            }

            throw new Error('You are not permission!');
        };

        switch (key) {
            case MANAGER_STAGE:
                return formatData(key);
            case MANAGER_HEADQUARTER:
                return formatData(key);
            case MANAGER_STORE:
                return formatData(key);
            case MANAGER_ORG:
                return formatData(key);
            case MANAGER_USER:
                return formatData(key);
            case MANAGER_CAR:
                return formatData(key);
            default:
                throw new Error('You are not permission!');
        }
    },
    authorizationClear: () => (next) => async (root, args, context, info) => {
        cache.clear();
        return next(root, args, context, info);
    },
};
