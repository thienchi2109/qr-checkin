const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis max retry attempts reached');
        return new Error('Max retry attempts reached');
      }
      return Math.min(retries * 100, 3000);
    }
  },
  password: process.env.REDIS_PASSWORD || undefined
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.on('connect', () => {
  console.log('Connected to Redis');
});

client.on('ready', () => {
  console.log('Redis client ready');
});

client.on('reconnecting', () => {
  console.log('Redis client reconnecting');
});

// Connect to Redis
(async () => {
  try {
    await client.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

module.exports = client;