// Vercel serverless entry. Warm invocations reuse the module, so the DB connection is opened once.
const { MONGO_URI, JWT_SECRET } = require('../src/config/env');
const connectDB = require('../src/config/db');
const app = require('../src/app');

let ready;

module.exports = async (req, res) => {
  try {
    if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
    ready = ready || connectDB(MONGO_URI);
    await ready;
  } catch (err) {
    ready = null;
    console.error(err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Service unavailable' } }));
  }
  return app(req, res);
};
