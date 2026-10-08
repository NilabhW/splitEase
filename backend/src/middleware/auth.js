const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

module.exports = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Session expired, please log in again');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in');
  req.user = user;
  next();
});
