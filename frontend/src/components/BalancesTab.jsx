import Spinner from './Spinner';
import ErrorState from './ErrorState';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { getBalances } from '../api/balances';
import { formatPaise } from '../utils/money';

export default function BalancesTab({ group, version, renderPlanAction }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getBalances(group._id), [group._id, version]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const name = (u) => (u._id === user._id ? 'You' : u.name);
  const describe = ({ user: u, net }) => {
    const you = u._id === user._id;
    if (net > 0) return <span className="text-emerald-600">{you ? 'you get back' : 'gets back'} {formatPaise(net)}</span>;
    if (net < 0) return <span className="text-red-600">{you ? 'you owe' : 'owes'} {formatPaise(-net)}</span>;
    return <span className="text-gray-500">settled up</span>;
  };

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-xl border bg-white">
        {data.balances.map((b) => (
          <li key={b.user._id} className="flex justify-between gap-3 px-4 py-2">
            <span>{name(b.user)}</span>
            <span className="text-sm">{describe(b)}</span>
          </li>
        ))}
      </ul>

      <section>
        <h3 className="mb-2 font-semibold">Suggested payments</h3>
        {data.plan.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 p-4 text-emerald-700">Everyone is settled up 🎉</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-500">
              The fewest payments that clear every balance in the group.
            </p>
            <ul className="divide-y rounded-xl border bg-white">
              {data.plan.map((p) => (
                <li key={`${p.from._id}-${p.to._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span>
                    {name(p.from)} {p.from._id === user._id ? 'pay' : 'pays'} {p.to._id === user._id ? 'you' : p.to.name}{' '}
                    <strong>{formatPaise(p.amount)}</strong>
                  </span>
                  {renderPlanAction?.(p)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
