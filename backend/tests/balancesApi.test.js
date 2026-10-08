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

async function setup() {
  const a = await signup('Asha');
  const b = await signup('Bob');
  const c = await signup('Cara');
  const { group } = (await a.agent.post('/api/groups').send({ name: 'Trip' })).body.data;
  await b.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode });
  await c.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode });
  return { a, b, c, group };
}

const addExpense = (who, group, paidBy, amount, participants) =>
  who.agent.post(`/api/groups/${group._id}/expenses`).send({
    description: 'x',
    amount,
    paidBy: paidBy._id,
    splitType: 'equal',
    participants: participants.map((p) => p._id),
  });

describe('GET /groups/:groupId/balances', () => {
  it('returns every member at zero and an empty plan for a new group', async () => {
    const { a, group } = await setup();
    const res = await a.agent.get(`/api/groups/${group._id}/balances`);
    expect(res.status).toBe(200);
    expect(res.body.data.balances.map((x) => x.net)).toEqual([0, 0, 0]);
    expect(res.body.data.plan).toEqual([]);
  });

  it('computes nets with names and a simplified plan', async () => {
    const { a, b, c, group } = await setup();
    // A pays 300 for A,B,C; B pays 300 for B,C  => A +200, B +50, C -250
    await addExpense(a, group, a.user, 30000, [a.user, b.user, c.user]);
    await addExpense(b, group, b.user, 30000, [b.user, c.user]);
    // B also covers A's 100 in a separate expense for A only => A +100, B +150
    await addExpense(b, group, b.user, 10000, [a.user]);
    const res = await a.agent.get(`/api/groups/${group._id}/balances`);
    const byName = Object.fromEntries(res.body.data.balances.map((x) => [x.user.name, x.net]));
    expect(byName).toEqual({ Asha: 10000, Bob: 15000, Cara: -25000 });
    expect(res.body.data.plan).toEqual([
      { from: { _id: c.user._id, name: 'Cara' }, to: { _id: b.user._id, name: 'Bob' }, amount: 15000 },
      { from: { _id: c.user._id, name: 'Cara' }, to: { _id: a.user._id, name: 'Asha' }, amount: 10000 },
    ]);
  });

  it('is members-only', async () => {
    const { group } = await setup();
    const d = await signup('Dev');
    expect((await d.agent.get(`/api/groups/${group._id}/balances`)).status).toBe(403);
  });
});

describe('GET /groups netBalance', () => {
  it('shows my net balance in each group', async () => {
    const { a, b, c, group } = await setup();
    await addExpense(a, group, a.user, 30000, [a.user, b.user, c.user]);
    const { group: other } = (await b.agent.post('/api/groups').send({ name: 'Flat' })).body.data;
    await a.agent.post('/api/groups/join').send({ inviteCode: other.inviteCode });
    await addExpense(b, other, b.user, 5000, [a.user, b.user]);

    const mine = Object.fromEntries((await a.agent.get('/api/groups')).body.data.groups.map((g) => [g.name, g.netBalance]));
    expect(mine).toEqual({ Trip: 20000, Flat: -2500 });
    const cara = (await c.agent.get('/api/groups')).body.data.groups;
    expect(cara[0].netBalance).toBe(-10000);
  });
});
