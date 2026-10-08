process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGOMS_SYSTEM_BINARY = process.env.MONGOMS_SYSTEM_BINARY || '/opt/homebrew/bin/mongod';
