const AppError = require('../utils/AppError');

const invalid = (message) => new AppError(400, 'VALIDATION_ERROR', message);
const isNonNegInt = (n) => Number.isInteger(n) && n >= 0;

// Distribute `amount` paise among participants so the parts always sum to `amount` exactly.
// participants: array of user ids; input: { [userId]: paise (exact) | percent (percentage) }
function buildSplits(amount, splitType, participants, input = {}) {
  if (!Number.isInteger(amount) || amount <= 0) throw invalid('Amount must be a positive whole number of paise');
  if (!participants.length) throw invalid('Choose at least one person to split with');
  const ids = participants.map(String);
  if (new Set(ids).size !== ids.length) throw invalid('Duplicate participants');

  if (splitType === 'equal') {
    const base = Math.floor(amount / ids.length);
    const extra = amount - base * ids.length;
    return ids.map((user, i) => ({ user, amount: base + (i < extra ? 1 : 0) }));
  }

  if (splitType === 'exact') {
    const splits = ids.map((user) => ({ user, amount: input[user] }));
    if (!splits.every((s) => isNonNegInt(s.amount))) throw invalid('Each amount must be zero or more');
    const total = splits.reduce((sum, s) => sum + s.amount, 0);
    if (total !== amount) throw invalid('Splits must add up to the total amount');
    return splits;
  }

  if (splitType === 'percentage') {
    // work in basis points (1% = 100) so 33.33% is the integer 3333 and nothing drifts
    const bps = ids.map((user) => {
      const pct = input[user];
      const bp = Math.round(pct * 100);
      if (typeof pct !== 'number' || pct < 0 || Math.abs(pct * 100 - bp) > 1e-6) {
        throw invalid('Percentages must be zero or more with at most 2 decimals');
      }
      return bp;
    });
    if (bps.reduce((a, b) => a + b, 0) !== 10000) throw invalid('Percentages must add up to 100');

    const parts = ids.map((user, i) => ({
      user,
      amount: Math.floor((amount * bps[i]) / 10000),
      remainder: (amount * bps[i]) % 10000,
      order: i,
    }));
    let leftover = amount - parts.reduce((sum, p) => sum + p.amount, 0);
    // largest-remainder method: leftover paise go to the biggest fractional parts, ties by order
    const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.order - b.order);
    for (let i = 0; leftover > 0; i++, leftover--) byRemainder[i].amount += 1;
    return parts.map(({ user, amount: a }) => ({ user, amount: a }));
  }

  throw invalid('Split type must be equal, exact or percentage');
}

module.exports = { buildSplits };
