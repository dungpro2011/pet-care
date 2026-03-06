const { GraphQLScalarType, Kind } = require('graphql');

const resolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    serialize(value) {
      if (value instanceof Date) {
        if (validateJSDate(value)) {
          return value;
        }
        throw new TypeError('DateTime cannot represent an invalid Date instance');
      } else if (typeof value === 'string') {
        if (validateDateTime(value)) {
          return parseDateTime(value);
        }
        throw new TypeError(`DateTime cannot represent an invalid date-time-string ${value}.`);
      } else if (typeof value === 'number') {
        try {
          return new Date(value);
        } catch (e) {
          throw new TypeError('DateTime cannot represent an invalid Unix timestamp ' + value);
        }
      } else {
        throw new TypeError('DateTime cannot be serialized from a non string, ' + 'non numeric or non Date type ' + JSON.stringify(value));
      }
    },
    parseValue(value) {
      if (value instanceof Date) {
        if (validateJSDate(value)) {
          return value;
        }
        throw new TypeError('DateTime cannot represent an invalid Date instance');
      }
      if (typeof value === 'string') {
        if (validateDateTime(value)) {
          return parseDateTime(value);
        }
        throw new TypeError(`DateTime cannot represent an invalid date-time-string ${value}.`);
      }
      throw new TypeError(`DateTime cannot represent non string or Date type ${JSON.stringify(value)}`);
    },
    parseLiteral(ast) {
      if (ast.kind !== Kind.STRING) {
        throw new TypeError(`DateTime cannot represent non string or Date type ${'value' in ast && ast.value}`);
      }
      const { value } = ast;
      if (validateDateTime(value)) {
        return parseDateTime(value);
      }
      throw new TypeError(`DateTime cannot represent an invalid date-time-string ${String(value)}.`);
    },
  }),
  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'The `JSON` scalar type represents JSON values as specified by [ECMA-404]',
    serialize: (value) => {
      return value;
    },
    parseValue: (value) => {
      return value;
    },
    parseLiteral: (ast, variables) => parseLiteralObject('JSON', ast, variables),
  }),
  Float: new GraphQLScalarType({
    name: 'Float',
    description: 'FLOAT custom scalar type',
    serialize: (value) => {
      return parseFloat(value);
    },
    parseValue: (value) => {
      return parseFloat(value);
    },
    parseLiteral: (ast) => {
      return parseFloat(ast.value);
    },
  }),
  Any: new GraphQLScalarType({
    name: 'Any',
    description: 'Any value',
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral: (ast) => {
      return parseAny(ast);
    },
  }),
};

module.exports = resolvers;

const parseAny = (ast) => {
  switch (ast.kind) {
    case Kind.BOOLEAN:
    case Kind.STRING:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.LIST:
      return ast.values.map(parseAny);
    case Kind.OBJECT:
      return ast.fields.reduce((accumulator, field) => {
        accumulator[field.name.value] = parseAny(field.value);
        return accumulator;
      }, {});
    case Kind.NULL:
      return null;
    default:
      throw new Error(`Unexpected kind in parseAny: ${ast.kind}`);
  }
};

////-------------- Date ----------------

const validateDateTime = (dateTimeString) => {
  dateTimeString = dateTimeString?.toUpperCase();
  const RFC_3339_REGEX =
    /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60))(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/;

  if (!RFC_3339_REGEX.test(dateTimeString)) {
    return false;
  }
  const time = Date.parse(dateTimeString);
  if (time !== time) {
    return false;
  }
  const index = dateTimeString.indexOf('T');
  const dateString = dateTimeString.substr(0, index);
  const timeString = dateTimeString.substr(index + 1);
  return validateDate(dateString) && validateTime(timeString);
};

const validateTime = (time) => {
  time = time?.toUpperCase();
  const TIME_REGEX = /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/;
  return TIME_REGEX.test(time);
};

const validateDate = (datestring) => {
  const RFC_3339_REGEX = /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/;

  if (!RFC_3339_REGEX.test(datestring)) {
    return false;
  }

  const year = Number(datestring.substr(0, 4));
  const month = Number(datestring.substr(5, 2));
  const day = Number(datestring.substr(8, 2));

  switch (month) {
    case 2:
      if (leapYear(year) && day > 29) {
        return false;
      } else if (!leapYear(year) && day > 28) {
        return false;
      }
      return true;
    case 4:
    case 6:
    case 9:
    case 11:
      if (day > 30) {
        return false;
      }
      return true;
    default:
      if (day > 31) return false;
  }
  return true;
};

const validateJSDate = (date) => {
  const time = date.getTime();
  return time === time;
};

const parseDateTime = (dateTime) => {
  return new Date(dateTime);
};

const leapYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

////-------------- JSON ----------------

function parseObject(typeName, ast, variables) {
  const value = Object.create(null);
  ast.fields.forEach((field) => {
    value[field.name.value] = parseLiteralObject(typeName, field.value, variables);
  });

  return value;
}

function parseLiteralObject(typeName, ast, variables) {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.OBJECT:
      return parseObject(typeName, ast, variables);
    case Kind.LIST:
      return ast.values.map((n) => parseLiteralObject(typeName, n, variables));
    case Kind.NULL:
      return null;
    case Kind.VARIABLE:
      return variables ? variables[ast.name.value] : undefined;
    default:
      throw new TypeError(`${typeName} cannot represent value: ${print(ast)}`);
  }
}
