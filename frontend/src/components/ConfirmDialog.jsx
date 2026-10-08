import { useState } from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-gray-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded border px-4 py-1.5">Cancel</button>
        <button onClick={confirm} disabled={busy} className="rounded bg-red-600 px-4 py-1.5 text-white disabled:opacity-50">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
