const mongoose = require('mongoose');
const { z } = require('zod');
const Settlement = require('../models/Settlement');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { isMember } = require('../services/expenseService');

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

const settlementSchema = z
  .object({
    from: objectId,
    to: objectId,
    amount: z.number().int('Amount must be whole paise').positive('Amount must be more than 0').max(1e10),
    note: z.string().trim().max(200).optional(),
  })
  .refine((s) => s.from !== s.to, { message: 'You cannot pay yourself', path: ['to'] });

const create = asyncHandler(async (req, res) => {
  const { from, to, amount, note } = req.body;
  const me = String(req.user._id);
  if (from !== me && to !== me) {
    throw new AppError(403, 'FORBIDDEN', 'You can only record payments you made or received');
  }
  if (!isMember(req.group, from) || !isMember(req.group, to)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Both people must be group members');
  }
  const settlement = await Settlement.create({ group: req.group._id, from, to, amount, note, createdBy: req.user._id });
  await settlement.populate([
    { path: 'from', select: 'name' },
    { path: 'to', select: 'name' },
  ]);
  res.status(201).json({ success: true, data: { settlement } });
});

module.exports = { create, settlementSchema };
