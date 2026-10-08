import { useState } from 'react';
import toast from 'react-hot-toast';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { deleteExpense, listExpenses } from '../api/expenses';
import { errorMessage } from '../utils/apiError';
import { formatPaise } from '../utils/money';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function ExpensesTab({ group, version, onAdd, onEdit, onChanged }) {
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => listExpenses(group._id), [group._id, version]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await listExpenses(group._id, data.page + 1);
      setData((d) => ({ ...next, expenses: [...d.expenses, ...next.expenses] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteExpense(group._id, toDelete._id);
      toast.success('Expense deleted');
      setToDelete(null);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.expenses.length)
    return (
      <EmptyState title="No expenses yet — add the first one">
        <button onClick={onAdd} className="rounded bg-emerald-600 px-4 py-1.5 text-white">Add expense</button>
      </EmptyState>
    );

  return (
    <>
      <ul className="divide-y rounded-xl border bg-white">
        {data.expenses.map((e) => {
          const mine = e.splits.find((s) => s.user._id === user._id)?.amount || 0;
          const own = e.createdBy._id === user._id;
          return (
            <li key={e._id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.description}</p>
                <p className="text-sm text-gray-500">
                  {fmtDate(e.date)} · {e.paidBy._id === user._id ? 'You' : e.paidBy.name} paid {formatPaise(e.amount)}
                </p>
                {own && (
                  <div className="mt-1 flex gap-3 text-sm">
                    <button onClick={() => onEdit(e)} className="text-emerald-700 underline">Edit</button>
                    <button onClick={() => setToDelete(e)} className="text-red-600 underline">Delete</button>
                  </div>
                )}
              </div>
              <p className="shrink-0 text-right text-sm text-gray-600">
                {mine ? `Your share ${formatPaise(mine)}` : 'Not involved'}
              </p>
            </li>
          );
        })}
      </ul>
      {data.page < data.totalPages && (
        <button onClick={loadMore} disabled={loadingMore} className="mt-3 w-full rounded border bg-white p-2 text-sm disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete expense?"
          message={`"${toDelete.description}" will be removed and balances recalculated.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </>
  );
}
