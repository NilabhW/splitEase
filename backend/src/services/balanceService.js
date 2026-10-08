// Net balance per user in paise: positive = the group owes them, negative = they owe.
// Balances are never stored; they are always derived from expenses and settlements.
function computeBalances(expenses, settlements, memberIds = []) {
  const net = {};
  const add = (id, delta) => {
    const key = String(id);
    net[key] = (net[key] || 0) + delta;
  };
  memberIds.forEach((id) => add(id, 0));

  for (const e of expenses) {
    add(e.paidBy, e.amount);
    for (const s of e.splits) add(s.user, -s.amount);
  }
  for (const s of settlements) {
    add(s.from, s.amount); // payer has paid off some of their debt
    add(s.to, -s.amount); // receiver has been paid back
  }

  const sum = Object.values(net).reduce((a, b) => a + b, 0);
  if (sum !== 0) console.error(`Balance invariant broken: nets sum to ${sum}, expected 0`);
  return net;
}

module.exports = { computeBalances };
