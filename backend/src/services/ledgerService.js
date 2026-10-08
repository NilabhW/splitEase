const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const { computeBalances } = require('./balanceService');
const { simplifyDebts } = require('./simplifyDebts');

// Only the fields balance math needs, so large groups stay cheap to load.
const loadRecords = (groupFilter) =>
  Promise.all([
    Expense.find({ group: groupFilter }).select('group paidBy amount splits').lean(),
    Settlement.find({ group: groupFilter }).select('group from to amount').lean(),
  ]);

const groupNet = async (group) => {
  const [expenses, settlements] = await loadRecords(group._id);
  return computeBalances(expenses, settlements, group.members);
};

// Net balances (with names) and the suggested payment plan for one group.
// Former members still appear while they have history, so the books always add up.
async function groupBalances(group) {
  const net = await groupNet(group);
  const users = await User.find({ _id: { $in: Object.keys(net) } }).select('name').lean();
  const userById = Object.fromEntries(users.map((u) => [String(u._id), { _id: String(u._id), name: u.name }]));

  const balances = Object.entries(net).map(([id, amount]) => ({ user: userById[id], net: amount }));
  const plan = simplifyDebts(net).map((p) => ({ from: userById[p.from], to: userById[p.to], amount: p.amount }));
  return { balances, plan };
}

async function memberNet(group, userId) {
  return (await groupNet(group))[String(userId)] || 0;
}

// The current user's net balance in each of the given groups, in two queries total.
async function myNetBalances(groupIds, userId) {
  const [expenses, settlements] = await loadRecords({ $in: groupIds });
  const byGroup = {};
  const bucket = (id) => (byGroup[id] ||= { expenses: [], settlements: [] });
  expenses.forEach((e) => bucket(e.group).expenses.push(e));
  settlements.forEach((s) => bucket(s.group).settlements.push(s));
  return Object.fromEntries(
    groupIds.map((id) => {
      const { expenses: e = [], settlements: s = [] } = byGroup[id] || {};
      return [String(id), computeBalances(e, s)[String(userId)] || 0];
    })
  );
}

module.exports = { groupBalances, memberNet, myNetBalances };
