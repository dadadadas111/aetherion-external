const Redis = require('ioredis');
require('dotenv').config();

let redisClient = null;

function createRedisClient() {
    if (redisClient) {
        return redisClient;
    }

    const config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        username: process.env.REDIS_USERNAME || undefined,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
    };

    // Add TLS if specified
    if (process.env.REDIS_TLS === 'true') {
        config.tls = {};
    }

    redisClient = new Redis(config);

    redisClient.on('connect', () => {
        console.log('Redis client connected');
    });

    redisClient.on('error', (err) => {
        console.error('Redis client error:', err);
    });

    redisClient.on('ready', () => {
        console.log('Redis client ready');
    });

    return redisClient;
}

function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call createRedisClient() first.');
    }
    return redisClient;
}

async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('Redis client disconnected');
    }
}

module.exports = {
    createRedisClient,
    getRedisClient,
    closeRedisClient
};
