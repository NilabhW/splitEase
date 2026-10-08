const crypto = require('crypto');
const { z } = require('zod');
const Group = require('../models/Group');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

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
  // netBalance is filled in once expenses exist (balances phase)
  const data = groups.map((g) => ({ ...g.toObject(), netBalance: 0 }));
  res.json({ success: true, data: { groups: data } });
});

const join = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ inviteCode: req.body.inviteCode.toUpperCase() });
  if (!group) throw new AppError(404, 'NOT_FOUND', 'Invalid invite code');
  if (group.members.some((m) => m.equals(req.user._id))) {
    throw new AppError(409, 'ALREADY_MEMBER', 'You are already in this group');
  }
  group.members.push(req.user._id);
  await group.save();
  res.json({ success: true, data: { group: await populate(Group.findById(group._id)) } });
});

const detail = asyncHandler(async (req, res) => {
  const group = await populate(Group.findById(req.group._id));
  res.json({ success: true, data: { group } });
});

module.exports = { create, list, join, detail, createSchema, joinSchema };
