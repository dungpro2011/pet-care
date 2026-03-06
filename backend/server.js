const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });
const http = require('http');
const https = require('https');
const fs = require('fs');

const cluster = require('cluster');
const numCPUs = require('os').availableParallelism();
const process = require('process');

const mongoose = require('mongoose');
const { HmacSHA512 } = require('crypto-js');

const router = require('./router');
const { UserMasters } = require('./models');
const { SECRET } = require('./constants');

const EventEmitter = require('node:events');
const logger = require('./logger');
const myEvents = new EventEmitter();

async function starting() {
  var server_1 = undefined;
  var server_2 = undefined;
  if (process.env.PORT_SSL) {
    const options = {
      key: fs.readFileSync(path.join(__dirname, './ssl/server_new.key')),
      cert: fs.readFileSync(path.join(__dirname, './ssl/server.crt')),
    };
    server_1 = https.createServer(options, (req, res) => {
      req.myEvents = myEvents;
      router.lookup(req, res);
    });
    server_2 = http.createServer((req, res) => {
      req.myEvents = myEvents;
      res.writeHead(301, { Location: `https://${process.env.URL ? process.env.URL : req.headers.host}${req.url}` });
      res.end();
    });
  } else {
    server_1 = http.createServer((req, res) => {
      req.myEvents = myEvents;
      router.lookup(req, res);
    });
  }

  if (server_1) {
    const port = process.env.PORT_SSL ? process.env.PORT_SSL : process.env.PORT;
    server_1.listen(parseInt(port), () => {
      logger.info('Server listening on http://localhost:' + port + '/ ...');
      if (!fs.existsSync(path.resolve(__dirname, './uploads/index.html'))) {
        fs.mkdirSync(path.resolve(__dirname, './imports'), { recursive: true });
        fs.mkdirSync(path.resolve(__dirname, './uploads'), { recursive: true });
        fs.writeFile(path.resolve(__dirname, './uploads/index.html'), 'attachments', (err) => {
          if (err) {
            logger.error(err.stack ? err.stack : err);
          }
        });
      }
    });
  }
  if (server_2) {
    server_2.listen(parseInt(process.env.PORT), () => {
      logger.info('Server listening on http://localhost:' + process.env.PORT + '/ ...');
    });
  }
}

const { LRUCache } = require('lru-cache');
const cache = new LRUCache({
  max: 100,
  ttl: 1000 * 180,
});
const pendingQueries = new Map();

async function setup() {
  mongoose
    .connect(process.env.MONGODB_DATA_URL)
    .then(async () => {
      logger.info('Setup DB!');

      // mongoose.Query.prototype.cache = function (ttl = 180) {
      //   this._useCache = true;
      //   this._ttl = ttl;
      //   return this;
      // };

      // const originalLean = mongoose.Query.prototype.lean;
      // mongoose.Query.prototype.lean = function (enable = true) {
      //   this._customLean = enable;
      //   return originalLean.call(this, enable);
      // };

      // const exec = mongoose.Query.prototype.exec;
      // mongoose.Query.prototype.exec = async function () {
      //   if (!this._useCache) {
      //     return exec.apply(this, arguments);
      //   }

      //   const key = JSON.stringify({
      //     collection: this.model.collection.name,
      //     query: this.getQuery(),
      //     options: this.getOptions(),
      //     lean: this._customLean,
      //     fields: this._fields,
      //   });

      //   if (cache.has(key)) {
      //     return cache.get(key);
      //   }

      //   if (pendingQueries.has(key)) {
      //     return pendingQueries.get(key);
      //   }

      //   const queryPromise = (async () => {
      //     try {
      //       const result = await exec.apply(this, arguments);
      //       cache.set(key, result, { ttl: this._ttl * 1000 });
      //       return result;
      //     } finally {
      //       pendingQueries.delete(key);
      //     }
      //   })();

      //   pendingQueries.set(key, queryPromise);
      //   return queryPromise;
      // };

      UserMasters().findOne({ username: 'sadmin' })
        .lean()
        .then((v) => {
          if (v !== null) return;
          UserMasters().insertMany([
            {
              username: 'sadmin',
              password: HmacSHA512('sadmin', SECRET.SECRET_PASS).toString(),
              full_name: "sadmin",
              T1001_IS_VERIFY: true,
            },
          ]);
        });
    })
    .catch((err) => logger.error(err.stack ? err.stack : err.message));
}

(async () => {
  const envCLUSTER = parseInt(process.env.CLUSTER);
  if (cluster.isPrimary) {
    logger.info(`Primary ${process.pid} is running`);
    await setup().catch((err) => logger.error(err.stack ? err.stack : err.message));
  }

  if (cluster.isPrimary && envCLUSTER >= 0) {
    for (let i = 0; i < (envCLUSTER > 0 ? envCLUSTER : numCPUs); i++) {
      cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
      logger.info('worker is dead:', worker.isDead());
      cluster.fork();
    });
  } else {
    logger.info(`Worker ${process.pid} started`);
    await mongoose.connect(process.env.MONGODB_DATA_URL);
    await starting().catch((err) => logger.error(err.stack ? err.stack : err.message));
  }
})().catch((e) => {
  logger.error(e.stack);
});
