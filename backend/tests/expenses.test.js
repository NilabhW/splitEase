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

// Asha creates a group, Bob joins; Cara is an outsider
async function setup() {
  const a = await signup('Asha');
  const b = await signup('Bob');
  const c = await signup('Cara');
  const { group } = (await a.agent.post('/api/groups').send({ name: 'Flat' })).body.data;
  await b.agent.post('/api/groups/join').send({ inviteCode: group.inviteCode });
  const url = `/api/groups/${group._id}/expenses`;
  return { a, b, c, group, url };
}

const equalBody = (payer, users, over = {}) => ({
  description: 'Dinner',
  amount: 10000,
  paidBy: payer._id,
  splitType: 'equal',
  participants: users.map((u) => u._id),
  ...over,
});

describe('expenses API', () => {
  it('adds an equal-split expense and computes splits server-side', async () => {
    const { a, b, url } = await setup();
    const res = await a.agent.post(url).send(equalBody(a.user, [a.user, b.user], { amount: 10001 }));
    expect(res.status).toBe(201);
    const e = res.body.data.expense;
    expect(e.amount).toBe(10001);
    expect(e.splits.map((s) => s.amount)).toEqual([5001, 5000]);
    expect(e.paidBy.name).toBe('Asha');
    expect(e.createdBy._id).toBe(a.user._id);
  });

  it('adds exact and percentage splits', async () => {
    const { a, b, url } = await setup();
    const exact = await a.agent.post(url).send({
      ...equalBody(a.user, [a.user, b.user]),
      splitType: 'exact',
      shares: { [a.user._id]: 2500, [b.user._id]: 7500 },
    });
    expect(exact.status).toBe(201);
    expect(exact.body.data.expense.splits.map((s) => s.amount)).toEqual([2500, 7500]);

    const pct = await a.agent.post(url).send({
      ...equalBody(b.user, [a.user, b.user]),
      splitType: 'percentage',
      shares: { [a.user._id]: 40, [b.user._id]: 60 },
    });
    expect(pct.status).toBe(201);
    expect(pct.body.data.expense.splits.map((s) => s.amount)).toEqual([4000, 6000]);
  });

  it('rejects splits that do not add up with a clear 400', async () => {
    const { a, b, url } = await setup();
    const res = await a.agent.post(url).send({
      ...equalBody(a.user, [a.user, b.user]),
      splitType: 'exact',
      shares: { [a.user._id]: 2500, [b.user._id]: 2500 },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/add up/i);
  });

  it('validates the body (missing description, bad amount, bad ids)', async () => {
    const { a, url } = await setup();
    expect((await a.agent.post(url).send(equalBody(a.user, [a.user], { description: '' }))).status).toBe(400);
    expect((await a.agent.post(url).send(equalBody(a.user, [a.user], { amount: -5 }))).status).toBe(400);
    expect((await a.agent.post(url).send(equalBody(a.user, [a.user], { amount: 12.5 }))).status).toBe(400);
    expect((await a.agent.post(url).send(equalBody(a.user, [a.user], { paidBy: 'nope' }))).status).toBe(400);
  });

  it('rejects payer or participants who are not group members', async () => {
    const { a, c, url } = await setup();
    const badPayer = await a.agent.post(url).send(equalBody(c.user, [a.user]));
    expect(badPayer.status).toBe(400);
    expect(badPayer.body.error.message).toMatch(/member/i);
    expect((await a.agent.post(url).send(equalBody(a.user, [a.user, c.user]))).status).toBe(400);
  });

  it('blocks non-members from listing or adding (403)', async () => {
    const { a, c, url } = await setup();
    expect((await c.agent.get(url)).status).toBe(403);
    expect((await c.agent.post(url).send(equalBody(a.user, [a.user]))).status).toBe(403);
  });

  it('lists newest first with pagination', async () => {
    const { a, url } = await setup();
    for (let i = 1; i <= 3; i++) {
      await a.agent.post(url).send(equalBody(a.user, [a.user], { description: `E${i}`, date: `2026-10-0${i}` }));
    }
    const p1 = await a.agent.get(`${url}?limit=2`);
    expect(p1.status).toBe(200);
    expect(p1.body.data.expenses.map((e) => e.description)).toEqual(['E3', 'E2']);
    expect(p1.body.data).toMatchObject({ page: 1, totalPages: 2, total: 3 });
    const p2 = await a.agent.get(`${url}?limit=2&page=2`);
    expect(p2.body.data.expenses.map((e) => e.description)).toEqual(['E1']);
  });

  it('only the creator can edit or delete', async () => {
    const { a, b, url } = await setup();
    const { expense } = (await a.agent.post(url).send(equalBody(a.user, [a.user, b.user]))).body.data;
    const update = equalBody(b.user, [a.user, b.user], { description: 'Lunch', amount: 600 });

    expect((await b.agent.put(`${url}/${expense._id}`).send(update)).status).toBe(403);
    expect((await b.agent.delete(`${url}/${expense._id}`)).status).toBe(403);

    const edited = await a.agent.put(`${url}/${expense._id}`).send(update);
    expect(edited.status).toBe(200);
    expect(edited.body.data.expense).toMatchObject({ description: 'Lunch', amount: 600 });
    expect(edited.body.data.expense.splits.map((s) => s.amount)).toEqual([300, 300]);

    expect((await a.agent.delete(`${url}/${expense._id}`)).status).toBe(200);
    expect((await a.agent.get(url)).body.data.expenses).toHaveLength(0);
  });

  it('returns 404 for invalid or unknown expense ids, and for an expense from another group', async () => {
    const { a, url } = await setup();
    expect((await a.agent.delete(`${url}/not-an-id`)).status).toBe(404);
    expect((await a.agent.delete(`${url}/65f000000000000000000000`)).status).toBe(404);

    const { group: other } = (await a.agent.post('/api/groups').send({ name: 'Other' })).body.data;
    const otherUrl = `/api/groups/${other._id}/expenses`;
    const { expense } = (await a.agent.post(otherUrl).send(equalBody(a.user, [a.user]))).body.data;
    expect((await a.agent.delete(`${url}/${expense._id}`)).status).toBe(404);
  });
});
