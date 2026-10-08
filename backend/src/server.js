const { PORT, MONGO_URI, JWT_SECRET } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
  await connectDB(MONGO_URI);
  app.listen(PORT, () => console.log(`API listening on ${PORT}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
