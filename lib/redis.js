const { createClient } = require('redis');

const redisConfig = {
  username: 'default',
  password: 'kJIV0G8RPmZ8FZllTo3Wisz3sVmzWpi2',
  socket: {
    host: 'redis-12880.fcrce213.us-east-1-3.ec2.redns.redis-cloud.com',
    port: 12880,
  },
};

let client = null;
let isConnecting = false;
let connectionPromise = null;

const getRedisClient = async () => {
  if (client && client.isReady) {
    return client;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  console.log('🔌 Connecting to Redis...');

  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      client = createClient(redisConfig);

      client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
        isConnecting = false;
        reject(err);
      });

      client.on('ready', () => {
        console.log('✅ Redis connected successfully!');
        isConnecting = false;
        resolve(client);
      });

      await client.connect();
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      isConnecting = false;
      client = null;
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
};

module.exports = { getRedisClient };
