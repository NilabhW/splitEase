const request = require('supertest');
const app = require('../src/app');
const db = require('./db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

async function signup(name) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email: `${name.toLowerCase()}@example.com`, password: 'password123' });
  return { agent, user: res.body.data.user };
}

describe('groups', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/groups')).status).toBe(401);
  });

  it('creates a group with creator as member and an 8-char invite code', async () => {
    const { agent, user } = await signup('Asha');
    const res = await agent.post('/api/groups').send({ name: 'Goa Trip' });
    expect(res.status).toBe(201);
    const g = res.body.data.group;
    expect(g.inviteCode).toHaveLength(8);
    expect(g.members.map((m) => m._id)).toEqual([user._id]);
  });

  it('validates group name', async () => {
    const { agent } = await signup('Asha');
    expect((await agent.post('/api/groups').send({ name: 'x' })).status).toBe(400);
  });

  it('lists only my groups', async () => {
    const a = await signup('Asha');
    const b = await signup('Bob');
    await a.agent.post('/api/groups').send({ name: 'Flat' });
    await b.agent.post('/api/groups').send({ name: 'Other' });
    const res = await a.agent.get('/api/groups');
    expect(res.body.data.groups.map((g) => g.name)).toEqual(['Flat']);
    expect(res.body.data.groups[0].netBalance).toBe(0);
  });

  it('joins via invite code; 409 if already a member; 404 if bad code', async () => {
    const a = await signup('Asha');
    const b = await signup('Bob');
    const { group } = (await a.agent.post('/api/groups').send({ name: 'Flat' })).body.data;
    const join = await b.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode });
    expect(join.status).toBe(200);
    expect(join.body.data.group.members).toHaveLength(2);
    const again = await b.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode.toLowerCase() });
    expect(again.status).toBe(409);
    expect(again.body.error.details).toEqual({ groupId: group._id });
    expect((await b.agent.post('/api/groups/join').send({ inviteCode: 'ZZZZZZZZ' })).status).toBe(404);
  });

  it('group detail is members-only (403), invalid id is 404', async () => {
    const a = await signup('Asha');
    const c = await signup('Cara');
    const { group } = (await a.agent.post('/api/groups').send({ name: 'Flat' })).body.data;
    expect((await a.agent.get(`/api/groups/${group._id}`)).status).toBe(200);
    expect((await c.agent.get(`/api/groups/${group._id}`)).status).toBe(403);
    expect((await a.agent.get('/api/groups/not-an-id')).status).toBe(404);
  });
});
