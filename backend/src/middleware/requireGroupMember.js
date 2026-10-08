const mongoose = require('mongoose');
const Group = require('../models/Group');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

module.exports = asyncHandler(async (req, res, next) => {
  const { groupId } = req.params;
  if (!mongoose.isValidObjectId(groupId)) throw new AppError(404, 'NOT_FOUND', 'Group not found');
  const group = await Group.findById(groupId);
  if (!group) throw new AppError(404, 'NOT_FOUND', 'Group not found');
  if (!group.members.some((m) => m.equals(req.user._id))) {
    throw new AppError(403, 'FORBIDDEN', 'You are not a member of this group');
  }
  req.group = group;
  next();
});
