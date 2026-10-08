const router = require('express').Router();
const c = require('../controllers/groupController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const requireGroupMember = require('../middleware/requireGroupMember');

router.use(auth);
router.get('/', c.list);
router.post('/', validate(c.createSchema), c.create);
router.post('/join', validate(c.joinSchema), c.join);
router.get('/:groupId', requireGroupMember, c.detail);

module.exports = router;
