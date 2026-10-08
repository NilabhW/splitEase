const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const settlementSchema = new mongoose.Schema(
  {
    group: { type: ObjectId, ref: 'Group', required: true, index: true },
    from: { type: ObjectId, ref: 'User', required: true }, // payer
    to: { type: ObjectId, ref: 'User', required: true }, // receiver
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

settlementSchema.pre('validate', function differentPeople() {
  if (this.from && this.to && this.from.equals(this.to)) this.invalidate('to', 'You cannot pay yourself');
});

module.exports = mongoose.model('Settlement', settlementSchema);
