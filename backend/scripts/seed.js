// Creates three demo users and a "Goa Trip" group with a few expenses and a settlement.
// Safe to re-run: it only removes the demo accounts and groups they created, nothing else.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Expense = require('../src/models/Expense');
const Settlement = require('../src/models/Settlement');
const { buildSplits } = require('../src/services/splitService');

const DEMO_PASSWORD = 'demo1234';
const DEMO_USERS = [
  { name: 'Asha', email: 'asha@demo.com' },
  { name: 'Bob', email: 'bob@demo.com' },
  { name: 'Cara', email: 'cara@demo.com' },
];

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function seed() {
  const existing = await User.find({ email: { $in: DEMO_USERS.map((u) => u.email) } }).select('_id');
  const oldGroups = await Group.find({ createdBy: { $in: existing.map((u) => u._id) } }).select('_id');
  const oldIds = oldGroups.map((g) => g._id);
  await Promise.all([
    Expense.deleteMany({ group: { $in: oldIds } }),
    Settlement.deleteMany({ group: { $in: oldIds } }),
    Group.deleteMany({ _id: { $in: oldIds } }),
  ]);
  await User.deleteMany({ _id: { $in: existing.map((u) => u._id) } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [asha, bob, cara] = await User.create(DEMO_USERS.map((u) => ({ ...u, passwordHash })));
  const everyone = [asha, bob, cara].map((u) => String(u._id));

  const group = await Group.create({
    name: 'Goa Trip',
    description: 'Long weekend in Goa',
    members: everyone,
    createdBy: asha._id,
    inviteCode: crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase(),
  });

  const expense = (description, amount, payer, splitType, participants, input, ago) => ({
    group: group._id,
    description,
    amount,
    paidBy: payer._id,
    splitType,
    splits: buildSplits(amount, splitType, participants, input),
    createdBy: payer._id,
    date: daysAgo(ago),
  });
  const [a, b, c] = everyone;
  await Expense.create([
    expense('Beach shack hotel', 1200000, asha, 'equal', everyone, {}, 4),
    expense('Scooter rentals', 150000, bob, 'exact', everyone, { [a]: 50000, [b]: 50000, [c]: 50000 }, 3),
    expense('Seafood dinner', 450050, cara, 'percentage', everyone, { [a]: 40, [b]: 35, [c]: 25 }, 2),
    expense('Airport cab', 99900, asha, 'equal', [a, b], {}, 1),
  ]);
  await Settlement.create({ group: group._id, from: bob._id, to: asha._id, amount: 200000, note: 'UPI', createdBy: bob._id });

  return { group, users: [asha, bob, cara] };
}

if (require.main === module) {
  const { MONGO_URI } = require('../src/config/env');
  mongoose
    .connect(MONGO_URI)
    .then(seed)
    .then(({ group }) => {
      console.log(`Seeded "${group.name}" (invite code ${group.inviteCode}).`);
      console.log(`Log in as asha@demo.com, bob@demo.com or cara@demo.com with password ${DEMO_PASSWORD}`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { seed, DEMO_PASSWORD };
