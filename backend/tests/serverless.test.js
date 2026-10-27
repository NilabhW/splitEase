const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let handler;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  // Other test files share this process and may have cached env.js with the default local URI.
  delete require.cache[require.resolve('../src/config/env')];
  delete require.cache[require.resolve('../api/index')];
  handler = require('../api/index');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

it('connects on first request and serves DB-backed routes', async () => {
  expect(mongoose.connection.readyState).toBe(0);
  const agent = request.agent(handler);
  const reg = await agent
    .post('/api/auth/register')
    .send({ name: 'Vee', email: 'vee@example.com', password: 'password123' });
  expect(reg.status).toBe(201);
  expect(mongoose.connection.readyState).toBe(1);

  const groups = await agent.get('/api/groups');
  expect(groups.status).toBe(200);
  expect(groups.body.data.groups).toEqual([]);
});

it('reuses the existing connection across requests', async () => {
  const spy = vi.spyOn(mongoose, 'connect');
  const res = await request(handler).get('/api/health');
  expect(res.status).toBe(200);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
