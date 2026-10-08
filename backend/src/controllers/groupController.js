const crypto = require('crypto');
const { z } = require('zod');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { groupBalances, memberNet, myNetBalances } = require('../services/ledgerService');

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
});
const joinSchema = z.object({ inviteCode: z.string().trim().length(8) });

const newCode = () => crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();

const populate = (q) => q.populate('members', 'name email');

const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  let group;
  for (let attempt = 0; attempt < 5 && !group; attempt++) {
    try {
      group = await Group.create({
        name,
        description,
        members: [req.user._id],
        createdBy: req.user._id,
        inviteCode: newCode(),
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  if (!group) throw new AppError(500, 'INTERNAL_ERROR', 'Could not generate invite code');
  group = await populate(Group.findById(group._id));
  res.status(201).json({ success: true, data: { group } });
});

const list = asyncHandler(async (req, res) => {
  const groups = await populate(Group.find({ members: req.user._id }).sort({ updatedAt: -1 }));
  const nets = await myNetBalances(groups.map((g) => g._id), req.user._id);
  const data = groups.map((g) => ({ ...g.toObject(), netBalance: nets[String(g._id)] }));
  res.json({ success: true, data: { groups: data } });
});

const join = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ inviteCode: req.body.inviteCode.toUpperCase() });
  if (!group) throw new AppError(404, 'NOT_FOUND', 'Invalid invite code');
  if (group.members.some((m) => m.equals(req.user._id))) {
    throw new AppError(409, 'ALREADY_MEMBER', 'You are already in this group', { groupId: group._id });
  }
  group.members.push(req.user._id);
  await group.save();
  res.json({ success: true, data: { group: await populate(Group.findById(group._id)) } });
});

const detail = asyncHandler(async (req, res) => {
  const group = await populate(Group.findById(req.group._id));
  res.json({ success: true, data: { group } });
});

const balances = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await groupBalances(req.group) });
});

const ACTIVITY_LIMIT = 50;

// Expenses and settlements merged into one newest-first timeline.
const activity = asyncHandler(async (req, res) => {
  const group = req.group._id;
  const [expenses, settlements] = await Promise.all([
    Expense.find({ group })
      .sort({ date: -1, createdAt: -1 })
      .limit(ACTIVITY_LIMIT)
      .populate('paidBy', 'name')
      .populate('createdBy', 'name')
      .lean(),
    Settlement.find({ group })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_LIMIT)
      .populate('from', 'name')
      .populate('to', 'name')
      .populate('createdBy', 'name')
      .lean(),
  ]);
  const items = [
    ...expenses.map((e) => ({
      type: 'expense',
      _id: e._id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      paidBy: e.paidBy,
      createdBy: e.createdBy,
    })),
    ...settlements.map((s) => ({
      type: 'settlement',
      _id: s._id,
      date: s.createdAt,
      amount: s.amount,
      from: s.from,
      to: s.to,
      note: s.note,
      createdBy: s.createdBy,
    })),
  ]
    .sort((x, y) => new Date(y.date) - new Date(x.date))
    .slice(0, ACTIVITY_LIMIT);
  res.json({ success: true, data: { activity: items } });
});

const leave = asyncHandler(async (req, res) => {
  const net = await memberNet(req.group, req.user._id);
  if (net !== 0) {
    throw new AppError(400, 'BALANCE_NOT_ZERO', 'Settle up first: you can only leave once your balance is zero');
  }
  const group = await Group.findByIdAndUpdate(req.group._id, { $pull: { members: req.user._id } }, { new: true });
  if (group.members.length === 0) {
    await Promise.all([
      Expense.deleteMany({ group: group._id }),
      Settlement.deleteMany({ group: group._id }),
      group.deleteOne(),
    ]);
  }
  res.json({ success: true, data: {} });
});

module.exports = { create, list, join, detail, balances, activity, leave, createSchema, joinSchema };
