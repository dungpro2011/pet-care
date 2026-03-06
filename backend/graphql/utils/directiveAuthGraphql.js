const { defaultFieldResolver } = require('graphql');
const { getDirective, MapperKind, mapSchema } = require('@graphql-tools/utils');

const directiveAuthGraphql = (schema) => {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig) {
      const directive = getDirective(schema, fieldConfig, 'auth')?.[0];
      if (directive) {
        const { level } = directive;
        if (level) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          fieldConfig.resolve = function (source, args, context, info) {
            const _user = context?.payload?.data;
            var role_level_user = 30;

            if (_user?.T1001_SUPER_ADMIN) {
              role_level_user = 0;
            } else if (_user?.T1001_ROLE == 'ADMIN') {
              role_level_user = 10;
            } else if (_user?.T1001_ROLE == 'MANAGER') {
              role_level_user = 20;
            }

            if (level >= role_level_user) {
              return resolve(source, args, context, info);
            } else {
              throw new Error('You are not permission!');
            }
          };
          return fieldConfig;
        }
      }
    },
  });
};
module.exports = directiveAuthGraphql;
