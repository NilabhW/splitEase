const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const expenseSchema = new mongoose.Schema(
  {
    group: { type: ObjectId, ref: 'Group', required: true, index: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    paidBy: { type: ObjectId, ref: 'User', required: true },
    splitType: { type: String, enum: ['equal', 'exact', 'percentage'], required: true },
    splits: [
      {
        _id: false,
        user: { type: ObjectId, ref: 'User', required: true },
        amount: { type: Number, required: true, min: 0, validate: Number.isInteger },
      },
    ],
    createdBy: { type: ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// last line of defence: whatever path created the splits, they must sum to the total
expenseSchema.pre('validate', function checkSplits() {
  const total = this.splits.reduce((sum, s) => sum + s.amount, 0);
  if (total !== this.amount) this.invalidate('splits', 'Splits must add up to the total amount');
});

expenseSchema.index({ group: 1, date: -1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
