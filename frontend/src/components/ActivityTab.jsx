import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { getActivity } from '../api/groups';
import { formatPaise } from '../utils/money';

const fmt = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ActivityTab({ group, version }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getActivity(group._id), [group._id, version]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.length) return <EmptyState title="No activity yet — expenses and payments will show up here." />;

  const who = (u) => (u._id === user._id ? 'You' : u.name);
  const whom = (u) => (u._id === user._id ? 'you' : u.name);

  return (
    <ul className="divide-y rounded-xl border bg-white">
      {data.map((item) => (
        <li key={`${item.type}-${item._id}`} className="flex gap-3 px-4 py-3">
          <span aria-hidden className="mt-0.5">{item.type === 'expense' ? '🧾' : '💸'}</span>
          <div className="min-w-0">
            {item.type === 'expense' ? (
              <p>
                {who(item.createdBy)} added "{item.description}" · {who(item.paidBy)} paid {formatPaise(item.amount)}
              </p>
            ) : (
              <p>
                {who(item.from)} paid {whom(item.to)} {formatPaise(item.amount)}
                {item.note && <span className="text-gray-500"> · {item.note}</span>}
              </p>
            )}
            <p className="text-xs text-gray-500">{fmt(item.date)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
