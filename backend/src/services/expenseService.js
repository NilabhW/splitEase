const AppError = require('../utils/AppError');
const { buildSplits } = require('./splitService');

const isMember = (group, userId) => group.members.some((m) => m.equals(userId));

// Turns a validated request body into expense fields, re-checking membership here rather than
// trusting the route middleware: the payer and every participant must belong to the group.
function prepareExpense(group, body) {
  const { description, amount, paidBy, splitType, participants, shares, date } = body;
  if (!isMember(group, paidBy)) throw new AppError(400, 'VALIDATION_ERROR', 'The payer must be a group member');
  if (!participants.every((p) => isMember(group, p))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Everyone in the split must be a group member');
  }
  const splits = buildSplits(amount, splitType, participants, shares);
  return { description, amount, paidBy, splitType, splits, ...(date && { date }) };
}

module.exports = { prepareExpense, isMember };
