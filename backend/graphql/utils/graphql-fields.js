const getSelections = (ast) => {
    if (ast && ast.selectionSet && ast.selectionSet.selections && ast.selectionSet.selections.length) {
        return ast.selectionSet.selections;
    }

    return [];
};

const isFragment = (ast) => {
    return ast.kind === 'InlineFragment' || ast.kind === 'FragmentSpread';
};

const getAST = (ast, info) => {
    if (ast.kind === 'FragmentSpread') {
        const fragmentName = ast.name.value;
        return info.fragments[fragmentName];
    }
    return ast;
};

const getArguments = (ast, info) => {
    return ast.arguments.map((argument) => {
        const argumentValue = getArgumentValue(argument.value, info);

        return {
            [argument.name.value]: {
                kind: argument.value.kind,
                value: argumentValue,
            },
        };
    });
};

const getArgumentValue = (arg, info) => {
    switch (arg.kind) {
        case 'FloatValue':
            return parseFloat(arg.value);
        case 'IntValue':
            return parseInt(arg.value, 10);
        case 'Variable':
            return info.variableValues[arg.name.value];
        case 'ListValue':
            return arg.values.map((argument) => getArgumentValue(argument, info));
        case 'ObjectValue':
            return arg.fields.reduce((argValue, objectField) => {
                argValue[objectField.name.value] = getArgumentValue(objectField.value, info);
                return argValue;
            }, {});
        default:
            return arg.value;
    }
};

const getDirectiveValue = (directive, info) => {
    const arg = directive.arguments[0];
    if (arg.value.kind !== 'Variable') {
        return !!arg.value.value;
    }
    return info.variableValues[arg.value.name.value];
};

const getDirectiveResults = (ast, info) => {
    const directiveResult = {
        shouldInclude: true,
        shouldSkip: false,
    };
    return ast.directives.reduce((result, directive) => {
        switch (directive.name.value) {
            case 'include':
                return { ...result, shouldInclude: getDirectiveValue(directive, info) };
            case 'skip':
                return { ...result, shouldSkip: getDirectiveValue(directive, info) };
            default:
                return result;
        }
    }, directiveResult);
};

const flattenAST = (ast, info, obj) => {
    obj = obj || {};
    return getSelections(ast).reduce((flattened, a) => {
        if (a.directives && a.directives.length) {
            const { shouldInclude, shouldSkip } = getDirectiveResults(a, info);
            if (shouldSkip || !shouldInclude) {
                return flattened;
            }
        }
        if (isFragment(a)) {
            flattened = flattenAST(getAST(a, info), info, flattened);
        } else {
            const name = a.name.value;
            if (flattened[name] && flattened[name] !== '__arguments') {
                Object.assign(flattened[name], flattenAST(a, info, flattened[name]));
            } else {
                flattened[name] = flattenAST(a, info);
            }
            if (a.arguments && a.arguments.length) {
                Object.assign(flattened[name], { __arguments: getArguments(a, info) });
            }
        }

        return flattened;
    }, obj);
};

module.exports = (info) => {
    const fields = info.fieldNodes || info.fieldASTs;
    return fields.reduce((o, ast) => {
        return flattenAST(ast, info, o);
    }, {});
};
