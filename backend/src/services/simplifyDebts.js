// Greedy plan: repeatedly have the biggest debtor pay the biggest creditor.
// Each step zeroes at least one person, so n people with non-zero balances need at most n - 1 payments.
function simplifyDebts(netBalances) {
  const byAmountThenId = (a, b) => b.net - a.net || a.id.localeCompare(b.id);
  const creditors = [];
  const debtors = [];
  for (const [id, net] of Object.entries(netBalances)) {
    if (net > 0) creditors.push({ id, net });
    else if (net < 0) debtors.push({ id, net: -net }); // store debt as a positive number
  }

  const plan = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmountThenId);
    debtors.sort(byAmountThenId);
    const c = creditors[0];
    const d = debtors[0];
    const pay = Math.min(c.net, d.net);
    plan.push({ from: d.id, to: c.id, amount: pay });
    c.net -= pay;
    d.net -= pay;
    if (c.net === 0) creditors.shift();
    if (d.net === 0) debtors.shift();
  }
  return plan;
}

module.exports = { simplifyDebts };
