const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const cookieOptions = () => {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

function sendToken(res, user, status = 200) {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, cookieOptions());
  res.status(status).json({ success: true, data: { user } });
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  sendToken(res, user, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  sendToken(res, user);
});

const logout = (req, res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie('token', opts);
  res.json({ success: true, data: {} });
};

const me = (req, res) => res.json({ success: true, data: { user: req.user } });

module.exports = { register, login, logout, me, registerSchema, loginSchema };
