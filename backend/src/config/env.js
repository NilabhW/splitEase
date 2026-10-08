require('dotenv').config({ quiet: true });

module.exports = {
  PORT: process.env.PORT || 5001,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/splitease',
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
