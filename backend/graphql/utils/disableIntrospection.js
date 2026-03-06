const graphql = require('graphql');
module.exports = function NoIntrospection(context) {
    return {
        Field(node) {
            if (node.name.value === '__schema' || node.name.value === '__type') {
                context.reportError(new graphql.GraphQLError('GraphQL introspection is not allowed', [node]));
            }
        },
    };
};
