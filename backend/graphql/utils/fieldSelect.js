const { parse } = require('graphql');

function getRootFields(query) {
  try {
    const ast = parse(query);

    const operationDefinition = ast.definitions.find((def) => def.kind === 'OperationDefinition');
    if (!operationDefinition) {
      throw new Error('No operation definition found in the query.');
    }

    const rootFields = operationDefinition.selectionSet.selections.map((selection) => {
      if (selection.kind === 'Field') {
        return selection.name.value;
      }
    });

    return rootFields;
  } catch (error) {
    console.error('Error parsing query:', error.message);
    return [];
  }
}

module.exports = {
  fieldSelect: (info) => {
    const fieldselect = [];
    getSelect(info.fieldNodes[0].selectionSet.selections, fieldselect);
    return fieldselect;
  },
  rootFields: (query) => {
    return getRootFields(query);
  },
};

const isAnyUpper = (string) => /\p{Lu}/u.test(string);

const getSelect = (selections, fieldselect) => {
  if (
    selections.filter((selection) => {
      return selection.name.value == 'data';
    }).length > 0
  ) {
    for (let index = 0; index < selections.length; index++) {
      const selection = selections[index];
      if ((selection.name.value = 'data')) {
        getSelect(selection.selectionSet.selections, fieldselect);
      }
    }
  } else {
    for (let index = 0; index < selections.length; index++) {
      const selection = selections[index];
      if (!isAnyUpper(selection.name.value.slice(0, 1))) fieldselect.push(selection.name.value);
    }
  }
};
