const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
var models_relationship = require('../models-relationship');

const SCHEMA_DIR = path.join(__dirname, '../schemas');
const OUTPUT_FILE = path.join(__dirname, '../../dist2/erd/schema.json');

function mapType(mType) {
  const map = {
    String: 'Text',
    Number: 'Int',
    Boolean: 'Boolean',
    Date: 'DateTime',
    ObjectId: 'ObjectId',
  };
  return map[mType] || 'Json';
}

function generate() {
  const schemaFiles = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.js'));

  const output = {
    tables: {},
  };

  for (const file of schemaFiles) {
    const fullPath = path.join(SCHEMA_DIR, file);
    const model = require(fullPath);

    if (!model?.modelName || !model?.schema) {
      continue;
    }

    const schema = model.schema;
    const modelName = model?.modelName;

    const table = {
      name: model?.modelName,
      columns: {},
      indexes: {},
      constraints: {},
      comment: model?.schema?.options?.description || null,
    };

    const primaryKey = 'id';
    let hasId = false;

    for (const [key, field] of Object.entries(schema.paths)) {
      if (key === '__v') continue;
      if (key === 'created_at') continue;
      if (key === 'updated_at') continue;

      const col = {
        name: key,
        type: mapType(field.instance),
        default:
          field.options && field.options.default != undefined ? (Array.isArray(field.options.default) ? 'Array' : field.options.default) : null,
        notNull: (field.options && field.options?.required) || false,
        comment: (field.options && field.options.description) || null,
        check: null,
      };

      if (key === '_id') {
        hasId = true;
        col.name = '_id';
        col.notNull = true;
        table.constraints[`PRIMARY_id`] = {
          type: 'PRIMARY KEY',
          name: 'PRIMARY_id',
          columnNames: ['_id'],
        };
        table.columns['_id'] = col;
        continue;
      }

      // unique
      if (field.options?.unique) {
        table.constraints[`UNIQUE_${key}`] = {
          type: 'UNIQUE',
          name: `UNIQUE_${key}`,
          columnNames: [key],
        };
      }

      // index
      if (field.options?.index) {
        table.indexes[`INDEX_${key}`] = {
          name: `INDEX_${key}`,
          unique: field.options?.unique || false,
          columns: [key],
          type: mapType(field.instance),
        };
      }

      for (let index = 0; index < models_relationship.length; index++) {
        const element = models_relationship[index];
        var t_element = element.split(':');
        if (t_element[0] == modelName && (t_element[3] == '_id' || t_element[3].endsWith('_CODE'))) {
          const constraintName = `${modelName}_To_${t_element[2]}`;
          table.constraints[constraintName] = {
            type: 'FOREIGN KEY',
            name: constraintName,
            columnName: t_element[1],
            targetTableName: t_element[2],
            targetColumnName: t_element[3].endsWith('_CODE') ? t_element[3] : '_id',
            updateConstraint: 'NO_ACTION',
            deleteConstraint: 'NO_ACTION',
          };
        } else if (t_element[2] == modelName && (t_element[1] == '_id' || t_element[1].endsWith('_CODE'))) {
          const constraintName = `${modelName}_To_${t_element[0]}`;
          table.constraints[constraintName] = {
            type: 'FOREIGN KEY',
            name: constraintName,
            columnName: t_element[3],
            targetTableName: t_element[0],
            targetColumnName: t_element[1].endsWith('_CODE') ? t_element[1] : '_id',
            updateConstraint: 'NO_ACTION',
            deleteConstraint: 'NO_ACTION',
          };
        }
      }
      table.columns[key] = col;
    }

    output.tables[modelName] = table;
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Erd Done`);
}

async function create_erd() {
  try {
    fs.rmSync(path.join(__dirname, '../../dist2/erd'), { recursive: true, force: true });

    // npx --yes @liam-hq/cli erd build --format prisma --input schema.prisma
    const result = spawnSync(
      'npx',
      [
        '--yes',
        '@liam-hq/cli',
        'erd',
        'build',
        '--format',
        'prisma',
        '--input',
        'schema.prisma',
        '--output-dir',
        path.join(__dirname, '../../dist2/erd'),
      ],
      {
        cwd: __dirname,
        shell: true,
        encoding: 'utf-8',
        stdio: 'pipe',
      }
    );

    if (result.error) {
      console.error('error erd:', result.error.message);
      return;
    }

    if (result.status !== 0) {
      console.error('error stderr erd:', result.stderr);
      return;
    }

    var files = fs.readdirSync(path.join(__dirname, '../../dist/erd/assets'));
    var targetFile = files.find((name) => /^index-.*\.css$/.test(name));
    if (!targetFile) {
      return;
    }
    console.log('css: ', targetFile);
    // var filePath = path.join(path.join(__dirname, '../../dist/erd/assets'), targetFile);
    // var content = fs.readFileSync(filePath, 'utf8');
    // content = content.replace('--default-header-height: 52px', '--default-header-height: 0px');
    // content += 'html body div#root div header{display: none}.react-flow__node-nonRelatedTableGroup{display: none}';
    // fs.writeFileSync(filePath, content, 'utf8');

    var files = fs.readdirSync(path.join(__dirname, '../../dist/erd/assets'));
    var targetFile = files.find((name) => /^index-.*\.js$/.test(name));
    if (!targetFile) {
      return;
    }
    console.log('js: ', targetFile);
    var filePath = path.join(path.join(__dirname, '../../dist/erd/assets'), targetFile);
    var content = fs.readFileSync(filePath, 'utf8');
    content = content.replace('fetch("./schema.json")', 'fetch("./erd/schema.json")');
    fs.writeFileSync(filePath, content, 'utf8');

    var filePath = path.join(path.join(__dirname, '../../dist/erd'), 'index.html');
    var content = fs.readFileSync(filePath, 'utf8');
    content = content.replaceAll('./assets/', './erd/assets/');
    fs.writeFileSync(filePath, content, 'utf8');

    generate();
  } catch (err) {
    console.error('ERD Error:', err.message);
  }
}

create_erd();