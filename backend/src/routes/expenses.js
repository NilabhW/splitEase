const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/expenseController');
const validate = require('../middleware/validate');

// mounted under /api/groups/:groupId/expenses after auth + requireGroupMember
router.get('/', c.list);
router.post('/', validate(c.expenseSchema), c.create);
router.put('/:id', c.loadOwnExpense, validate(c.expenseSchema), c.update);
router.delete('/:id', c.loadOwnExpense, c.remove);

module.exports = router;
