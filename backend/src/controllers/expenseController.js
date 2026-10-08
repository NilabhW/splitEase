const mongoose = require('mongoose');
const { z } = require('zod');
const Expense = require('../models/Expense');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { prepareExpense } = require('../services/expenseService');

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

const expenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(100),
  amount: z.number().int('Amount must be whole paise').positive('Amount must be more than 0').max(1e10),
  paidBy: objectId,
  splitType: z.enum(['equal', 'exact', 'percentage']),
  participants: z.array(objectId).min(1, 'Choose at least one person to split with'),
  shares: z.record(z.string(), z.number()).optional(),
  date: z.coerce.date().optional(),
});

const populate = (q) =>
  q.populate('paidBy', 'name').populate('createdBy', 'name').populate('splits.user', 'name');

// loads :id within the current group and enforces creator-only access for edit/delete
const loadOwnExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const expense = mongoose.isValidObjectId(id) && (await Expense.findOne({ _id: id, group: req.group._id }));
  if (!expense) throw new AppError(404, 'NOT_FOUND', 'Expense not found');
  if (!expense.createdBy.equals(req.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'Only the person who added this expense can change it');
  }
  req.expense = expense;
  next();
});

const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const filter = { group: req.group._id };
  const [expenses, total] = await Promise.all([
    populate(Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    Expense.countDocuments(filter),
  ]);
  res.json({ success: true, data: { expenses, page, totalPages: Math.max(Math.ceil(total / limit), 1), total } });
});

const create = asyncHandler(async (req, res) => {
  const fields = prepareExpense(req.group, req.body);
  const expense = await Expense.create({ ...fields, group: req.group._id, createdBy: req.user._id });
  res.status(201).json({ success: true, data: { expense: await populate(Expense.findById(expense._id)) } });
});

const update = asyncHandler(async (req, res) => {
  req.expense.set(prepareExpense(req.group, req.body));
  await req.expense.save();
  res.json({ success: true, data: { expense: await populate(Expense.findById(req.expense._id)) } });
});

const remove = asyncHandler(async (req, res) => {
  await req.expense.deleteOne();
  res.json({ success: true, data: {} });
});

module.exports = { list, create, update, remove, loadOwnExpense, expenseSchema };
