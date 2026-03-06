var mongoose = require('mongoose');
const logger = require('../logger');

module.exports = {
    Users: (idTenant) => {
        return getModelByTenant(idTenant, 'users', require('./schemas/T1001_Users'));
    },
    LogAPI: (idTenant) => {
        return getModelByTenant(idTenant, 'logs-apis', require('./schemas/T0001_LogApis'));
    },
    LogLogin: (idTenant) => {
        return getModelByTenant(idTenant, 'logs-logins', require('./schemas/T0002_LogLogins'));
    },
    UserMasters: () => {
        return getModelByTenant('master', 'user-masters', require('./schemas/T0000_UserMasters'));
    },
    Companies: () => {
        return getModelByTenant('master', 'companies', require('./schemas/T0000_Companies'));
    },
    BlockLoginAccess: () => {
        return getModelByTenant('master', 'block-login-accesses', require('./schemas/T0000_BlockLoginAccess'));
    },
};

const mongoOption = {
    autoIndex: true,
};

const mapConn = new Map();

const connection = (tenantId) => {
    if (mapConn.has(tenantId)) {
        const conn = mapConn.get(tenantId);
        return conn;
    } else {
        const conn = mongoose.createConnection(process.env.MONGODB_DATA_URL, mongoOption);
        logger.info('mongo connection NEW: ' + tenantId);
        conn.on('open', () => {
            logger.info('mongo connection OPEN: ' + tenantId);
        });
        conn.on('reconnected', () => {
            logger.info('mongo connection RECONNECTED: ' + tenantId);
        });
        conn.on('disconnected', () => {
            logger.info('mongo connection DISCONNECTED: ' + tenantId);
        });
        conn.on('close', () => {
            logger.info('mongo connection CLOSE: ' + tenantId);
        });
        mapConn.set(tenantId, conn);
        return conn;
    }
};

const getModelByTenant = (tenantId, modelName, modelSchema) => {
    const dbName = `${process.env.NAME_APP}_${tenantId}`;
    const db = connection(tenantId).useDb(dbName, { useCache: true });
    return db.model(modelName, modelSchema);
};
