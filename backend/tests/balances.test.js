const { computeBalances } = require('../src/services/balanceService');
const { simplifyDebts } = require('../src/services/simplifyDebts');

const total = (net) => Object.values(net).reduce((a, b) => a + b, 0);
const exp = (paidBy, amount, splits) => ({ paidBy, amount, splits: Object.entries(splits).map(([user, a]) => ({ user, amount: a })) });

describe('computeBalances', () => {
  it('credits the payer and debits each split', () => {
    const net = computeBalances([exp('a', 300, { a: 100, b: 100, c: 100 })], []);
    expect(net).toEqual({ a: 200, b: -100, c: -100 });
  });

  it('includes members with no activity as 0', () => {
    expect(computeBalances([], [], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  it('settlements move money back: payer up, receiver down', () => {
    const net = computeBalances([exp('a', 200, { a: 100, b: 100 })], [{ from: 'b', to: 'a', amount: 100 }]);
    expect(net).toEqual({ a: 0, b: 0 });
  });

  it('balances sum to zero after mixed expenses and settlements', () => {
    const expenses = [
      exp('a', 10000, { a: 3334, b: 3333, c: 3333 }),
      exp('b', 4550, { a: 1000, c: 3550 }),
      exp('c', 999, { b: 999 }),
    ];
    const settlements = [
      { from: 'c', to: 'a', amount: 2000 },
      { from: 'b', to: 'a', amount: 1 },
    ];
    expect(total(computeBalances(expenses, settlements))).toBe(0);
  });

  it('works with ObjectId-like values by stringifying ids', () => {
    const id = (s) => ({ toString: () => s });
    const net = computeBalances([{ paidBy: id('a'), amount: 50, splits: [{ user: id('b'), amount: 50 }] }], []);
    expect(net).toEqual({ a: 50, b: -50 });
  });

  it('logs an error if the books do not balance', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    computeBalances([{ paidBy: 'a', amount: 100, splits: [{ user: 'b', amount: 90 }] }], []);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('simplifyDebts', () => {
  it('collapses the A -> B -> C chain into one payment', () => {
    // A owes B 100, B owes C 100 => nets: A -100, B 0, C +100
    expect(simplifyDebts({ A: -10000, B: 0, C: 10000 })).toEqual([{ from: 'A', to: 'C', amount: 10000 }]);
  });

  it('returns an empty plan for an already-settled group', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
    expect(simplifyDebts({})).toEqual([]);
  });

  it('largest debtor pays largest creditor first', () => {
    const plan = simplifyDebts({ a: 500, b: 300, c: -600, d: -200 });
    expect(plan).toEqual([
      { from: 'c', to: 'a', amount: 500 },
      { from: 'd', to: 'b', amount: 200 },
      { from: 'c', to: 'b', amount: 100 },
    ]);
  });

  it('uses at most n-1 payments and fully settles everyone', () => {
    const net = { a: 1234, b: -567, c: 890, d: -1000, e: -557 };
    const plan = simplifyDebts(net);
    expect(plan.length).toBeLessThanOrEqual(4);
    const after = { ...net };
    for (const p of plan) {
      expect(p.amount).toBeGreaterThan(0);
      after[p.from] += p.amount;
      after[p.to] -= p.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it('does not mutate its input', () => {
    const net = { a: 100, b: -100 };
    simplifyDebts(net);
    expect(net).toEqual({ a: 100, b: -100 });
  });
});
