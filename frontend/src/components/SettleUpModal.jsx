import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { recordSettlement } from '../api/groups';
import { errorMessage } from '../utils/apiError';
import { rupeesToPaise } from '../utils/money';

// prefill: optional { from, to, amount } from a suggested payment
export default function SettleUpModal({ group, prefill, onClose, onSaved }) {
  const { user } = useAuth();
  const firstOther = group.members.find((m) => m._id !== user._id)?._id || '';
  const [form, setForm] = useState({
    from: prefill?.from._id || user._id,
    to: prefill?.to._id || firstOther,
    amount: prefill ? (prefill.amount / 100).toFixed(2) : '',
    note: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    const amount = rupeesToPaise(form.amount);
    if (form.from === form.to) return setError('Choose two different people');
    if (form.from !== user._id && form.to !== user._id) return setError('You must be the payer or the receiver');
    if (!(amount > 0)) return setError('Enter an amount above ₹0 with at most 2 decimals');
    setError('');
    setSubmitting(true);
    try {
      const body = { from: form.from, to: form.to, amount };
      if (form.note.trim()) body.note = form.note.trim();
      await recordSettlement(group._id, body);
      toast.success('Payment recorded');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
      setSubmitting(false);
    }
  };

  const options = group.members.map((m) => (
    <option key={m._id} value={m._id}>{m._id === user._id ? `${m.name} (you)` : m.name}</option>
  ));

  return (
    <Modal title="Settle up" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="flex gap-3">
          <label className="block flex-1">From (payer)
            <select value={form.from} onChange={set('from')} className="mt-1 w-full rounded border bg-white p-2">{options}</select>
          </label>
          <label className="block flex-1">To (receiver)
            <select value={form.to} onChange={set('to')} className="mt-1 w-full rounded border bg-white p-2">{options}</select>
          </label>
        </div>
        <label className="block">Amount (₹)
          <input inputMode="decimal" value={form.amount} onChange={set('amount')} placeholder="0.00" className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="block">Note (optional)
          <input value={form.note} onChange={set('note')} maxLength={200} placeholder="e.g. UPI, cash" className="mt-1 w-full rounded border p-2" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={submitting} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-50">
          {submitting ? 'Saving…' : 'Record payment'}
        </button>
      </form>
    </Modal>
  );
}
