import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { createGroup } from '../api/groups';
import { errorMessage } from '../utils/apiError';

export default function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Name must be at least 2 characters');
    setError('');
    setSubmitting(true);
    try {
      const group = await createGroup({ name: name.trim(), description: description.trim() });
      toast.success('Group created');
      onCreated(group);
    } catch (err) {
      toast.error(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create a group" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <label className="block">Group name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus className="mt-1 w-full rounded border p-2" />
          {error && <span className="text-sm text-red-600">{error}</span>}
        </label>
        <label className="block">Description (optional)
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="mt-1 w-full rounded border p-2" />
        </label>
        <button disabled={submitting} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </form>
    </Modal>
  );
}
