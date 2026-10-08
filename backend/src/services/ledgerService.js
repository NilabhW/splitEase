const Expense = require('../models/Expense');
const User = require('../models/User');
const { computeBalances } = require('./balanceService');
const { simplifyDebts } = require('./simplifyDebts');

// Only the fields balance math needs, so large groups stay cheap to load.
const loadRecords = (groupFilter) =>
  Expense.find({ group: groupFilter }).select('group paidBy amount splits').lean();

// Net balances (with names) and the suggested payment plan for one group.
async function groupBalances(group) {
  const expenses = await loadRecords(group._id);
  const net = computeBalances(expenses, [], group.members);
  const users = await User.find({ _id: { $in: Object.keys(net) } }).select('name').lean();
  const userById = Object.fromEntries(users.map((u) => [String(u._id), { _id: String(u._id), name: u.name }]));

  const balances = Object.entries(net).map(([id, amount]) => ({ user: userById[id], net: amount }));
  const plan = simplifyDebts(net).map((p) => ({ from: userById[p.from], to: userById[p.to], amount: p.amount }));
  return { balances, plan };
}

// The current user's net balance in each of the given groups, in one query.
async function myNetBalances(groupIds, userId) {
  const expenses = await loadRecords({ $in: groupIds });
  const byGroup = {};
  for (const e of expenses) (byGroup[e.group] ||= []).push(e);
  return Object.fromEntries(
    groupIds.map((id) => [String(id), computeBalances(byGroup[id] || [], [])[String(userId)] || 0])
  );
}

module.exports = { groupBalances, myNetBalances };
