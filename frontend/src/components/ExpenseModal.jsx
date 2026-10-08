import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { createExpense, updateExpense } from '../api/expenses';
import { errorMessage } from '../utils/apiError';
import { formatPaise, rupeesToPaise } from '../utils/money';
import { percentToBp, percentagesFromSplits, remaining } from '../utils/splits';

const TYPES = [
  ['equal', 'Equal'],
  ['exact', 'Exact'],
  ['percentage', 'Percentage'],
];

function initialState(group, me, expense) {
  if (!expense) {
    return {
      description: '',
      amount: '',
      paidBy: me._id,
      splitType: 'equal',
      participants: group.members.map((m) => m._id),
      shares: {},
    };
  }
  const shares =
    expense.splitType === 'exact'
      ? Object.fromEntries(expense.splits.map((s) => [s.user._id, (s.amount / 100).toFixed(2)]))
      : expense.splitType === 'percentage'
        ? percentagesFromSplits(expense.amount, expense.splits)
        : {};
  return {
    description: expense.description,
    amount: (expense.amount / 100).toFixed(2),
    paidBy: expense.paidBy._id,
    splitType: expense.splitType,
    participants: expense.splits.map((s) => s.user._id),
    shares,
  };
}

export default function ExpenseModal({ group, expense, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => initialState(group, user, expense));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const amountPaise = rupeesToPaise(form.amount);
  // keep participants in member order so the payload is stable
  const participants = group.members.map((m) => m._id).filter((id) => form.participants.includes(id));
  const left = remaining(amountPaise || 0, form.splitType, participants, form.shares);
  const balanced = form.splitType === 'equal' || (amountPaise > 0 && left === 0);

  const toggle = (id) =>
    set({ participants: form.participants.includes(id) ? form.participants.filter((p) => p !== id) : [...form.participants, id] });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return setError('Enter a description');
    if (!(amountPaise > 0)) return setError('Enter an amount above ₹0 with at most 2 decimals');
    if (!participants.length) return setError('Choose at least one person to split with');
    setError('');

    const body = {
      description: form.description.trim(),
      amount: amountPaise,
      paidBy: form.paidBy,
      splitType: form.splitType,
      participants,
    };
    if (form.splitType === 'exact') {
      body.shares = Object.fromEntries(participants.map((id) => [id, rupeesToPaise(form.shares[id] ?? '')]));
    } else if (form.splitType === 'percentage') {
      body.shares = Object.fromEntries(participants.map((id) => [id, percentToBp(form.shares[id] ?? '') / 100]));
    }

    setSubmitting(true);
    try {
      const saved = expense ? await updateExpense(group._id, expense._id, body) : await createExpense(group._id, body);
      toast.success(expense ? 'Expense updated' : 'Expense added');
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
      setSubmitting(false);
    }
  };

  const nameOf = (id) => group.members.find((m) => m._id === id)?.name;
  let summary = null;
  if (form.splitType === 'equal' && amountPaise > 0 && participants.length) {
    const each = amountPaise / participants.length;
    summary = Number.isInteger(each) ? `${formatPaise(each)} each` : `about ${formatPaise(Math.floor(each))} each`;
  } else if (form.splitType === 'exact') {
    summary = left >= 0 ? `${formatPaise(left)} left` : `${formatPaise(-left)} over`;
  } else if (form.splitType === 'percentage') {
    summary = left >= 0 ? `${(left / 100).toFixed(2)}% left` : `${(-left / 100).toFixed(2)}% over`;
  }

  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <label className="block">Description
          <input value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={100} className="mt-1 w-full rounded border p-2" />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">Amount (₹)
            <input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block flex-1">Paid by
            <select value={form.paidBy} onChange={(e) => set({ paidBy: e.target.value })} className="mt-1 w-full rounded border bg-white p-2">
              {group.members.map((m) => (
                <option key={m._id} value={m._id}>{m._id === user._id ? `${m.name} (you)` : m.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div role="group" aria-label="Split type" className="grid grid-cols-3 overflow-hidden rounded border text-sm">
          {TYPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.splitType === value}
              onClick={() => set({ splitType: value })}
              className={`p-2 ${form.splitType === value ? 'bg-emerald-600 text-white' : 'bg-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm text-gray-600">Split between</legend>
          {group.members.map((m) => {
            const on = form.participants.includes(m._id);
            return (
              <div key={m._id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={on} onChange={() => toggle(m._id)} />
                  {m.name}
                </label>
                {on && form.splitType !== 'equal' && (
                  <input
                    aria-label={`${nameOf(m._id)}'s share`}
                    inputMode="decimal"
                    value={form.shares[m._id] ?? ''}
                    onChange={(e) => set({ shares: { ...form.shares, [m._id]: e.target.value } })}
                    placeholder={form.splitType === 'exact' ? '₹' : '%'}
                    className="w-28 rounded border p-1.5 text-right"
                  />
                )}
              </div>
            );
          })}
        </fieldset>

        {summary && (
          <p className={`text-sm ${balanced ? 'text-gray-600' : 'text-amber-700'}`}>{summary}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={!balanced || submitting} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}
