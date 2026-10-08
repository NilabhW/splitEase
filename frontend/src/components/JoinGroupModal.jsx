import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { joinGroup } from '../api/groups';
import { errorMessage } from '../utils/apiError';

export default function JoinGroupModal({ onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const valid = code.trim().length === 8;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      const group = await joinGroup(code.trim().toUpperCase());
      toast.success(`Joined ${group.name}`);
      onJoined(group);
    } catch (err) {
      toast.error(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Join a group" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">Invite code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={8}
            autoFocus
            placeholder="8-character code"
            className="mt-1 w-full rounded border p-2 font-mono uppercase tracking-widest"
          />
        </label>
        <button disabled={!valid || submitting} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-50">
          {submitting ? 'Joining…' : 'Join'}
        </button>
      </form>
    </Modal>
  );
}
