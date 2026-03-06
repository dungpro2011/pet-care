const ejs = require('ejs');
const jws = require('jws');
const path = require('path');

const formidable = require('formidable');
const { graphql, parse, Source, validate } = require('graphql');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { mergeTypeDefs, mergeResolvers } = require('@graphql-tools/merge');

const logger = require('../logger');
const depthLimitQuery = require('../graphql/utils/depthLimitQuery');
const parseCookies = require('./utils/parseCookies');
const staticfile = require('./utils/staticfile');
const fieldSelect = require('../graphql/utils/fieldSelect');
const { LogAPI } = require('../models');
const { DateTime } = require('luxon');
const { qsfind, qsParse } = require('../graphql/utils/selectGraphql');

const router = require('find-my-way')({
  ignoreTrailingSlash: true,
  ignoreDuplicateSlashes: true,
  defaultRoute: (req, res) => {
    let pathname = path.join(__dirname, '../dist', req.url == '/' ? '/index.html' : req.url);
    staticfile(pathname, req, res, path.join(__dirname, '../dist', '/index.html'));
  },
});

require('./import')(router);

router.on('OPTIONS', '*', (req, res, params) => {
  res.writeHead(204, {
    'Access-Control-Allow-Headers': 'token,authorization,content-type,tenant',
    'Access-Control-Allow-Methods': 'GET,POST',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Max-Age': '86400',
  }).end();
});

//------------------------------Graphql--------------------------------------------------
router.on('GET', '/graphql', (req, res, params) => {
  ejs.renderFile(__dirname.replace('router', '') + 'graphql/utils/graphiql.ejs', {}, (err, str) => {
    if (!err) {
      res.end(str);
    } else {
      res.end('{"detail":"Faild"}');
    }
  });
});

const typeDefs = mergeTypeDefs(
  loadFilesSync(path.join(__dirname, '../graphql/schema/**'), {
    recursive: false,
    extensions: ['gql'],
  })
);
const resolvers = mergeResolvers(
  loadFilesSync(path.join(__dirname, '../graphql/schema/**'), {
    recursive: false,
    extensions: ['js'],
  })
);
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

function createDocument(query) {
  const source = new Source(query);
  return parse(source);
}

async function log_API(context, query, variables, headers, error) {
  var logAPIs = LogAPI(context?.tenant ?? 'master');
  const logAPI = new logAPIs({
    username: context?.payload?.data?.username ?? '',
    query: query,
    variables: variables,
    headers: headers,
    ip: context?.remoteAddress ?? '',
    error: error,
    time: DateTime.now().toSeconds(),
  });
  await logAPI.save();
}

var variableValues = removeNulls([depthLimitQuery(6), undefined]);
router.on('POST', '/graphql', (req, res, params) => {
  var form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    if (err) {
      logger.error(err);
      res.writeHead(err.httpCode || 400, { 'Content-Type': 'text/plain' });
      res.end(String(err));
      return;
    }
    var context = {};
    context.token = req?.headers?.authorization || req?.headers?.token || parseCookies(req)?.token || undefined;
    context.tenant = req?.headers?.tenant || parseCookies(req)?.tenant || undefined;
    try {
      if (req.headers['content-type'].includes('application/json') && fields.query) {
        var decode = jws.decode(context.token);
        context.payload = decode?.payload === undefined ? null : JSON.parse(decode?.payload);
        var validateRes = validate(schema, createDocument(fields.query), variableValues);
        logger.http('\n' + fields.query);
        if (validateRes == 0) {
          var fieldS = fieldSelect.rootFields(fields.query);
          context.remoteAddress = req.socket.remoteAddress;
          if (fieldS.includes('login')) {
            if (fieldS.length > 1) {
              throw new Error('Multiple queries are not allowed when login');
            }
          }
          graphql({
            schema: schema,
            source: fields.query,
            variableValues: fields.variables,
            contextValue: context,
          })
            .then((result) => {
              if (result?.errors?.length > 0) {
                logger.error(result?.errors);
              }
              if (
                (result?.data?.mobi_login === null || result?.data?.mobi_User_change_password === null) &&
                result?.errors?.length > 0
              ) {
                result.data.error = result.errors[0];
                delete result.errors;
              }
              if (!fieldS.includes('login')) {
                log_API(context, fields.query, fields.variables, req?.headers, result.errors);
              }
              res.writeHead(
                200,
                removeNulls({
                  'Content-Type': 'application/json',
                  'Set-Cookie': result?.data?.Tenant
                    ? 'tenant=' + result.data.Tenant + '; SameSite=Strict; HttpOnly; Path=/graphql'
                    : result?.data?.login?.token
                      ? 'token=' + result.data.login.token + '; SameSite=Strict; HttpOnly; Path=/graphql'
                      : result?.data?.LoginMaster?.token
                        ? 'token=' + result.data.LoginMaster.token + '; SameSite=Strict; HttpOnly; Path=/graphql'
                        : result?.data?.tfa?.token
                          ? 'token=' + result.data.tfa.token + '; SameSite=Strict; HttpOnly; Path=/graphql'
                          : undefined,
                  'access-control-allow-origin': '*',
                })
              );

              if (fields?.variables?.qsfind) {
                var qs_find = fields?.variables?.qsfind;
                if ('string' === typeof qs_find) {
                  qs_find = qsParse(qs_find);
                } else if (Array.isArray(qs_find)) {
                  qs_find = qs_find.map((item) => {
                    if ('string' === typeof item) {
                      return qsParse(item);
                    } else {
                      return qsfind(item);
                    }
                  });
                } else {
                  qs_find = qsfind(qs_find);
                }
                const text = JSON.stringify({ qsfind: qs_find, ...result });
                res.end(text);
              } else {
                const text = JSON.stringify(result);
                res.end(text);
              }
            })
            .catch((error) => {
              throw new Error(error.message);
            });
        } else {
          throw new Error(validateRes);
        }
      } else {
        throw new Error('');
      }
    } catch (error) {
      log_API(context, fields.query, fields.variables, req?.headers, error.message);
      logger.error(error.message);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(
        JSON.stringify({
          errors: [
            {
              message: error.message,
            },
          ],
        })
      );
    }
  });
});

function removeNulls(obj) {
  var isArray = obj instanceof Array;
  for (var k in obj) {
    if (obj[k] === null || obj[k] === undefined) isArray ? obj.splice(k, 1) : delete obj[k];
    else if (typeof obj[k] == 'object') removeNulls(obj[k]);
  }
  return obj;
}

module.exports = router;
