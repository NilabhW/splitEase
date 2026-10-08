const request = require('supertest');
const app = require('../src/app');
const db = require('./db');
const Group = require('../src/models/Group');

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

// Asha pays 300 split equally among Asha, Bob, Cara => Bob and Cara each owe Asha 100
async function setup() {
  const a = await signup('Asha');
  const b = await signup('Bob');
  const c = await signup('Cara');
  const { group } = (await a.agent.post('/api/groups').send({ name: 'Trip' })).body.data;
  await b.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode });
  await c.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode });
  await a.agent.post(`/api/groups/${group._id}/expenses`).send({
    description: 'Hotel',
    amount: 30000,
    paidBy: a.user._id,
    splitType: 'equal',
    participants: [a.user._id, b.user._id, c.user._id],
  });
  const base = `/api/groups/${group._id}`;
  return { a, b, c, group, base };
}

const nets = async (who, base) =>
  Object.fromEntries((await who.agent.get(`${base}/balances`)).body.data.balances.map((x) => [x.user.name, x.net]));

describe('settlements', () => {
  it('records a payment and balances update', async () => {
    const { a, b, base } = await setup();
    const res = await b.agent
      .post(`${base}/settlements`)
      .send({ from: b.user._id, to: a.user._id, amount: 10000, note: 'UPI' });
    expect(res.status).toBe(201);
    expect(res.body.data.settlement).toMatchObject({ amount: 10000, note: 'UPI', from: { name: 'Bob' }, to: { name: 'Asha' } });
    expect(await nets(a, base)).toEqual({ Asha: 10000, Bob: 0, Cara: -10000 });
    expect((await b.agent.get(`${base}/balances`)).body.data.plan).toHaveLength(1);
  });

  it('the receiver can also record it', async () => {
    const { a, c, base } = await setup();
    const res = await a.agent.post(`${base}/settlements`).send({ from: c.user._id, to: a.user._id, amount: 10000 });
    expect(res.status).toBe(201);
  });

  it('only the payer or receiver can record a settlement (403)', async () => {
    const { a, b, c, base } = await setup();
    const res = await c.agent.post(`${base}/settlements`).send({ from: b.user._id, to: a.user._id, amount: 100 });
    expect(res.status).toBe(403);
  });

  it('rejects paying yourself, non-members and bad amounts (400)', async () => {
    const { a, b, base } = await setup();
    const out = await signup('Dev');
    const post = (body) => b.agent.post(`${base}/settlements`).send(body);
    expect((await post({ from: b.user._id, to: b.user._id, amount: 100 })).status).toBe(400);
    expect((await post({ from: b.user._id, to: out.user._id, amount: 100 })).status).toBe(400);
    expect((await post({ from: b.user._id, to: a.user._id, amount: 0 })).status).toBe(400);
    expect((await post({ from: b.user._id, to: a.user._id, amount: 1.5 })).status).toBe(400);
    expect((await post({ from: b.user._id, to: a.user._id, amount: 100, note: 'x'.repeat(201) })).status).toBe(400);
  });

  it('non-members get 403', async () => {
    const { a, b, base } = await setup();
    const out = await signup('Dev');
    expect((await out.agent.post(`${base}/settlements`).send({ from: b.user._id, to: a.user._id, amount: 1 })).status).toBe(403);
  });

  it('dashboard netBalance includes settlements', async () => {
    const { a, b, base } = await setup();
    await b.agent.post(`${base}/settlements`).send({ from: b.user._id, to: a.user._id, amount: 10000 });
    expect((await b.agent.get('/api/groups')).body.data.groups[0].netBalance).toBe(0);
    expect((await a.agent.get('/api/groups')).body.data.groups[0].netBalance).toBe(10000);
  });
});

describe('activity', () => {
  it('merges expenses and settlements newest first', async () => {
    const { a, b, base } = await setup();
    await b.agent.post(`${base}/settlements`).send({ from: b.user._id, to: a.user._id, amount: 5000 });
    const res = await a.agent.get(`${base}/activity`);
    expect(res.status).toBe(200);
    const items = res.body.data.activity;
    expect(items.map((i) => i.type)).toEqual(['settlement', 'expense']);
    expect(items[0]).toMatchObject({ amount: 5000, from: { name: 'Bob' }, to: { name: 'Asha' } });
    expect(items[1]).toMatchObject({ description: 'Hotel', amount: 30000, paidBy: { name: 'Asha' } });
  });

  it('is members-only', async () => {
    const { base } = await setup();
    const out = await signup('Dev');
    expect((await out.agent.get(`${base}/activity`)).status).toBe(403);
  });
});

describe('leave group', () => {
  it('refuses to let someone with a non-zero balance leave', async () => {
    const { a, b, base } = await setup();
    const res = await b.agent.delete(`${base}/leave`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BALANCE_NOT_ZERO');
    expect((await a.agent.delete(`${base}/leave`)).status).toBe(400);
  });

  it('lets a settled member leave; they lose access', async () => {
    const { a, b, base } = await setup();
    await b.agent.post(`${base}/settlements`).send({ from: b.user._id, to: a.user._id, amount: 10000 });
    expect((await b.agent.delete(`${base}/leave`)).status).toBe(200);
    expect((await b.agent.get(base)).status).toBe(403);
    expect((await b.agent.get('/api/groups')).body.data.groups).toHaveLength(0);
    // history still names the person who left
    const nets = (await a.agent.get(`${base}/balances`)).body.data.balances;
    expect(nets.find((x) => x.user.name === 'Bob').net).toBe(0);
  });

  it('deletes the group when the last member leaves', async () => {
    const a = await signup('Asha');
    const { group } = (await a.agent.post('/api/groups').send({ name: 'Solo' })).body.data;
    expect((await a.agent.delete(`/api/groups/${group._id}/leave`)).status).toBe(200);
    expect(await Group.findById(group._id)).toBeNull();
  });
});
