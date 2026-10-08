const request = require('supertest');
const app = require('../src/app');
const db = require('./db');
const { seed, DEMO_PASSWORD } = require('../scripts/seed');
const User = require('../src/models/User');
const Group = require('../src/models/Group');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

it('creates a demo group whose balances add up, and demo users can log in', async () => {
  await seed();
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: 'asha@demo.com', password: DEMO_PASSWORD });
  expect(login.status).toBe(200);

  const groups = (await agent.get('/api/groups')).body.data.groups;
  expect(groups.map((g) => g.name)).toEqual(['Goa Trip']);
  const { balances, plan } = (await agent.get(`/api/groups/${groups[0]._id}/balances`)).body.data;
  expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0);
  expect(plan.length).toBeGreaterThan(0);
  expect((await agent.get(`/api/groups/${groups[0]._id}/activity`)).body.data.activity.length).toBeGreaterThan(3);
});

it('is re-runnable and leaves non-demo data alone', async () => {
  const other = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Real', email: 'real@example.com', password: 'password123' });
  expect(other.status).toBe(201);
  await seed();
  await seed();
  expect(await User.countDocuments()).toBe(4);
  expect(await Group.countDocuments()).toBe(1);
});
