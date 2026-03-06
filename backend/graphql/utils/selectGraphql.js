var qs = require('qs');
var models_relationship = require('../../models/models-relationship');

// string find
// qs.stringify({$or:[{is_admin:false},{username:"sadmin"}]},{encodeValuesOnly: true})
// $or[0][is_admin]=false&$or[1][username]=RegExp:sadmin
// $or[0][code]=RegExp:${key}:i,$or[1][name]=RegExp:${key}:i

module.exports = {
  selects: async ({ model, args, find_required = undefined, aggregate = undefined, aggregate_final = [] }) => {
    var search,
      find,
      skip,
      limit,
      sort = undefined;
    var total = 0;

    if (args && args.select) {
      search = args.select.search;
      find = args.select.find;
      skip = args.select.skip;
      limit = args.select.limit;
      if (typeof args.select.sort == 'string') {
        // sort = qsParse(args.select.sort);
        sort = args.select.sort.split(',').reduce((acc, key) => {
          if (key.indexOf('-') == 0) {
            return { ...acc, [key.slice(1)]: -1 };
          } else {
            return { ...acc, [key]: 1 };
          }
        }, {});
      } else {
        sort = args.select.sort;
      }
    }

    delete args.select;

    if (search) {
      search = {
        $text: {
          $search: search,
        },
      };
    }

    if (find) {
      find = qsParse(find);
    }

    var all_keys_loopup = [];
    var fields = getAllKeys(model.schema.obj);
    get_keys_in_bson(find, all_keys_loopup, fields);
    var loopupfind = addloopupfind(all_keys_loopup, model.modelName.toLowerCase());
    var match = {
      $and: [search, find, args, find_required].filter(Boolean),
    };
    match = flattenQuery(match);

    if (
      (aggregate && Array.isArray(aggregate) && aggregate.length > 0) ||
      all_keys_loopup.length > 0 ||
      (aggregate_final && Array.isArray(aggregate_final) && aggregate_final.length > 0)
    ) {
      var basePipeline = [];
      if (aggregate != undefined) {
        basePipeline = basePipeline.concat(aggregate);
      }
      if (loopupfind?.length > 0) {
        for (const loop of loopupfind) {
          basePipeline = basePipeline.concat(loop);
        }
      }

      const totalPipeline = basePipeline.concat([{ $match: match }, { $count: 'count' }]).filter(Boolean);

      const totalResult = await model.aggregate(totalPipeline).exec();
      total = totalResult?.[0]?.count || 0;

      const dataPipeline = basePipeline
        .concat(
          [{ $match: match }],
          sort ? [{ $sort: sort }] : [],
          skip ? [{ $skip: skip }] : [],
          [{ $limit: limit || 500 }],
          aggregate_final || []
        )
        .filter(Boolean);

      const data = await model.aggregate(dataPipeline).exec();

      return { data, total };
    } else {
      var query = model.find(match);
      total = await model.countDocuments(match);
      if (skip) {
        query.skip(skip);
      }
      if (limit) {
        query.limit(limit);
      }
      if (sort) {
        query.sort(sort);
      }
      var data = await query.collation({ locale: 'vi', strength: 1 }).lean();
      return { data: data, total: total };
    }
  },
  qsfind: (qs_find = undefined) => {
    var str = qs.stringify(qs_find, { encodeValuesOnly: true });
    return decodeURIComponent(str);
  },
  qsParse: (qs_Parse = undefined) => {
    return qsParse(qs_Parse);
  },
};

function HasKeyObj(entireObj, valToFind) {
  if (valToFind) {
    let listKey = new Set();
    JSON.stringify(entireObj, (_, nestedValue) => {
      if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
        Object.keys(nestedValue).forEach((element) => {
          if (element && element.indexOf('$') < 0) listKey.add(element);
        });
      }
      return nestedValue;
    });
    return Array.from(listKey).every((everyValue) => valToFind.some((someValue) => someValue == everyValue));
  } else {
    return true;
  }
}

const addloopupfind = (all_keys, modelName) => {
  var akeys = [];
  for (let index = 0; index < all_keys.length; index++) {
    const element = all_keys[index].split('.')[0];
    if (!akeys.includes(element)) {
      akeys.push(element);
    }
  }
  if (akeys.length > 0) {
    var loopup = [];
    for (let index = 0; index < akeys.length; index++) {
      models_relationship.forEach((v) => {
        var relationship = v.split(':');
        var key = akeys[index].split('.')[0];
        var as_key = key;
        var relationship_length = 4;

        var field_project = {};
        for (let index = 0; index < all_keys.length; index++) {
          const element = all_keys[index].split('.');
          if (!field_project.hasOwnProperty(element[1]) && element[0] == key) {
            const find_field = element.slice(1).join('.');
            field_project[find_field] = 1;
          }
        }
        if (relationship.length == 6 && relationship[5] == key) {
          as_key = relationship[5];
          key = relationship[2];
          relationship_length = 6;
        } else if (relationship.length == 6 && relationship[4] == key) {
          as_key = relationship[4];
          key = relationship[0];
          relationship_length = 6;
        }

        if (relationship.length == relationship_length && relationship[0] == modelName && relationship[2] == key) {
          if (relationship[3] == '_id') {
            loopup.push({
              $lookup: {
                from: key,
                let: {
                  oId: {
                    $convert: {
                      input: '$' + relationship[1],
                      to: 'objectId',
                      onError: null,
                      onNull: null,
                    },
                  },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', '$$oId'],
                      },
                    },
                  },
                  {
                    $project: field_project,
                  },
                ],
                as: as_key,
              },
            });
          } else if (relationship[1] == '_id') {
            loopup.push({
              $lookup: {
                from: key,
                let: {
                  sId: {
                    $toString: '$_id',
                  },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$' + relationship[3], '$$sId'],
                      },
                    },
                  },
                  {
                    $project: field_project,
                  },
                ],
                as: as_key,
              },
            });
          } else {
            loopup.push({
              $lookup: {
                from: key,
                localField: relationship[1],
                foreignField: relationship[3],
                as: as_key,
                pipeline: [
                  {
                    $project: field_project,
                  },
                ],
              },
            });
          }
        } else if (relationship.length == relationship_length && relationship[0] == key && relationship[2] == modelName) {
          if (relationship[1] == '_id') {
            loopup.push({
              $lookup: {
                from: key,
                let: {
                  oId: {
                    $convert: {
                      input: '$' + relationship[3],
                      to: 'objectId',
                      onError: null,
                      onNull: null,
                    },
                  },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', '$$oId'],
                      },
                    },
                  },
                  {
                    $project: field_project,
                  },
                ],
                as: as_key,
              },
            });
          } else if (relationship[3] == '_id') {
            loopup.push({
              $lookup: {
                from: key,
                let: {
                  sId: {
                    $toString: '$_id',
                  },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$' + relationship[1], '$$sId'],
                      },
                    },
                  },
                  {
                    $project: field_project,
                  },
                ],
                as: as_key,
              },
            });
          } else {
            loopup.push({
              $lookup: {
                from: key,
                localField: relationship[1],
                foreignField: relationship[3],
                as: as_key,
                pipeline: [
                  {
                    $project: field_project,
                  },
                ],
              },
            });
          }
        }
      });
    }
    return loopup;
  } else {
    return undefined;
  }
};

function format_qr(obj) {
  for (var k in obj) {
    if (k === '$in') {
      if (!(obj[k] instanceof Array)) {
        obj[k] = [obj[k]];
      }
    } else if (typeof obj[k] == 'object') {
      format_qr(obj[k]);
    }
  }
  return obj;
}

function qsParse(find) {
  var result = qs.parse(find, {
    depth: 100,
    strictDepth: true,
    arrayLimit: 1000,
    decoder: function (str, defaultDecoder, charset, type) {
      const str_decode = defaultDecoder(str, defaultDecoder, charset);
      if (type === 'value') {
        if (str_decode === 'false' || str_decode === 'true') {
          return str_decode === 'true';
        } else if (!isNaN(parseFloat(str_decode)) && isFinite(str_decode)) {
          return Number(str_decode);
        } else if (typeof str_decode === 'string') {
          if (str_decode.indexOf('RegExp:') == 0) {
            const strs1 = str_decode.slice(str_decode.indexOf(':') + 1, str_decode.lastIndexOf(':'));
            const strs2 = str_decode.slice(str_decode.lastIndexOf(':') + 1, str_decode.length);
            return RegExp(strs1.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d'), strs2);
          } else if (str_decode.indexOf('RegExp%3A') == 0) {
            const strs = str_decode.split('%3A');
            return RegExp(strs[1].replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d'), strs[2]);
          } else if (str_decode.indexOf('str:') == 0) {
            return str_decode.slice(str_decode.lastIndexOf(':') + 1, str_decode.length);
          }
        }
      }
      return str_decode;
    },
  });
  return format_qr(result);
}

function get_keys_in_bson(json_object, ret_array = [], fields) {
  for (json_key in json_object) {
    if (typeof json_object[json_key] === 'object' || Array.isArray(json_object[json_key])) {
      if (json_key.split('.').length >= 2 && !fields.includes(json_key.split('.')[0])) {
        ret_array.push(json_key);
      } else {
        get_keys_in_bson(json_object[json_key], ret_array, fields);
      }
    } else {
      if (json_key.split('.').length >= 2 && !fields.includes(json_key.split('.')[0])) {
        ret_array.push(json_key);
      }
    }
  }
  return ret_array;
}

function getAllKeys(obj) {
  let keys = [];
  function extractKeys(obj) {
    if (typeof obj === 'object' && obj !== null) {
      for (let key in obj) {
        if (
          (typeof obj[key] === 'object' && obj[key]?.type?.name != undefined) ||
          (typeof obj[key][0] != 'function' && typeof obj[key][0] != 'function' && obj.default == undefined && Array.isArray(obj[key]))
        ) {
          keys.push(key);
        }
        extractKeys(obj[key]);
      }
    }
  }
  extractKeys(obj);
  return keys;
}

function flattenQuery(query) {
  if (query === null || typeof query !== 'object' || query instanceof RegExp) return query;

  if (Array.isArray(query)) {
    return query.map(flattenQuery).filter((item) => item && (typeof item !== 'object' || Object.keys(item).length > 0));
  }

  let result = {};
  for (let key in query) {
    let value = flattenQuery(query[key]);

    if (Array.isArray(value) && value.length === 0) continue;

    if (key === '$and' && Array.isArray(value)) {
      let flattened = [];
      value.forEach((item) => {
        if (item?.$and) flattened.push(...item.$and);
        else flattened.push(item);
      });

      let seen = new Set();
      let filtered = flattened
        .filter((item) => item && (typeof item !== 'object' || Object.keys(item).length > 0))
        .filter((item) => {
          let str = JSON.stringify(item);
          if (seen.has(str)) return false;
          seen.add(str);
          return true;
        });

      if (filtered.length > 0) {
        result['$and'] = filtered;
      }
    } else if (key === '$or' && Array.isArray(value)) {
      if (value.length > 0) {
        result['$or'] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
