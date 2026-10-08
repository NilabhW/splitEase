const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

router.post('/register', limiter, validate(c.registerSchema), c.register);
router.post('/login', limiter, validate(c.loginSchema), c.login);
router.post('/logout', auth, c.logout);
router.get('/me', auth, c.me);

module.exports = router;
