const { buildSplits } = require('../src/services/splitService');

const sum = (splits) => splits.reduce((s, x) => s + x.amount, 0);
const expectValidation = (fn, msg) => {
  try {
    fn();
  } catch (err) {
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    if (msg) expect(err.message).toMatch(msg);
    return;
  }
  throw new Error('expected a validation error');
};

describe('buildSplits — equal', () => {
  it('splits 10000 among 3 so the sum is exact, extra paise go to the first people', () => {
    const splits = buildSplits(10000, 'equal', ['a', 'b', 'c']);
    expect(splits).toEqual([
      { user: 'a', amount: 3334 },
      { user: 'b', amount: 3333 },
      { user: 'c', amount: 3333 },
    ]);
    expect(sum(splits)).toBe(10000);
  });

  it('handles an amount smaller than the number of people', () => {
    const splits = buildSplits(2, 'equal', ['a', 'b', 'c']);
    expect(splits.map((s) => s.amount)).toEqual([1, 1, 0]);
  });

  it('rejects no participants and duplicate participants', () => {
    expectValidation(() => buildSplits(100, 'equal', []), /at least one/i);
    expectValidation(() => buildSplits(100, 'equal', ['a', 'a']), /duplicate/i);
  });

  it('rejects a non-positive or fractional amount', () => {
    expectValidation(() => buildSplits(0, 'equal', ['a']));
    expectValidation(() => buildSplits(10.5, 'equal', ['a']));
  });
});

describe('buildSplits — exact', () => {
  it('uses the given amounts when they add up', () => {
    const splits = buildSplits(10000, 'exact', ['a', 'b'], { a: 7000, b: 3000 });
    expect(splits).toEqual([
      { user: 'a', amount: 7000 },
      { user: 'b', amount: 3000 },
    ]);
  });

  it('throws when amounts do not sum to the total', () => {
    expectValidation(() => buildSplits(10000, 'exact', ['a', 'b'], { a: 7000, b: 2000 }), /add up/i);
  });

  it('throws on negative, fractional or missing values', () => {
    expectValidation(() => buildSplits(100, 'exact', ['a', 'b'], { a: 150, b: -50 }));
    expectValidation(() => buildSplits(100, 'exact', ['a', 'b'], { a: 50.5, b: 49.5 }));
    expectValidation(() => buildSplits(100, 'exact', ['a', 'b'], { a: 100 }));
  });
});

describe('buildSplits — percentage', () => {
  it('splits 33.33/33.33/33.34 of 10000 to sum exactly 10000', () => {
    const splits = buildSplits(10000, 'percentage', ['a', 'b', 'c'], { a: 33.33, b: 33.33, c: 33.34 });
    expect(sum(splits)).toBe(10000);
    expect(splits.map((s) => s.amount)).toEqual([3333, 3333, 3334]);
  });

  it('hands leftover paise to the largest fractional parts', () => {
    // 100 paise at 1/3 each: 33.33 each by floor -> 99, leftover 1 goes to the largest remainder (c: 33.34%)
    const splits = buildSplits(100, 'percentage', ['a', 'b', 'c'], { a: 33.33, b: 33.33, c: 33.34 });
    expect(splits.map((s) => s.amount)).toEqual([33, 33, 34]);
    // equal remainders: first in order wins
    const even = buildSplits(1, 'percentage', ['a', 'b'], { a: 50, b: 50 });
    expect(even.map((s) => s.amount)).toEqual([1, 0]);
  });

  it('throws unless percentages total exactly 100', () => {
    expectValidation(() => buildSplits(100, 'percentage', ['a', 'b'], { a: 50, b: 49.99 }), /100/);
    expectValidation(() => buildSplits(100, 'percentage', ['a', 'b'], { a: 60, b: 60 }), /100/);
  });

  it('rejects negative percentages and more than 2 decimals', () => {
    expectValidation(() => buildSplits(100, 'percentage', ['a', 'b'], { a: 110, b: -10 }));
    expectValidation(() => buildSplits(100, 'percentage', ['a', 'b'], { a: 33.333, b: 66.667 }));
  });
});

it('rejects an unknown split type', () => {
  expectValidation(() => buildSplits(100, 'shares', ['a']));
});
