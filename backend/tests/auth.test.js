const request = require('supertest');
const app = require('../src/app');
const db = require('./db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const user = { name: 'Asha', email: 'Asha@Example.com', password: 'password123' };

describe('auth', () => {
  it('registers, sets httpOnly cookie, hides password', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('asha@example.com');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
  });

  it('logs in with correct password, rejects wrong one', async () => {
    await request(app).post('/api/auth/register').send(user);
    const ok = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrongpass1' });
    expect(bad.status).toBe(401);
  });

  it('/me requires auth and returns user with cookie', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(user);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Asha');
  });

  it('logout clears the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(user);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
